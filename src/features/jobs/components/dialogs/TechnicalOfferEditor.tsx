// src/features/jobs/components/dialogs/TechnicalOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import {
  Download,
  Eye,
  Lock,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Trash,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import {
  createOffer,
  exportOfferPDF,
  lockOffer,
  offerDetailQuery,
  recalculateOfferTotals,
} from '../../api/offerQueries'
import { calculateOfferTotals } from '../../utils/offerCalculations'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
  UUID,
} from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null // If provided, edit mode; otherwise create mode
  onSaved?: (offerId: string) => void
}

type LocalEquipmentGroup = {
  id: string // temp ID for new groups
  group_name: string
  sort_order: number
  items: Array<LocalEquipmentItem>
}

type LocalEquipmentItem = {
  id: string // temp ID for new items
  item_id: string | null
  quantity: number
  unit_price: number
  is_internal: boolean
  sort_order: number
  item?: {
    id: string
    name: string
    externally_owned?: boolean | null
    external_owner_id?: UUID | null
  } | null
}

type LocalCrewItem = {
  id: string // temp ID for new items
  role_title: string
  crew_count: number
  start_date: string
  end_date: string
  daily_rate: number
  sort_order: number
}

type LocalTransportItem = {
  id: string // temp ID for new items
  vehicle_name: string
  vehicle_id: string | null
  start_date: string
  end_date: string
  daily_rate: number
  is_internal: boolean
  sort_order: number
  vehicle?: {
    id: string
    name: string
    external_owner_id?: UUID | null
  } | null
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ minWidth: 160 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

export default function TechnicalOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const isEditMode = !!offerId
  const [currentOfferId, setCurrentOfferId] = React.useState<string | null>(
    offerId || null,
  )

  // Fetch job title for default offer name
  const { data: job } = useQuery({
    queryKey: ['job-title', jobId],
    enabled: open && !isEditMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data as { title: string }
    },
  })

  // Fetch existing offer if editing or if we have a current offer ID (after saving)
  const { data: existingOffer } = useQuery({
    ...(currentOfferId
      ? offerDetailQuery(currentOfferId)
      : { queryKey: ['no-offer'], queryFn: () => null }),
    enabled: open && !!currentOfferId,
  })

  const isReadOnly = existingOffer?.locked || false

  // Default title based on job
  const defaultTitle = job?.title ? `Offer for ${job.title}` : ''

  // Offer metadata
  const [title, setTitle] = React.useState('')
  const [daysOfUse, setDaysOfUse] = React.useState(1)
  const [discountPercent, setDiscountPercent] = React.useState(0)
  const [vatPercent, setVatPercent] = React.useState(25)

  // Equipment groups and items
  const [equipmentGroups, setEquipmentGroups] = React.useState<
    Array<LocalEquipmentGroup>
  >([])
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )

  // Crew items
  const [crewItems, setCrewItems] = React.useState<Array<LocalCrewItem>>([])

  // Transport items
  const [transportItems, setTransportItems] = React.useState<
    Array<LocalTransportItem>
  >([])

  // Update currentOfferId when offerId prop changes
  React.useEffect(() => {
    if (offerId) {
      setCurrentOfferId(offerId)
    }
  }, [offerId])

  // Initialize from existing offer
  React.useEffect(() => {
    if (!open) return

    if (existingOffer && currentOfferId) {
      setTitle(existingOffer.title)
      setDaysOfUse(existingOffer.days_of_use)
      setDiscountPercent(existingOffer.discount_percent)
      setVatPercent(existingOffer.vat_percent)

      // Convert equipment groups
      const groups: Array<LocalEquipmentGroup> =
        existingOffer.groups?.map((group) => ({
          id: group.id,
          group_name: group.group_name,
          sort_order: group.sort_order,
          items: group.items.map((item) => ({
            id: item.id,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            is_internal: item.is_internal,
            sort_order: item.sort_order,
            item: item.item,
          })),
        })) || []
      setEquipmentGroups(groups)

      // Convert crew items
      const crew: Array<LocalCrewItem> =
        existingOffer.crew_items?.map((item) => ({
          id: item.id,
          role_title: item.role_title,
          crew_count: item.crew_count,
          start_date: item.start_date,
          end_date: item.end_date,
          daily_rate: item.daily_rate,
          sort_order: item.sort_order,
        })) || []
      setCrewItems(crew)

      // Convert transport items
      const transport: Array<LocalTransportItem> =
        existingOffer.transport_items?.map((item) => ({
          id: item.id,
          vehicle_name: item.vehicle_name,
          vehicle_id: item.vehicle_id,
          start_date: item.start_date,
          end_date: item.end_date,
          daily_rate: item.daily_rate,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          vehicle: item.vehicle,
        })) || []
      setTransportItems(transport)
    } else {
      // Reset for new offer
      setTitle(defaultTitle)
      setDaysOfUse(1)
      setDiscountPercent(0)
      setVatPercent(25)
      setEquipmentGroups([])
      setCrewItems([])
      setTransportItems([])
      setExpandedGroups(new Set())
      setCurrentOfferId(null)
    }
  }, [open, existingOffer, currentOfferId, defaultTitle])

  // Calculate totals
  const totals = React.useMemo(() => {
    const equipmentItems: Array<OfferEquipmentItem> = equipmentGroups.flatMap(
      (group) =>
        group.items.map((item) => ({
          id: item.id,
          offer_group_id: group.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
          item: item.item,
        })),
    )

    const crew: Array<OfferCrewItem> = crewItems.map((item) => ({
      id: item.id,
      offer_id: offerId || '',
      role_title: item.role_title,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: 0, // Will be calculated
      sort_order: item.sort_order,
    }))

    const transport: Array<OfferTransportItem> = transportItems.map((item) => ({
      id: item.id,
      offer_id: offerId || '',
      vehicle_name: item.vehicle_name,
      vehicle_id: item.vehicle_id,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: 0, // Will be calculated
      is_internal: item.is_internal,
      sort_order: item.sort_order,
      vehicle: item.vehicle,
    }))

    return calculateOfferTotals(
      equipmentItems,
      crew,
      transport,
      daysOfUse,
      discountPercent,
      vatPercent,
    )
  }, [
    equipmentGroups,
    crewItems,
    transportItems,
    daysOfUse,
    discountPercent,
    vatPercent,
    offerId,
  ])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error('Title is required')
      }

      let workingOfferId: string

      // Create offer if new
      if (!offerId) {
        workingOfferId = await createOffer({
          jobId,
          companyId,
          offerType: 'technical',
          title: title.trim(),
          daysOfUse,
          discountPercent,
          vatPercent,
        })
      } else {
        workingOfferId = offerId
        // Update offer metadata
        const { error } = await supabase
          .from('job_offers')
          .update({
            title: title.trim(),
            days_of_use: daysOfUse,
            discount_percent: discountPercent,
            vat_percent: vatPercent,
          })
          .eq('id', workingOfferId)

        if (error) throw error
      }

      // Delete existing groups and items if editing
      if (workingOfferId && existingOffer) {
        // Delete equipment items first (foreign key constraint)
        if (existingOffer.groups && existingOffer.groups.length > 0) {
          const groupIds = existingOffer.groups.map((g) => g.id)
          const { error: itemsErr } = await supabase
            .from('offer_equipment_items')
            .delete()
            .in('offer_group_id', groupIds)
          if (itemsErr) throw itemsErr

          // Delete groups
          const { error: groupsErr } = await supabase
            .from('offer_equipment_groups')
            .delete()
            .eq('offer_id', workingOfferId)
          if (groupsErr) throw groupsErr
        }

        // Delete crew items
        if (existingOffer.crew_items && existingOffer.crew_items.length > 0) {
          const { error: crewErr } = await supabase
            .from('offer_crew_items')
            .delete()
            .eq('offer_id', workingOfferId)
          if (crewErr) throw crewErr
        }

        // Delete transport items
        if (
          existingOffer.transport_items &&
          existingOffer.transport_items.length > 0
        ) {
          const { error: transportErr } = await supabase
            .from('offer_transport_items')
            .delete()
            .eq('offer_id', workingOfferId)
          if (transportErr) throw transportErr
        }
      }

      // Save equipment groups and items
      for (const group of equipmentGroups) {
        const isExistingGroup = !group.id.startsWith('temp-')

        let groupId: string
        if (isExistingGroup) {
          groupId = group.id
        } else {
          // Create new group
          const { data: newGroup, error: groupErr } = await supabase
            .from('offer_equipment_groups')
            .insert({
              offer_id: workingOfferId,
              group_name: group.group_name,
              sort_order: group.sort_order,
            })
            .select('id')
            .single()

          if (groupErr) throw groupErr
          groupId = newGroup.id
        }

        // Save items in this group
        for (const item of group.items) {
          const isExistingItem = !item.id.startsWith('temp-')
          if (isExistingItem) {
            // Update existing item
            const { error: itemErr } = await supabase
              .from('offer_equipment_items')
              .update({
                item_id: item.item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity,
                is_internal: item.is_internal,
                sort_order: item.sort_order,
              })
              .eq('id', item.id)

            if (itemErr) throw itemErr
          } else {
            // Create new item
            const { error: itemErr } = await supabase
              .from('offer_equipment_items')
              .insert({
                offer_group_id: groupId,
                item_id: item.item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity,
                is_internal: item.is_internal,
                sort_order: item.sort_order,
              })

            if (itemErr) throw itemErr
          }
        }
      }

      // Save crew items
      for (const item of crewItems) {
        const isExistingItem = !item.id.startsWith('temp-')
        const days = Math.ceil(
          (new Date(item.end_date).getTime() -
            new Date(item.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
        const totalPrice = item.daily_rate * item.crew_count * Math.max(1, days)

        if (isExistingItem) {
          const { error: itemErr } = await supabase
            .from('offer_crew_items')
            .update({
              role_title: item.role_title,
              crew_count: item.crew_count,
              start_date: item.start_date,
              end_date: item.end_date,
              daily_rate: item.daily_rate,
              total_price: totalPrice,
              sort_order: item.sort_order,
            })
            .eq('id', item.id)

          if (itemErr) throw itemErr
        } else {
          const { error: itemErr } = await supabase
            .from('offer_crew_items')
            .insert({
              offer_id: workingOfferId,
              role_title: item.role_title,
              crew_count: item.crew_count,
              start_date: item.start_date,
              end_date: item.end_date,
              daily_rate: item.daily_rate,
              total_price: totalPrice,
              sort_order: item.sort_order,
            })

          if (itemErr) throw itemErr
        }
      }

      // Save transport items
      for (const item of transportItems) {
        const isExistingItem = !item.id.startsWith('temp-')
        const days = Math.ceil(
          (new Date(item.end_date).getTime() -
            new Date(item.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
        const totalPrice = item.daily_rate * Math.max(1, days)

        if (isExistingItem) {
          // For existing items, update all fields
          const basePayload: any = {
            vehicle_name: item.vehicle_name,
            start_date: item.start_date,
            end_date: item.end_date,
            daily_rate: item.daily_rate,
            total_price: totalPrice,
            is_internal: item.is_internal,
            sort_order: item.sort_order,
          }

          // Only include vehicle_id if it has a value to avoid PostgREST relationship issues
          // If clearing (setting to null), we'll do it in a separate minimal update
          if (item.vehicle_id !== null && item.vehicle_id !== undefined) {
            basePayload.vehicle_id = item.vehicle_id
          }

          // Update main fields (without vehicle_id if it's null)
          const { error: itemErr } = await supabase
            .from('offer_transport_items')
            .update(basePayload)
            .eq('id', item.id)

          if (itemErr) throw itemErr

          // If vehicle_id needs to be cleared, do it in a separate minimal update
          // Use select('id') to avoid PostgREST relationship embedding issues
          if (item.vehicle_id === null || item.vehicle_id === undefined) {
            const { error: clearErr } = await supabase
              .from('offer_transport_items')
              .update({ vehicle_id: null })
              .eq('id', item.id)
              .select('id') // Only select id to avoid relationship embedding

            if (clearErr) {
              // If clearing fails due to relationship issues, try using RPC or just log
              // The vehicle_id will remain as whatever it was before
              console.warn('Failed to clear vehicle_id:', clearErr)
              // Don't throw - the other fields were updated successfully
            }
          }
        } else {
          // For new items, only include vehicle_id if it has a value
          const insertPayload: any = {
            offer_id: workingOfferId,
            vehicle_name: item.vehicle_name,
            start_date: item.start_date,
            end_date: item.end_date,
            daily_rate: item.daily_rate,
            total_price: totalPrice,
            is_internal: item.is_internal,
            sort_order: item.sort_order,
          }

          // Only include vehicle_id if it has a value
          // Omitting null vehicle_id avoids PostgREST relationship embedding issues
          if (item.vehicle_id !== null && item.vehicle_id !== undefined) {
            insertPayload.vehicle_id = item.vehicle_id
          }

          const { error: itemErr } = await supabase
            .from('offer_transport_items')
            .insert(insertPayload)

          if (itemErr) throw itemErr
        }
      }

      // Recalculate totals (non-blocking - if it fails, offer is still saved)
      try {
        await recalculateOfferTotals(workingOfferId)
      } catch (recalcError) {
        // Log but don't fail the save - totals can be recalculated later
        console.warn('Failed to recalculate offer totals:', recalcError)
        // The offer is still saved successfully, just totals might be stale
      }

      return workingOfferId
    },
    onSuccess: async (savedOfferId) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', savedOfferId] })
      // Update current offer ID so we can show preview/lock buttons
      setCurrentOfferId(savedOfferId)
      success(
        isEditMode ? 'Offer updated' : 'Offer created',
        `Technical offer "${title.trim()}" was saved successfully.`,
      )
      // Close dialog after save
      onOpenChange(false)
      onSaved?.(savedOfferId)
    },
    onError: (e: any) => {
      toastError(
        'Failed to save offer',
        e?.message ?? 'Please check your inputs and try again.',
      )
    },
  })

  const lockOfferMutation = useMutation({
    mutationFn: lockOffer,
    onSuccess: async (_, lockedOfferId) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', lockedOfferId] })
      // Fetch updated offer to get access_token
      const updatedOffer = await qc.fetchQuery(offerDetailQuery(lockedOfferId))
      if (updatedOffer?.access_token) {
        const url = `${window.location.origin}/offer/${updatedOffer.access_token}`
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(url)
          success(
            'Offer locked and sent',
            `The offer has been locked. The link has been copied to your clipboard.`,
          )
          info('Offer link', `Link: ${url}`)
        } catch {
          success(
            'Offer locked and sent',
            `The offer has been locked. Share this link: ${url}`,
          )
        }
      } else {
        success(
          'Offer locked',
          'The offer has been locked and is ready to send.',
        )
      }
    },
    onError: (e: any) => {
      toastError('Failed to lock offer', e?.message ?? 'Please try again.')
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => {
      success('PDF exported', 'The offer has been exported as PDF.')
    },
    onError: (e: any) => {
      toastError('Failed to export PDF', e?.message ?? 'Please try again.')
    },
  })

  const handleLockAndSend = (offerIdToLock: string) => {
    // If no offer ID yet, save first
    if (!currentOfferId) {
      info('Save required', 'Please save the offer first before locking it.')
      return
    }
    lockOfferMutation.mutate(offerIdToLock)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="1200px"
        style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}
      >
        <Dialog.Title>
          {isEditMode ? 'Edit Technical Offer' : 'Create Technical Offer'}
        </Dialog.Title>
        <Separator my="2" />

        <Tabs.Root defaultValue="metadata" style={{ flex: 1, minHeight: 0 }}>
          <Tabs.List>
            <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
            <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
            <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
            <Tabs.Trigger value="transport">Transport</Tabs.Trigger>
            <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
          </Tabs.List>

          <Box style={{ flex: 1, overflowY: 'auto', paddingTop: '16px' }}>
            {/* Metadata Tab */}
            <Tabs.Content value="metadata">
              <Flex direction="column" gap="3">
                <Field label="Title">
                  <Flex gap="2" align="center">
                    <TextField.Root
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter offer title"
                      readOnly={isReadOnly}
                      style={{ flex: 1 }}
                    />
                    {!isReadOnly && !isEditMode && defaultTitle && (
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => setTitle(defaultTitle)}
                        disabled={title === defaultTitle}
                      >
                        Reset
                      </Button>
                    )}
                  </Flex>
                </Field>

                <Flex gap="3" wrap="wrap">
                  <Field label="Days of Use">
                    <TextField.Root
                      type="number"
                      min="1"
                      value={String(daysOfUse)}
                      onChange={(e) =>
                        setDaysOfUse(Math.max(1, Number(e.target.value) || 1))
                      }
                      readOnly={isReadOnly}
                    />
                  </Field>

                  <Field label="Discount (%)">
                    <TextField.Root
                      type="number"
                      min="0"
                      max="100"
                      value={String(discountPercent)}
                      onChange={(e) =>
                        setDiscountPercent(
                          Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      readOnly={isReadOnly}
                    />
                  </Field>

                  <Field label="VAT (%)">
                    <TextField.Root
                      type="number"
                      min="0"
                      max="100"
                      value={String(vatPercent)}
                      onChange={(e) =>
                        setVatPercent(
                          Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        )
                      }
                      readOnly={isReadOnly}
                    />
                  </Field>
                </Flex>
              </Flex>
            </Tabs.Content>

            {/* Equipment Tab */}
            <Tabs.Content
              value="equipment"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
              }}
            >
              <EquipmentSection
                groups={equipmentGroups}
                onGroupsChange={setEquipmentGroups}
                expandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                companyId={companyId}
                readOnly={isReadOnly}
              />
            </Tabs.Content>

            {/* Crew Tab */}
            <Tabs.Content value="crew">
              <CrewSection
                items={crewItems}
                onItemsChange={setCrewItems}
                companyId={companyId}
                readOnly={isReadOnly}
              />
            </Tabs.Content>

            {/* Transport Tab */}
            <Tabs.Content value="transport">
              <TransportSection
                items={transportItems}
                onItemsChange={setTransportItems}
                companyId={companyId}
                readOnly={isReadOnly}
              />
            </Tabs.Content>

            {/* Totals Tab */}
            <Tabs.Content value="totals">
              <TotalsSection totals={totals} />
            </Tabs.Content>
          </Box>
        </Tabs.Root>

        <Flex justify="between" align="center" mt="3">
          <Flex gap="2">
            {existingOffer?.access_token && (
              <>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    const url = `${window.location.origin}/offer/${existingOffer.access_token}`
                    window.open(url, '_blank')
                  }}
                  disabled={
                    !existingOffer.access_token ||
                    existingOffer.status === 'draft'
                  }
                  title={
                    existingOffer.status === 'draft'
                      ? 'Draft offers can be previewed after they are sent'
                      : 'Preview offer as customer will see it'
                  }
                >
                  <Eye width={14} height={14} />
                  Show Preview
                </Button>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => {
                    exportPdfMutation.mutate(existingOffer.id)
                  }}
                  disabled={exportPdfMutation.isPending}
                >
                  <Download width={14} height={14} />
                  Export PDF
                </Button>
                {!existingOffer.locked && (
                  <Button
                    size="2"
                    variant="soft"
                    color="blue"
                    onClick={() => {
                      handleLockAndSend(existingOffer.id)
                    }}
                    disabled={lockOfferMutation.isPending}
                  >
                    <Lock width={14} height={14} />
                    Lock & Send
                  </Button>
                )}
              </>
            )}
          </Flex>
          <Flex gap="2">
            <Dialog.Close>
              <Button variant="soft">{isReadOnly ? 'Close' : 'Cancel'}</Button>
            </Dialog.Close>
            {!isReadOnly && (
              <Button
                variant="classic"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !title.trim()}
              >
                {saveMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                    ? 'Save Draft'
                    : 'Create Offer'}
              </Button>
            )}
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Search field with fixed-position dropdown
function ItemSearchField({
  searchTerm,
  onSearchChange,
  searchResults,
  onSelectItem,
  formatCurrency,
}: {
  searchTerm: string
  onSearchChange: (term: string) => void
  searchResults: Array<{ id: string; name: string; price: number | null }>
  onSelectItem: (itemId: string) => void
  formatCurrency: (amount: number) => string
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  // Update dropdown position when search term or results change
  React.useEffect(() => {
    if (!searchTerm || searchResults.length === 0) {
      setDropdownPosition(null)
      return
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const updatePosition = () => {
      if (containerRef.current) {
        const input = containerRef.current.querySelector('input')
        if (input) {
          const rect = input.getBoundingClientRect()
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
          })
        }
      }
    }

    // Try immediately, then with a small delay to ensure layout is ready
    updatePosition()
    const timer = setTimeout(updatePosition, 10)

    return () => clearTimeout(timer)
  }, [searchTerm, searchResults.length])

  return (
    <Box mb="3" ref={containerRef} style={{ position: 'relative' }}>
      <TextField.Root
        placeholder="Search items to add..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {dropdownPosition && searchResults.length > 0 && (
        <Box
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 10000,
            backgroundColor: 'var(--color-panel-solid)',
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            maxHeight: 'min(400px, 50vh)',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {searchResults.map((item) => (
            <Box
              key={item.id}
              p="2"
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-4)',
                backgroundColor: 'transparent',
              }}
              onClick={() => onSelectItem(item.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Flex justify="between">
                <Text>{item.name}</Text>
                {item.price !== null && (
                  <Text size="2" color="gray">
                    {formatCurrency(item.price)}
                  </Text>
                )}
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// Equipment Section Component
function EquipmentSection({
  groups,
  onGroupsChange,
  expandedGroups,
  onExpandedGroupsChange,
  companyId,
  readOnly = false,
}: {
  groups: Array<LocalEquipmentGroup>
  onGroupsChange: (groups: Array<LocalEquipmentGroup>) => void
  expandedGroups: Set<string>
  onExpandedGroupsChange: (groups: Set<string>) => void
  companyId: string
  readOnly?: boolean
}) {
  // Track search state per group
  const [searchTerms, setSearchTerms] = React.useState<Map<string, string>>(
    new Map(),
  )
  const [activeSearchGroupId, setActiveSearchGroupId] = React.useState<
    string | null
  >(null)
  const [searchResults, setSearchResults] = React.useState<
    Array<{ id: string; name: string; price: number | null }>
  >([])

  const groupNameSuggestions = ['Audio', 'Lights', 'Rigging', 'AV', 'General']

  // Get search term for a specific group
  const getSearchTerm = (groupId: string) => {
    return searchTerms.get(groupId) || ''
  }

  // Set search term for a specific group
  const setSearchTerm = (groupId: string, term: string) => {
    const newTerms = new Map(searchTerms)
    newTerms.set(groupId, term)
    setSearchTerms(newTerms)
    setActiveSearchGroupId(groupId) // Track which group is being searched
  }

  // Search for items
  const searchItems = React.useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }

      const { data, error } = await supabase
        .from('items')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .ilike('name', `%${term}%`)
        .limit(20)

      if (error) {
        console.error('Search error:', error)
        return
      }

      const ids = data.map((r) => r.id)
      let prices: Record<string, number | null> = {}
      if (ids.length) {
        const { data: cp } = await supabase
          .from('item_current_price')
          .select('item_id, current_price')
          .in('item_id', ids)

        if (cp) {
          prices = cp.reduce((acc: Record<string, number | null>, r) => {
            if (r.item_id != null) {
              acc[r.item_id] = r.current_price
            }
            return acc
          }, {})
        }
      }

      setSearchResults(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          price: r.id ? (prices[r.id] ?? null) : null,
        })),
      )
    },
    [companyId],
  )

  const addGroup = () => {
    const newGroup: LocalEquipmentGroup = {
      id: `temp-${Date.now()}`,
      group_name: '',
      sort_order: groups.length,
      items: [],
    }
    onGroupsChange([...groups, newGroup])
    onExpandedGroupsChange(new Set([...expandedGroups, newGroup.id]))
  }

  const updateGroup = (
    groupId: string,
    updates: Partial<LocalEquipmentGroup>,
  ) => {
    onGroupsChange(
      groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    )
  }

  const deleteGroup = (groupId: string) => {
    onGroupsChange(groups.filter((g) => g.id !== groupId))
    const next = new Set(expandedGroups)
    next.delete(groupId)
    onExpandedGroupsChange(next)
  }

  const addItemToGroup = (groupId: string, itemId?: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    const selectedItem = searchResults.find((r) => r.id === itemId)
    const newItem: LocalEquipmentItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      item_id: itemId || null,
      quantity: 1,
      unit_price: selectedItem?.price || 0,
      is_internal: true,
      sort_order: group.items.length,
      item: selectedItem
        ? {
            id: selectedItem.id,
            name: selectedItem.name,
            externally_owned: false,
            external_owner_id: null,
          }
        : null,
    }

    updateGroup(groupId, {
      items: [...group.items, newItem],
    })
    setSearchTerm(groupId, '')
    setActiveSearchGroupId(null)
    setSearchResults([])
  }

  // Derive active search term for dependency tracking
  const activeSearchTerm = React.useMemo(() => {
    if (!activeSearchGroupId) return ''
    return searchTerms.get(activeSearchGroupId) || ''
  }, [activeSearchGroupId, searchTerms])

  // Search effect - trigger search when active group's search term changes
  React.useEffect(() => {
    if (!activeSearchGroupId) {
      if (activeSearchTerm.trim() === '') {
        setSearchResults([])
      }
      return
    }

    if (!activeSearchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(() => {
      // Double-check the term hasn't changed and we're still on the same group
      const currentTerm = searchTerms.get(activeSearchGroupId) || ''
      if (
        activeSearchGroupId &&
        currentTerm.trim() === activeSearchTerm.trim()
      ) {
        searchItems(activeSearchTerm.trim())
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [activeSearchGroupId, activeSearchTerm, searchTerms, searchItems])

  const updateItem = (
    groupId: string,
    itemId: string,
    updates: Partial<LocalEquipmentItem>,
  ) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    })
  }

  const deleteItem = (groupId: string, itemId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    updateGroup(groupId, {
      items: group.items.filter((item) => item.id !== itemId),
    })
  }

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups)
    if (next.has(groupId)) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    onExpandedGroupsChange(next)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex
      direction="column"
      gap="3"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Flex justify="between" align="center" style={{ flexShrink: 0 }}>
        <Heading size="3">Equipment</Heading>
        {!readOnly && (
          <Button size="2" onClick={addGroup}>
            <Plus width={16} height={16} /> Add Group
          </Button>
        )}
      </Flex>

      {groups.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="2" color="gray">
            No equipment groups yet. Add your first group to get started.
          </Text>
        </Box>
      ) : (
        <Flex
          direction="column"
          gap="2"
          style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        >
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const groupTotal = group.items.reduce(
              (sum, item) => sum + item.unit_price * item.quantity,
              0,
            )

            return (
              <Box
                key={group.id}
                style={{
                  border: '1px solid var(--gray-a5)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <Box
                  p="3"
                  style={{
                    background: 'var(--gray-a2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleGroup(group.id)}
                >
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                      {isExpanded ? (
                        <NavArrowDown width={18} height={18} />
                      ) : (
                        <NavArrowRight width={18} height={18} />
                      )}
                      <TextField.Root
                        value={group.group_name}
                        onChange={(e) => {
                          e.stopPropagation()
                          updateGroup(group.id, { group_name: e.target.value })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter group name"
                        style={{ width: 200 }}
                        readOnly={readOnly}
                      />
                      <Text size="2" color="gray">
                        ({group.items.length} items)
                      </Text>
                    </Flex>
                    <Flex align="center" gap="3">
                      <Text weight="medium">{formatCurrency(groupTotal)}</Text>
                      {!readOnly && (
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteGroup(group.id)
                          }}
                        >
                          <Trash width={14} height={14} />
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Box>

                {isExpanded && (
                  <Box p="3" style={{ background: 'var(--gray-a1)' }}>
                    {/* Group name suggestions */}
                    {!readOnly && !group.group_name && (
                      <Box mb="3">
                        <Text size="1" color="gray" mb="1">
                          Group name suggestions:
                        </Text>
                        <Flex gap="2" wrap="wrap">
                          {groupNameSuggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              size="1"
                              variant="soft"
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateGroup(group.id, {
                                  group_name: suggestion,
                                })
                              }}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </Flex>
                      </Box>
                    )}
                    {/* Search for items */}
                    {!readOnly && (
                      <ItemSearchField
                        searchTerm={getSearchTerm(group.id)}
                        onSearchChange={(term) => setSearchTerm(group.id, term)}
                        searchResults={
                          activeSearchGroupId === group.id ? searchResults : []
                        }
                        onSelectItem={(itemId) =>
                          addItemToGroup(group.id, itemId)
                        }
                        formatCurrency={formatCurrency}
                      />
                    )}

                    {/* Items table */}
                    {group.items.length > 0 ? (
                      <Table.Root variant="surface" size="1">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell>
                              Item
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Unit Price
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>
                              Total
                            </Table.ColumnHeaderCell>
                            {!readOnly && <Table.ColumnHeaderCell />}
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {group.items.map((item) => (
                            <Table.Row key={item.id}>
                              <Table.Cell>
                                <Text>{item.item?.name || '—'}</Text>
                              </Table.Cell>
                              <Table.Cell>
                                <TextField.Root
                                  type="number"
                                  min="1"
                                  value={String(item.quantity)}
                                  onChange={(e) =>
                                    updateItem(group.id, item.id, {
                                      quantity: Math.max(
                                        1,
                                        Number(e.target.value) || 1,
                                      ),
                                    })
                                  }
                                  style={{ width: 80 }}
                                  readOnly={readOnly}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                <TextField.Root
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(item.unit_price)}
                                  onChange={(e) =>
                                    updateItem(group.id, item.id, {
                                      unit_price: Math.max(
                                        0,
                                        Number(e.target.value) || 0,
                                      ),
                                    })
                                  }
                                  style={{ width: 120 }}
                                  readOnly={readOnly}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                <Text>
                                  {formatCurrency(
                                    item.unit_price * item.quantity,
                                  )}
                                </Text>
                              </Table.Cell>
                              {!readOnly && (
                                <Table.Cell align="right">
                                  <Button
                                    size="1"
                                    variant="soft"
                                    color="red"
                                    onClick={() =>
                                      deleteItem(group.id, item.id)
                                    }
                                  >
                                    <Trash width={14} height={14} />
                                  </Button>
                                </Table.Cell>
                              )}
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    ) : (
                      <Text size="2" color="gray">
                        No items in this group. Search above to add items.
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            )
          })}
        </Flex>
      )}
    </Flex>
  )
}

// Crew Section Component
function CrewSection({
  items,
  onItemsChange,
  companyId: _companyId,
  readOnly = false,
}: {
  items: Array<LocalCrewItem>
  onItemsChange: (items: Array<LocalCrewItem>) => void
  companyId: string
  readOnly?: boolean
}) {
  const addItem = () => {
    const now = new Date()
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // +1 day

    const newItem: LocalCrewItem = {
      id: `temp-${Date.now()}`,
      role_title: '',
      crew_count: 1,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      daily_rate: 0,
      sort_order: items.length,
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (itemId: string, updates: Partial<LocalCrewItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    )
  }

  const deleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Crew</Heading>
        {!readOnly && (
          <Button size="2" onClick={addItem}>
            <Plus width={16} height={16} /> Add Crew Item
          </Button>
        )}
      </Flex>

      {items.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="2" color="gray">
            No crew items yet. Add your first crew item to get started.
          </Text>
        </Box>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Crew Count</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Start Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>End Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Daily Rate</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
              {!readOnly && <Table.ColumnHeaderCell />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => {
              const days = Math.ceil(
                (new Date(item.end_date).getTime() -
                  new Date(item.start_date).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
              const total =
                item.daily_rate * item.crew_count * Math.max(1, days)

              return (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <TextField.Root
                      value={item.role_title}
                      onChange={(e) =>
                        updateItem(item.id, { role_title: e.target.value })
                      }
                      placeholder="e.g., Technician"
                      readOnly={readOnly}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <TextField.Root
                      type="number"
                      min="1"
                      value={String(item.crew_count)}
                      onChange={(e) =>
                        updateItem(item.id, {
                          crew_count: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      style={{ width: 80 }}
                      readOnly={readOnly}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {readOnly ? (
                      <Text>
                        {item.start_date
                          ? new Date(item.start_date).toLocaleDateString(
                              'nb-NO',
                            )
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.start_date}
                        onChange={(value) =>
                          updateItem(item.id, { start_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {readOnly ? (
                      <Text>
                        {item.end_date
                          ? new Date(item.end_date).toLocaleDateString('nb-NO')
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.end_date}
                        onChange={(value) =>
                          updateItem(item.id, { end_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <TextField.Root
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(item.daily_rate)}
                      onChange={(e) =>
                        updateItem(item.id, {
                          daily_rate: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      style={{ width: 120 }}
                      readOnly={readOnly}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatCurrency(total)}</Text>
                  </Table.Cell>
                  {!readOnly && (
                    <Table.Cell align="right">
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    </Table.Cell>
                  )}
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Flex>
  )
}

// Transport Section Component
function TransportSection({
  items,
  onItemsChange,
  companyId,
  readOnly = false,
}: {
  items: Array<LocalTransportItem>
  onItemsChange: (items: Array<LocalTransportItem>) => void
  companyId: string
  readOnly?: boolean
}) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<
    Array<{ id: string; name: string }>
  >([])

  // Search for vehicles
  const searchVehicles = React.useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }

      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name')
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')
        .ilike('name', `%${term}%`)
        .limit(20)

      if (error) {
        console.error('Search error:', error)
        return
      }

      setSearchResults(data)
    },
    [companyId],
  )

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      searchVehicles(searchTerm)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm, searchVehicles])

  const addItem = () => {
    const now = new Date()
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // +1 day

    const newItem: LocalTransportItem = {
      id: `temp-${Date.now()}`,
      vehicle_name: '',
      vehicle_id: null,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      daily_rate: 0,
      is_internal: true,
      sort_order: items.length,
    }
    onItemsChange([...items, newItem])
  }

  const updateItem = (itemId: string, updates: Partial<LocalTransportItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    )
  }

  const deleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Transport</Heading>
        {!readOnly && (
          <Button size="2" onClick={addItem}>
            <Plus width={16} height={16} /> Add Transport Item
          </Button>
        )}
      </Flex>

      {items.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="2" color="gray">
            No transport items yet. Add your first transport item to get
            started.
          </Text>
        </Box>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Vehicle</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Start Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>End Date</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Daily Rate</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
              {!readOnly && <Table.ColumnHeaderCell />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => {
              const days = Math.ceil(
                (new Date(item.end_date).getTime() -
                  new Date(item.start_date).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
              const total = item.daily_rate * Math.max(1, days)

              return (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <Box style={{ position: 'relative' }}>
                      <TextField.Root
                        value={item.vehicle_name}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          updateItem(item.id, { vehicle_name: e.target.value })
                        }}
                        placeholder="Search or enter vehicle name"
                        readOnly={readOnly}
                      />
                      {searchResults.length > 0 && searchTerm && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            background: 'var(--gray-a1)',
                            border: '1px solid var(--gray-a5)',
                            borderRadius: 4,
                            marginTop: 4,
                            maxHeight: 200,
                            overflowY: 'auto',
                          }}
                        >
                          {searchResults.map((vehicle) => (
                            <Box
                              key={vehicle.id}
                              p="2"
                              style={{
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--gray-a4)',
                              }}
                              onClick={() => {
                                updateItem(item.id, {
                                  vehicle_name: vehicle.name,
                                  vehicle_id: vehicle.id,
                                })
                                setSearchTerm('')
                                setSearchResults([])
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  'var(--gray-a2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                              }}
                            >
                              <Text>{vehicle.name}</Text>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    {readOnly ? (
                      <Text>
                        {item.start_date
                          ? new Date(item.start_date).toLocaleDateString(
                              'nb-NO',
                            )
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.start_date}
                        onChange={(value) =>
                          updateItem(item.id, { start_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {readOnly ? (
                      <Text>
                        {item.end_date
                          ? new Date(item.end_date).toLocaleDateString('nb-NO')
                          : '—'}
                      </Text>
                    ) : (
                      <DateTimePicker
                        value={item.end_date}
                        onChange={(value) =>
                          updateItem(item.id, { end_date: value })
                        }
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <TextField.Root
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(item.daily_rate)}
                      onChange={(e) =>
                        updateItem(item.id, {
                          daily_rate: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      style={{ width: 120 }}
                      readOnly={readOnly}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatCurrency(total)}</Text>
                  </Table.Cell>
                  {!readOnly && (
                    <Table.Cell align="right">
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    </Table.Cell>
                  )}
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Flex>
  )
}

// Totals Section Component
function TotalsSection({
  totals,
}: {
  totals: ReturnType<typeof calculateOfferTotals>
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Flex direction="column" gap="3">
      <Heading size="3">Totals</Heading>
      <Table.Root variant="surface">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Equipment Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.equipmentSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Crew Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.crewSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Transport Subtotal</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.transportSubtotal)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total Before Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalBeforeDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Discount ({totals.discountPercent}%)</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text color="red">
                -
                {formatCurrency(
                  totals.totalBeforeDiscount - totals.totalAfterDiscount,
                )}
              </Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">Total After Discount</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>{formatCurrency(totals.totalAfterDiscount)}</Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text weight="medium">VAT ({totals.vatPercent}%)</Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text>
                {formatCurrency(
                  totals.totalWithVAT - totals.totalAfterDiscount,
                )}
              </Text>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>
              <Text size="4" weight="bold">
                Total With VAT
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text size="4" weight="bold">
                {formatCurrency(totals.totalWithVAT)}
              </Text>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Flex>
  )
}

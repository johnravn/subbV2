// src/features/jobs/components/dialogs/BookItemsDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { categoryNamesQuery } from '@features/inventory/api/queries'
import { jobTimePeriodsQuery } from '@features/jobs/api/queries'
import TimePeriodPicker from '@features/calendar/components/reservations/TimePeriodPicker'
import type { UUID } from '../../types'

const ALL = '__ALL__'

// Picker result row (unified: item or group)
type PickerRow =
  | {
      kind: 'item'
      id: UUID
      name: string
      category_name: string | null
      brand_name: string | null
      on_hand: number | null
      current_price: number | null
      internally_owned: boolean
      external_owner_name: string | null
      active: boolean
      is_group: false
      unique?: boolean
    }
  | {
      kind: 'group'
      id: UUID
      name: string
      category_name: string | null
      // groups don’t have brand/price/on_hand per se; keep nulls to align columns
      brand_name: null
      on_hand: null
      current_price: null
      internally_owned: true // groups are internal kits by definition
      external_owner_name: null
      active: boolean
      is_group: true
      unique: boolean | null
    }

// Selection basket row
type Row =
  | {
      kind: 'item'
      item_id: UUID
      name: string
      quantity: number
      on_hand: number | null
    }
  | {
      kind: 'group'
      group_id: UUID
      name: string
      quantity: number
      on_hand: number | null
    }

export default function BookItemsDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  timePeriodId: initialTimePeriodId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
  timePeriodId?: UUID | null
  onSaved?: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [rows, setRows] = React.useState<Array<Row>>([])
  const [selectedTimePeriodId, setSelectedTimePeriodId] = React.useState<
    string | null
  >(initialTimePeriodId ?? null)
  const [message, setMessage] = React.useState<{
    type: 'error' | 'warning' | 'info'
    text: string
  } | null>(null)
  const { success, error } = useToast()

  // Fetch time periods to find default
  const { data: timePeriods = [] } = useQuery({
    ...jobTimePeriodsQuery({ jobId }),
    enabled: open,
  })

  // Set default time period when dialog opens
  React.useEffect(() => {
    if (!open || initialTimePeriodId || selectedTimePeriodId) return

    // Find "Equipment period" or "Job duration"
    const equipmentPeriod = timePeriods.find((tp) =>
      tp.title?.toLowerCase().includes('equipment period'),
    )
    const jobDuration = timePeriods.find((tp) =>
      tp.title?.toLowerCase().includes('job duration'),
    )

    const defaultPeriod = equipmentPeriod || jobDuration
    if (defaultPeriod) {
      setSelectedTimePeriodId(defaultPeriod.id)
    }
  }, [open, timePeriods, initialTimePeriodId, selectedTimePeriodId])

  // Update local state when prop changes
  React.useEffect(() => {
    if (initialTimePeriodId) {
      setSelectedTimePeriodId(initialTimePeriodId)
    }
  }, [initialTimePeriodId])

  // Clear message when dialog closes
  React.useEffect(() => {
    if (!open) {
      setMessage(null)
    }
  }, [open])

  // "External only" filter (items whose external_owner_id is set)
  const [externalOnly, setExternalOnly] = React.useState(false)

  // Category filter
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )

  const { data: categories = [] } = useQuery({
    ...categoryNamesQuery({ companyId }),
    enabled: open,
  })

  const { data: picker = [], isFetching } = useQuery({
    queryKey: ['book-items', companyId, search, externalOnly, categoryFilter],
    enabled: open,
    queryFn: async (): Promise<Array<PickerRow>> => {
      // Fetch both items and groups from inventory_index
      let q = supabase
        .from('inventory_index')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .limit(100)

      // For items, filter by allow_individual_booking
      // For groups, always include them
      // Combined: (is_group=true) OR (allow_individual_booking=true)
      q = q.or('is_group.eq.true,allow_individual_booking.eq.true')

      if (search) q = q.ilike('name', `%${search}%`)
      if (categoryFilter) q = q.eq('category_name', categoryFilter)
      if (externalOnly) q = q.eq('internally_owned', false)

      const { data, error: fetchError } = await q
      if (fetchError) throw fetchError

      // Map to PickerRow - separate items from groups
      return data.map((r: any): PickerRow => {
        if (r.is_group) {
          return {
            kind: 'group',
            id: r.id,
            name: r.name,
            category_name: r.category_name ?? null,
            brand_name: null,
            on_hand: r.on_hand ?? null,
            current_price: r.current_price ?? null,
            internally_owned: true,
            external_owner_name: null,
            active: !!r.active,
            is_group: true,
            unique: r.unique ?? null,
          }
        } else {
          return {
            kind: 'item',
            id: r.id,
            name: r.name,
            category_name: r.category_name ?? null,
            brand_name: r.brand_name ?? null,
            on_hand: r.on_hand ?? null,
            current_price: r.current_price ?? null,
            internally_owned: !!r.internally_owned,
            external_owner_name: r.external_owner_name ?? null,
            active: !!r.active,
            is_group: false,
          }
        }
      })
    },
  })

  // const add = (it: PickerItem) => {
  //   setRows((r) => {
  //     const i = r.findIndex((x) => x.item_id === it.id)
  //     if (i >= 0) {
  //       const clone = [...r]
  //       clone[i].quantity += 1
  //       return clone
  //     }
  //     return [...r, { item_id: it.id, name: it.name, quantity: 1 }]
  //   })
  // }
  function addRow(p: PickerRow) {
    // Check availability
    const onHand = p.on_hand ?? 0

    // Pre-validate before updating state
    const currentRow =
      p.kind === 'item'
        ? rows.find((x) => x.kind === 'item' && x.item_id === p.id)
        : rows.find((x) => x.kind === 'group' && x.group_id === p.id)

    if (currentRow) {
      const newQty = currentRow.quantity + 1
      if (onHand > 0 && newQty > onHand) {
        setMessage({
          type: 'error',
          text: `Only ${onHand} ${p.name} available. Already booking ${currentRow.quantity}.`,
        })
        return
      }
    } else {
      // Adding new item/group
      if (onHand > 0 && 1 > onHand) {
        setMessage({
          type: 'error',
          text: `Only ${onHand} ${p.name} available.`,
        })
        return
      }
    }

    // Clear any previous messages on success
    setMessage(null)

    setRows((r) => {
      if (p.kind === 'item') {
        const i = r.findIndex((x) => x.kind === 'item' && x.item_id === p.id)
        if (i >= 0) {
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: clone[i].quantity + 1 } as Row
          return clone
        }
        return [
          ...r,
          {
            kind: 'item',
            item_id: p.id,
            name: p.name,
            quantity: 1,
            on_hand: onHand,
          },
        ]
      } else {
        const i = r.findIndex((x) => x.kind === 'group' && x.group_id === p.id)
        if (i >= 0) {
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: clone[i].quantity + 1 } as Row
          return clone
        }
        return [
          ...r,
          {
            kind: 'group',
            group_id: p.id,
            name: p.name,
            quantity: 1,
            on_hand: onHand,
          },
        ]
      }
    })
  }

  function updateQty(target: Row, qty: number, maxAvailable: number | null) {
    // Validate against available quantity
    if (maxAvailable !== null && maxAvailable > 0 && qty > maxAvailable) {
      setMessage({
        type: 'error',
        text: `Only ${maxAvailable} available. Cannot book ${qty}.`,
      })
      return
    }

    // Clear any previous messages on success
    setMessage(null)

    setRows((prevRows) =>
      prevRows.map((x) =>
        rowKey(x) === rowKey(target) ? ({ ...x, quantity: qty } as Row) : x,
      ),
    )
  }
  function removeRow(target: Row) {
    setRows((prevRows) => prevRows.filter((x) => rowKey(x) !== rowKey(target)))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (rows.length === 0) return

      // Time period is now required
      if (!selectedTimePeriodId) {
        throw new Error('Please select a time period')
      }

      const itemRows: Array<Extract<Row, { kind: 'item' }>> = rows.filter(
        (r): r is Extract<Row, { kind: 'item' }> => r.kind === 'item',
      )
      const groupRows: Array<Extract<Row, { kind: 'group' }>> = rows.filter(
        (r): r is Extract<Row, { kind: 'group' }> => r.kind === 'group',
      )

      // Fetch job details for duration times
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .select('start_at, end_at')
        .eq('id', jobId)
        .single()
      if (jobErr) throw jobErr

      // Fetch all time periods for this job
      const { data: existingTimePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr

      // Map of item_id -> external_owner info
      const itemOwnerMap = new Map<
        string,
        { owner_id: string | null; owner_name: string | null }
      >()

      // Fetch item details to get external_owner_id and owner names
      if (itemRows.length > 0) {
        const itemIds = itemRows.map((r) => r.item_id)
        const { data: itemDetails, error: itemErr } = await supabase
          .from('items')
          .select(
            'id, external_owner_id, external_owner:external_owner_id(id, name)',
          )
          .in('id', itemIds)
        if (itemErr) throw itemErr

        for (const item of itemDetails) {
          const ownerData = Array.isArray(item.external_owner)
            ? item.external_owner[0]
            : item.external_owner
          itemOwnerMap.set(item.id, {
            owner_id: item.external_owner_id,
            owner_name: ownerData.name ?? null,
          })
        }
      }

      // Create time periods for external owners if needed
      const ownerTimePeriodMap = new Map<string, string>() // owner_id -> time_period_id

      for (const ownerInfo of itemOwnerMap.values()) {
        if (!ownerInfo.owner_id || !ownerInfo.owner_name) continue
        if (ownerTimePeriodMap.has(ownerInfo.owner_id)) continue // Already processed

        const expectedTitle = `${ownerInfo.owner_name} Equipment period`
        let tp = existingTimePeriods.find((t) => t.title === expectedTitle)

        if (!tp) {
          // Create the time period
          const { data: newTp, error: createErr } = await supabase
            .from('time_periods')
            .insert({
              job_id: jobId,
              company_id: companyId,
              title: expectedTitle,
              start_at: job.start_at,
              end_at: job.end_at,
            })
            .select('id, title')
            .single()
          if (createErr) throw createErr
          tp = newTp
          existingTimePeriods.push(newTp)
        }

        ownerTimePeriodMap.set(ownerInfo.owner_id, tp.id)
      }

      // Collect all time period IDs we'll be using
      const allTimePeriodIds = new Set<string>([selectedTimePeriodId])
      for (const tpId of ownerTimePeriodMap.values()) {
        allTimePeriodIds.add(tpId)
      }

      // 1) Fetch existing reserved_items for all relevant time periods
      const { data: existingReservations, error: fetchErr } = await supabase
        .from('reserved_items')
        .select(
          'id, item_id, quantity, source_kind, source_group_id, time_period_id',
        )
        .in('time_period_id', Array.from(allTimePeriodIds))

      if (fetchErr) throw fetchErr

      // Create a lookup map for existing reservations
      // Key format: "item_id:source_kind:source_group_id:time_period_id"
      const existingMap = new Map<string, { id: string; quantity: number }>()
      for (const res of existingReservations) {
        const key = `${res.item_id}:${res.source_kind}:${res.source_group_id || 'null'}:${res.time_period_id}`
        existingMap.set(key, { id: res.id, quantity: res.quantity })
      }

      // 2) build payload for items - use owner-specific time periods for external items
      const itemPayload = itemRows.map((r) => {
        const ownerInfo = itemOwnerMap.get(r.item_id)
        const isExternal = ownerInfo?.owner_id
        const tpId = isExternal
          ? ownerTimePeriodMap.get(ownerInfo.owner_id!)
          : selectedTimePeriodId

        return {
          time_period_id: tpId,
          item_id: r.item_id,
          quantity: r.quantity,
          source_kind: 'direct' as const,
          source_group_id: null,
        }
      })
      const groupPayload: Array<any> = []
      if (groupRows.length > 0) {
        // fetch group members in one round trip
        const { data: groupMembers, error: gmErr } = await supabase
          .from('group_items')
          .select('group_id, item_id, quantity')
          .in(
            'group_id',
            groupRows.map((g) => g.group_id),
          )
        if (gmErr) throw gmErr

        const byGroup = new Map<
          string,
          Array<{ item_id: string; quantity: number }>
        >()
        for (const m of groupMembers) {
          const arr = byGroup.get(m.group_id) ?? []
          arr.push({ item_id: m.item_id, quantity: m.quantity })
          byGroup.set(m.group_id, arr)
        }

        for (const g of groupRows) {
          const groupItems = byGroup.get(g.group_id) ?? []
          for (const m of groupItems) {
            groupPayload.push({
              time_period_id: selectedTimePeriodId, // Groups are always internal
              item_id: m.item_id,
              quantity: m.quantity * g.quantity, // scale
              source_kind: 'group' as const,
              source_group_id: g.group_id,
            })
          }
        }
      }

      const payload = [...itemPayload, ...groupPayload]
      if (payload.length === 0) return

      // 3) Split into updates and inserts
      const toUpdate: Array<{ id: string; quantity: number }> = []
      const toInsert: Array<any> = []

      for (const item of payload) {
        const key = `${item.item_id}:${item.source_kind}:${item.source_group_id || 'null'}:${item.time_period_id}`
        const existing = existingMap.get(key)

        if (existing) {
          // Update existing reservation by adding quantities
          toUpdate.push({
            id: existing.id,
            quantity: existing.quantity + item.quantity,
          })
        } else {
          // Insert new reservation
          toInsert.push(item)
        }
      }

      // 4) Execute updates
      for (const update of toUpdate) {
        const { error: updateErr } = await supabase
          .from('reserved_items')
          .update({ quantity: update.quantity })
          .eq('id', update.id)
        if (updateErr) throw updateErr
      }

      // 5) Execute inserts
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('reserved_items')
          .insert(toInsert)
        if (insErr) throw insErr
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      onOpenChange(false)
      onSaved?.()
      setRows([])
      success('Success', 'Items are reserved')
    },
    onError: (e: any) => {
      error('Failed to update', e?.hint || e?.message || 'Please try again.')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="90%"
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>Book equipment</Dialog.Title>

        {/* Top section: Time Period Picker + Messages */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '65fr 35fr',
            gap: 16,
            marginTop: 8,
            alignItems: 'stretch',
          }}
        >
          {/* LEFT: Time Period Picker */}
          <TimePeriodPicker
            jobId={jobId}
            value={selectedTimePeriodId}
            onChange={setSelectedTimePeriodId}
          />

          {/* RIGHT: Message Area */}
          <div
            style={{
              transition: '100ms',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              background: message
                ? message.type === 'error'
                  ? 'var(--red-a3)'
                  : message.type === 'warning'
                    ? 'var(--amber-a3)'
                    : 'var(--blue-a3)'
                : 'var(--gray-a2)',
              border: message
                ? message.type === 'error'
                  ? '1px solid var(--red-a6)'
                  : message.type === 'warning'
                    ? '1px solid var(--amber-a6)'
                    : '1px solid var(--blue-a6)'
                : '1px solid var(--gray-a4)',
            }}
          >
            {message ? (
              <Text
                size="2"
                weight="medium"
                color={
                  message.type === 'error'
                    ? 'red'
                    : message.type === 'warning'
                      ? 'amber'
                      : 'blue'
                }
                style={{ textAlign: 'center' }}
              >
                {message.text}
              </Text>
            ) : (
              <Text size="2" color="gray" style={{ textAlign: 'center' }}>
                Messages will appear here
              </Text>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: '65fr 35fr',
            gap: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT: search & results */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            <Flex gap="2" align="center" wrap="wrap" mb="2">
              {/* category filter */}
              <Select.Root
                value={categoryFilter ?? ALL}
                onValueChange={(v) => setCategoryFilter(v === ALL ? null : v)}
              >
                <Select.Trigger placeholder="Filter category…" />
                <Select.Content>
                  <Select.Item value={ALL}>All</Select.Item>
                  {categories.map((name: string) => (
                    <Select.Item key={name} value={name}>
                      {name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>

              {/* External only toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={externalOnly}
                  onChange={(e) => setExternalOnly(e.target.checked)}
                />
                <Text as="span">External only</Text>
              </label>
            </Flex>
            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
            </TextField.Root>
            {isFetching ? (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner />
              </Flex>
            ) : picker.length === 0 ? (
              <Text color="gray">No results</Text>
            ) : (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>On hand</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {picker.map((r) => (
                    <Table.Row key={`${r.kind}:${r.id}`}>
                      {/* Name + badges */}
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <Text size="2" weight="medium">
                            {r.name}
                          </Text>
                          {r.is_group && (
                            <Badge size="1" variant="soft" color="pink">
                              Group
                            </Badge>
                          )}
                          {r.is_group && r.unique === true && (
                            <Badge size="1" variant="soft">
                              Unique
                            </Badge>
                          )}
                          {r.active === false && (
                            <Badge size="1" variant="soft" color="red">
                              Inactive
                            </Badge>
                          )}
                        </Flex>
                      </Table.Cell>

                      {/* Category */}
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {r.category_name ?? ''}
                        </Text>
                      </Table.Cell>

                      {/* Brand */}
                      <Table.Cell>
                        <Text size="2" color="gray">
                          {r.brand_name ?? ''}
                        </Text>
                      </Table.Cell>

                      {/* On hand */}
                      <Table.Cell>{r.on_hand ?? ''}</Table.Cell>

                      {/* Price */}
                      <Table.Cell>
                        {r.current_price != null
                          ? formatNOK(r.current_price)
                          : ''}
                      </Table.Cell>

                      {/* Owner */}
                      <Table.Cell>
                        {r.kind === 'item' ? (
                          r.internally_owned ? (
                            <Badge size="1" variant="soft" color="indigo">
                              Internal
                            </Badge>
                          ) : (
                            <Badge size="1" variant="soft" color="amber">
                              {r.external_owner_name ?? 'External'}
                            </Badge>
                          )
                        ) : (
                          <Badge size="1" variant="soft" color="indigo">
                            Internal
                          </Badge>
                        )}
                      </Table.Cell>

                      {/* Add */}
                      <Table.Cell align="right">
                        <Button
                          size="1"
                          variant="classic"
                          onClick={() => addRow(r)}
                        >
                          Add
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </div>

          {/* RIGHT: selection */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            {/* <div
              style={{
                padding: 8,
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={overrideTimes}
                  onChange={(e) => setOverrideTimes(e.target.checked)}
                />
                <span>Custom time window for these lines</span>
              </label>
              {overrideTimes && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <TextField.Root
                    type="datetime-local"
                    value={ovStart}
                    onChange={(e) => setOvStart(e.target.value)}
                  />
                  <TextField.Root
                    type="datetime-local"
                    value={ovEnd}
                    onChange={(e) => setOvEnd(e.target.value)}
                  />
                </div>
              )}
            </div> */}

            <Text size="2" color="gray">
              Selected
            </Text>
            {rows.length === 0 ? (
              <Text color="gray">Nothing selected yet.</Text>
            ) : (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ width: 110 }}>
                      Qty
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={rowKey(r)}>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <Text>{r.name}</Text>
                          {r.kind === 'group' && (
                            <Badge size="1" variant="soft" color="pink">
                              Group
                            </Badge>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <TextField.Root
                          type="number"
                          min="1"
                          max={r.on_hand ?? undefined}
                          value={String(r.quantity)}
                          onChange={(e) =>
                            updateQty(
                              r,
                              Math.max(1, Number(e.target.value || 1)),
                              r.on_hand,
                            )
                          }
                        />
                      </Table.Cell>
                      <Table.Cell align="right">
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={() => removeRow(r)}
                        >
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </div>
        </div>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={
              save.isPending || rows.length === 0 || !selectedTimePeriodId
            }
          >
            {save.isPending ? 'Booking…' : 'Book items'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function rowKey(r: Row) {
  return r.kind === 'item' ? `item:${r.item_id}` : `group:${r.group_id}`
}

function formatNOK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'NOK',
  }).format(Number(n))
}

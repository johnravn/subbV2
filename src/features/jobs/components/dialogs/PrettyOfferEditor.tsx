// src/features/jobs/components/dialogs/PrettyOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
  TextField,
  TextArea,
  Tabs,
  Select,
} from '@radix-ui/themes'
import {
  Plus,
  Trash,
  NavArrowDown,
  NavArrowRight,
  ArrowUp,
  ArrowDown,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  offerDetailQuery,
  createOffer,
  recalculateOfferTotals,
} from '../../api/offerQueries'
import { calculateOfferTotals } from '../../utils/offerCalculations'
import { companyExpansionQuery } from '@features/company/api/queries'
import type {
  OfferDetail,
  OfferEquipmentGroup,
  OfferEquipmentItem,
  OfferCrewItem,
  OfferTransportItem,
  OfferPrettySection,
  PrettySectionType,
  UUID,
} from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null
  onSaved?: (offerId: string) => void
}

type LocalPrettySection = {
  id: string
  section_type: PrettySectionType
  title: string | null
  content: string | null
  image_url: string | null
  sort_order: number
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

const SECTION_TYPE_LABELS: Record<PrettySectionType, string> = {
  hero: 'Hero',
  problem: 'Problem',
  solution: 'Solution',
  benefits: 'Benefits',
  testimonial: 'Testimonial',
}

export default function PrettyOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const isEditMode = !!offerId

  // Fetch existing offer if editing
  const { data: existingOffer, isLoading: isLoadingOffer } = useQuery({
    ...(offerId
      ? offerDetailQuery(offerId)
      : { queryKey: ['no-offer'], queryFn: () => null }),
    enabled: open && isEditMode,
  })

  // Fetch company expansion for vehicle rates
  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery(companyId),
    enabled: open && !!companyId,
  })

  const isReadOnly = existingOffer?.locked || false

  // Offer metadata
  const [title, setTitle] = React.useState('')
  const [daysOfUse, setDaysOfUse] = React.useState(1)
  const [discountPercent, setDiscountPercent] = React.useState(0)
  const [vatPercent, setVatPercent] = React.useState(25)

  // Pretty sections
  const [sections, setSections] = React.useState<Array<LocalPrettySection>>([])
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(),
  )

  // Initialize from existing offer
  React.useEffect(() => {
    if (!open) return
    // Wait for query to finish loading before initializing
    if (isLoadingOffer) return

    if (existingOffer && isEditMode) {
      setTitle(existingOffer.title)
      setDaysOfUse(existingOffer.days_of_use)
      setDiscountPercent(existingOffer.discount_percent)
      setVatPercent(existingOffer.vat_percent)

      // Convert pretty sections
      const prettySections: Array<LocalPrettySection> =
        existingOffer.pretty_sections?.map((section) => ({
          id: section.id,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          image_url: section.image_url,
          sort_order: section.sort_order,
        })) || []
      setSections(prettySections)
    } else {
      // Reset for new offer
      setTitle('')
      setDaysOfUse(1)
      setDiscountPercent(0)
      setVatPercent(25)
      setSections([])
      setExpandedSections(new Set())
    }
  }, [open, existingOffer, isEditMode, isLoadingOffer])

  // Calculate totals (pretty offers still have underlying equipment/crew/transport)
  const totals = React.useMemo(() => {
    if (!existingOffer) {
      return {
        equipmentSubtotal: 0,
        crewSubtotal: 0,
        transportSubtotal: 0,
        totalBeforeDiscount: 0,
        totalAfterDiscount: 0,
        totalWithVAT: 0,
        daysOfUse: daysOfUse,
        discountPercent: discountPercent,
        vatPercent: vatPercent,
      }
    }

    const equipmentItems: Array<OfferEquipmentItem> =
      existingOffer.groups?.flatMap((group) =>
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
      ) || []

    const crew: Array<OfferCrewItem> = existingOffer.crew_items || []
    const transport: Array<OfferTransportItem> =
      existingOffer.transport_items || []

    return calculateOfferTotals(
      equipmentItems,
      crew,
      transport,
      daysOfUse,
      discountPercent,
      vatPercent,
      companyExpansion?.vehicle_distance_rate,
      companyExpansion?.vehicle_distance_increment,
    )
  }, [existingOffer, daysOfUse, discountPercent, vatPercent, companyExpansion?.vehicle_distance_rate, companyExpansion?.vehicle_distance_increment])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error('Title is required')
      }

      let currentOfferId = offerId

      // Create offer if new
      if (!currentOfferId) {
        currentOfferId = await createOffer({
          jobId,
          companyId,
          offerType: 'pretty',
          title: title.trim(),
          daysOfUse,
          discountPercent,
          vatPercent,
        })
      } else {
        // Update offer metadata
        const { error } = await supabase
          .from('job_offers')
          .update({
            title: title.trim(),
            days_of_use: daysOfUse,
            discount_percent: discountPercent,
            vat_percent: vatPercent,
          })
          .eq('id', currentOfferId)

        if (error) throw error
      }

      // Delete existing sections if editing
      if (isEditMode && existingOffer?.pretty_sections) {
        if (existingOffer.pretty_sections.length > 0) {
          const { error: sectionsErr } = await supabase
            .from('offer_pretty_sections')
            .delete()
            .eq('offer_id', currentOfferId)
          if (sectionsErr) throw sectionsErr
        }
      }

      // Save sections
      for (const section of sections) {
        const isExistingSection = !section.id.startsWith('temp-')

        if (isExistingSection) {
          // Update existing section
          const { error: sectionErr } = await supabase
            .from('offer_pretty_sections')
            .update({
              section_type: section.section_type,
              title: section.title,
              content: section.content,
              image_url: section.image_url,
              sort_order: section.sort_order,
            })
            .eq('id', section.id)

          if (sectionErr) throw sectionErr
        } else {
          // Create new section
          const { error: sectionErr } = await supabase
            .from('offer_pretty_sections')
            .insert({
              offer_id: currentOfferId,
              section_type: section.section_type,
              title: section.title,
              content: section.content,
              image_url: section.image_url,
              sort_order: section.sort_order,
            })

          if (sectionErr) throw sectionErr
        }
      }

      // Recalculate totals
      await recalculateOfferTotals(currentOfferId)

      return currentOfferId
    },
    onSuccess: async (savedOfferId) => {
      await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      await qc.invalidateQueries({ queryKey: ['offer-detail', savedOfferId] })
      success(
        isEditMode ? 'Offer updated' : 'Offer created',
        `Pretty offer "${title.trim()}" was saved successfully.`,
      )
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="1200px"
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        <Dialog.Title>
          {isEditMode ? 'Edit Pretty Offer' : 'Create Pretty Offer'}
        </Dialog.Title>
        <Separator my="2" />

        <Tabs.Root defaultValue="metadata" style={{ flex: 1, minHeight: 0 }}>
          <Tabs.List>
            <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
            <Tabs.Trigger value="sections">Sections</Tabs.Trigger>
            <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
          </Tabs.List>

          <Box style={{ flex: 1, overflowY: 'auto', paddingTop: '16px' }}>
            {/* Metadata Tab */}
            <Tabs.Content value="metadata">
              <Flex direction="column" gap="3">
                <Field label="Title">
                  <TextField.Root
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter offer title"
                    readOnly={isReadOnly}
                  />
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
                          Math.max(0, Math.min(100, Number(e.target.value) || 0)),
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
                          Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        )
                      }
                      readOnly={isReadOnly}
                    />
                  </Field>
                </Flex>
              </Flex>
            </Tabs.Content>

            {/* Sections Tab */}
            <Tabs.Content value="sections">
              <SectionsSection
                sections={sections}
                onSectionsChange={setSections}
                expandedSections={expandedSections}
                onExpandedSectionsChange={setExpandedSections}
                readOnly={isReadOnly}
              />
            </Tabs.Content>

            {/* Totals Tab */}
            <Tabs.Content value="totals">
              <TotalsSection totals={totals} />
            </Tabs.Content>
          </Box>
        </Tabs.Root>

        <Flex justify="end" gap="2" mt="3">
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
                  ? 'Save Changes'
                  : 'Create Offer'}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Sections Section Component
function SectionsSection({
  sections,
  onSectionsChange,
  expandedSections,
  onExpandedSectionsChange,
  readOnly = false,
}: {
  sections: Array<LocalPrettySection>
  onSectionsChange: (sections: Array<LocalPrettySection>) => void
  expandedSections: Set<string>
  onExpandedSectionsChange: (sections: Set<string>) => void
  readOnly?: boolean
}) {
  const addSection = () => {
    const newSection: LocalPrettySection = {
      id: `temp-${Date.now()}`,
      section_type: 'hero',
      title: null,
      content: null,
      image_url: null,
      sort_order: sections.length,
    }
    onSectionsChange([...sections, newSection])
    onExpandedSectionsChange(new Set([...expandedSections, newSection.id]))
  }

  const updateSection = (
    sectionId: string,
    updates: Partial<LocalPrettySection>,
  ) => {
    onSectionsChange(
      sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    )
  }

  const deleteSection = (sectionId: string) => {
    const newSections = sections.filter((s) => s.id !== sectionId)
    // Reorder remaining sections
    const reorderedSections = newSections.map((s, index) => ({
      ...s,
      sort_order: index,
    }))
    onSectionsChange(reorderedSections)
    const next = new Set(expandedSections)
    next.delete(sectionId)
    onExpandedSectionsChange(next)
  }

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = sections.findIndex((s) => s.id === sectionId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return

    const newSections = [...sections]
    ;[newSections[index], newSections[newIndex]] = [
      newSections[newIndex],
      newSections[index],
    ]

    // Update sort orders
    const reorderedSections = newSections.map((s, i) => ({
      ...s,
      sort_order: i,
    }))

    onSectionsChange(reorderedSections)
  }

  const toggleSection = (sectionId: string) => {
    const next = new Set(expandedSections)
    if (next.has(sectionId)) {
      next.delete(sectionId)
    } else {
      next.add(sectionId)
    }
    onExpandedSectionsChange(next)
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="3">Content Sections</Heading>
        {!readOnly && (
          <Button size="2" onClick={addSection}>
            <Plus width={16} height={16} /> Add Section
          </Button>
        )}
      </Flex>

      {sections.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="2" color="gray">
            No sections yet. Add your first section to get started.
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2">
          {sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section, index) => {
              const isExpanded = expandedSections.has(section.id)
              const canMoveUp = index > 0
              const canMoveDown = index < sections.length - 1

              return (
                <Box
                  key={section.id}
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
                    onClick={() => toggleSection(section.id)}
                  >
                    <Flex align="center" justify="between">
                      <Flex align="center" gap="2">
                        {isExpanded ? (
                          <NavArrowDown width={18} height={18} />
                        ) : (
                          <NavArrowRight width={18} height={18} />
                        )}
                        <Badge variant="soft">
                          {SECTION_TYPE_LABELS[section.section_type]}
                        </Badge>
                        <Text size="2" color="gray">
                          {section.title || '(Untitled)'}
                        </Text>
                      </Flex>
                      {!readOnly && (
                        <Flex align="center" gap="2">
                          <Button
                            size="1"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveSection(section.id, 'up')
                            }}
                            disabled={!canMoveUp}
                          >
                            <ArrowUp width={14} height={14} />
                          </Button>
                          <Button
                            size="1"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveSection(section.id, 'down')
                            }}
                            disabled={!canMoveDown}
                          >
                            <ArrowDown width={14} height={14} />
                          </Button>
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteSection(section.id)
                            }}
                          >
                            <Trash width={14} height={14} />
                          </Button>
                        </Flex>
                      )}
                    </Flex>
                  </Box>

                  {isExpanded && (
                    <Box p="3" style={{ background: 'var(--gray-a1)' }}>
                      <Flex direction="column" gap="3">
                        <Field label="Section Type">
                          <Select.Root
                            value={section.section_type}
                            onValueChange={(v) =>
                              updateSection(section.id, {
                                section_type: v as PrettySectionType,
                              })
                            }
                            disabled={readOnly}
                          >
                            <Select.Trigger />
                            <Select.Content>
                              {Object.entries(SECTION_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <Select.Item key={value} value={value}>
                                    {label}
                                  </Select.Item>
                                ),
                              )}
                            </Select.Content>
                          </Select.Root>
                        </Field>

                        <Field label="Title">
                          <TextField.Root
                            value={section.title || ''}
                            onChange={(e) =>
                              updateSection(section.id, {
                                title: e.target.value || null,
                              })
                            }
                            placeholder="Section title (optional)"
                            readOnly={readOnly}
                          />
                        </Field>

                        <Field label="Content">
                          <TextArea
                            value={section.content || ''}
                            onChange={(e) =>
                              updateSection(section.id, {
                                content: e.target.value || null,
                              })
                            }
                            placeholder="Section content (optional)"
                            rows={6}
                            readOnly={readOnly}
                          />
                        </Field>

                        <Field label="Image URL">
                          <TextField.Root
                            value={section.image_url || ''}
                            onChange={(e) =>
                              updateSection(section.id, {
                                image_url: e.target.value || null,
                              })
                            }
                            placeholder="https://example.com/image.jpg (optional)"
                            readOnly={readOnly}
                          />
                        </Field>
                      </Flex>
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
              <Text weight="medium">
                Discount ({totals.discountPercent}%)
              </Text>
            </Table.Cell>
            <Table.Cell align="right">
              <Text color="red">
                -{formatCurrency(
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


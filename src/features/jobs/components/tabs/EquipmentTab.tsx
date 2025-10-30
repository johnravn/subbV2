import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  SegmentedControl,
  Table,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import {
  Check,
  Edit,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Trash,
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { FixedTimePeriodEditor } from '@features/calendar/components/reservations/TimePeriodPicker'
import BookItemsDialog from '../dialogs/BookItemsDialog'
import type { ExternalReqStatus, ItemLite, ReservedItemRow } from '../../types'

export default function EquipmentTab({ jobId }: { jobId: string }) {
  const [bookItemsOpen, setBookItemsOpen] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [externalEditMode, setExternalEditMode] = React.useState(false)
  const { companyId } = useCompany()
  const canBook = !!companyId
  const timePeriodId: string | null = null

  const { data } = useQuery({
    queryKey: ['jobs.equipment', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr
      const resIds = (timePeriods as Array<{ id: string }>).map((r) => r.id)

      if (!resIds.length) return { internal: [], external: [] }

      const { data: items, error } = await supabase
        .from('reserved_items')
        .select(
          `
          id, time_period_id, item_id, quantity, source_group_id, source_kind,
          external_status, external_note, forced,
          item:item_id (
            id, name, category_id,
            category:category_id ( name ),
            external_owner_id,
            external_owner:external_owner_id ( name )
          ),
          source_group:source_group_id (
            id, name, category_id,
            category:category_id ( name )
          ),
          time_period:time_period_id ( id, title, start_at, end_at )
        `,
        )
        .in('time_period_id', resIds)
      if (error) throw error

      const rows = items as Array<ReservedItemRow & any>
      const internal = rows.filter((x) => !extOwnerId(x.item))
      const external = rows.filter((x) => !!extOwnerId(x.item))
      return { internal, external }
    },
  })

  return (
    <Box>
      <Tabs.Root defaultValue="internal">
        <Tabs.List mb="3">
          <Tabs.Trigger value="internal">Internal equipment</Tabs.Trigger>
          <Tabs.Trigger value="external">External equipment</Tabs.Trigger>
        </Tabs.List>

        {/* INTERNAL TAB */}
        <Tabs.Content value="internal">
          <InternalEquipmentTable
            rows={data?.internal ?? []}
            jobId={jobId}
            canBook={canBook}
            companyId={companyId ?? undefined}
            bookItemsOpen={bookItemsOpen}
            setBookItemsOpen={setBookItemsOpen}
            editMode={editMode}
            setEditMode={setEditMode}
          />
        </Tabs.Content>

        {/* EXTERNAL TAB */}
        <Tabs.Content value="external">
          <ExternalEquipmentTable
            rows={data?.external ?? []}
            canBook={canBook}
            jobId={jobId}
            companyId={companyId}
            bookItemsOpen={bookItemsOpen}
            setBookItemsOpen={setBookItemsOpen}
            timePeriodId={timePeriodId}
            editMode={externalEditMode}
            setEditMode={setExternalEditMode}
          />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

/* ------------------- Internal Table ------------------- */
function InternalEquipmentTable({
  rows,
  jobId,
  canBook,
  companyId,
  bookItemsOpen,
  setBookItemsOpen,
  editMode,
  setEditMode,
}: {
  rows: Array<any>
  jobId: string
  canBook: boolean
  companyId: string | undefined
  bookItemsOpen: boolean
  setBookItemsOpen: (v: boolean) => void
  editMode: boolean
  setEditMode: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )
  const [editingQty, setEditingQty] = React.useState<{
    id: string
    value: number
  } | null>(null)

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // Group rows by source_group_id
  const groupMap = new Map<string, Array<any>>()
  const directRows: Array<any> = []

  rows.forEach((r) => {
    if (r.source_kind === 'group' && r.source_group_id) {
      const arr = groupMap.get(r.source_group_id) ?? []
      arr.push(r)
      groupMap.set(r.source_group_id, arr)
    } else {
      directRows.push(r)
    }
  })

  const handleSaveQty = async (rowId: string, newQty: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ quantity: newQty })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      setEditingQty(null)
      success('Saved', 'Quantity updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDelete = async (rowId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('id', rowId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleDeleteGroup = async (groupId: string, timePeriodId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('source_group_id', groupId)
        .eq('time_period_id', timePeriodId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Group booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  return (
    <Box>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">Internal equipment</Heading>
        <Box style={{ display: 'flex', gap: 8 }}>
          {rows.length > 0 && (
            <Button
              size="2"
              variant={editMode ? 'solid' : 'soft'}
              color={editMode ? 'green' : undefined}
              disabled={!canBook}
              onClick={() => setEditMode(!editMode)}
            >
              <Edit width={16} height={16} />{' '}
              {editMode ? 'Done editing' : 'Edit bookings'}
            </Button>
          )}
          <Button
            size="2"
            disabled={!canBook}
            onClick={() => setBookItemsOpen(true)}
          >
            <Plus width={16} height={16} /> Book items
          </Button>
        </Box>
        {canBook && companyId && (
          <BookItemsDialog
            open={bookItemsOpen}
            onOpenChange={setBookItemsOpen}
            jobId={jobId}
            companyId={companyId}
            timePeriodId={undefined}
          />
        )}
      </Box>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Price pr</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Price total</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Time period</Table.ColumnHeaderCell>
            {editMode && <Table.ColumnHeaderCell />}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {/* Render grouped items */}
          {Array.from(groupMap.entries()).map(([groupId, groupRows]) => {
            const firstRow = groupRows[0]
            const sourceGroup = Array.isArray(firstRow?.source_group)
              ? firstRow?.source_group[0]
              : firstRow?.source_group
            const groupName =
              sourceGroup?.name ?? `Group ${groupId.slice(0, 8)}`
            const groupCategory = Array.isArray(sourceGroup?.category)
              ? sourceGroup?.category[0]?.name
              : sourceGroup?.category?.name
            const isExpanded = expandedGroups.has(groupId)
            const totalQty = groupRows.reduce(
              (sum, r) => sum + (r.quantity ?? 0),
              0,
            )
            const totalPrice = groupRows.reduce((sum, r) => {
              const item = firstItem(r.item)
              const pricePr = item?.price ?? 0
              return sum + pricePr * (r.quantity ?? 0)
            }, 0)

            return (
              <React.Fragment key={groupId}>
                {/* Group header row */}
                <Table.Row
                  style={{
                    cursor: editMode ? 'default' : 'pointer',
                    backgroundColor: 'var(--gray-a1)',
                  }}
                  onClick={() => !editMode && toggleGroup(groupId)}
                >
                  <Table.Cell>
                    <Box
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {!editMode &&
                        (isExpanded ? (
                          <NavArrowDown width={18} height={18} />
                        ) : (
                          <NavArrowRight width={18} height={18} />
                        ))}
                      <Text>{groupName}</Text>
                      <Badge color="pink" variant="soft">
                        Group
                      </Badge>
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Text weight="bold">{totalQty}</Text>
                  </Table.Cell>
                  <Table.Cell>—</Table.Cell>
                  <Table.Cell>
                    <Text weight="bold">{totalPrice.toFixed(2)}</Text>
                  </Table.Cell>
                  <Table.Cell>{groupCategory ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {firstRow?.time_period?.title ??
                      `${fmtDate(firstRow?.time_period?.start_at)} – ${fmtDate(firstRow?.time_period?.end_at)}`}
                  </Table.Cell>
                  {editMode && (
                    <Table.Cell align="right">
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGroup(groupId, firstRow.time_period_id)
                        }}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    </Table.Cell>
                  )}
                </Table.Row>

                {/* Expanded group items */}
                {isExpanded &&
                  !editMode &&
                  groupRows.map((r) => {
                    const item = firstItem(r.item)
                    const pricePr = item?.price ?? 0
                    const total = pricePr * (r.quantity ?? 0)
                    return (
                      <Table.Row
                        key={r.id}
                        style={{ backgroundColor: 'var(--gray-a1)' }}
                      >
                        <Table.Cell style={{ paddingLeft: 32 }}>
                          <Text color="gray">↳ {item?.name ?? '—'}</Text>
                        </Table.Cell>
                        <Table.Cell>{r.quantity}</Table.Cell>
                        <Table.Cell>{pricePr.toFixed(2)}</Table.Cell>
                        <Table.Cell>{total.toFixed(2)}</Table.Cell>
                        <Table.Cell>{item?.category?.name ?? '—'}</Table.Cell>
                        <Table.Cell>—</Table.Cell>
                      </Table.Row>
                    )
                  })}
              </React.Fragment>
            )
          })}

          {/* Render direct items */}
          {directRows.map((r) => {
            const item = firstItem(r.item)
            const pricePr = item?.price ?? 0
            const total = pricePr * (r.quantity ?? 0)
            const isEditing = editingQty?.id === r.id
            return (
              <Table.Row key={r.id}>
                <Table.Cell>{item?.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  {editMode ? (
                    <Box
                      style={{ display: 'flex', gap: 4, alignItems: 'center' }}
                    >
                      <TextField.Root
                        type="number"
                        min="1"
                        value={String(
                          isEditing && editingQty
                            ? editingQty.value
                            : r.quantity,
                        )}
                        onChange={(e) =>
                          setEditingQty({
                            id: r.id,
                            value: Math.max(1, Number(e.target.value || 1)),
                          })
                        }
                        style={{ width: 80 }}
                      />
                      {isEditing && editingQty && (
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => handleSaveQty(r.id, editingQty.value)}
                        >
                          <Check width={14} height={14} />
                        </Button>
                      )}
                    </Box>
                  ) : (
                    r.quantity
                  )}
                </Table.Cell>
                <Table.Cell>{pricePr.toFixed(2)}</Table.Cell>
                <Table.Cell>{total.toFixed(2)}</Table.Cell>
                <Table.Cell>{item?.category?.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  {r.time_period?.title ??
                    `${fmtDate(r.time_period?.start_at)} – ${fmtDate(r.time_period?.end_at)}`}
                </Table.Cell>
                {editMode && (
                  <Table.Cell align="right">
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash width={14} height={14} />
                    </Button>
                  </Table.Cell>
                )}
              </Table.Row>
            )
          })}

          {rows.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={editMode ? 7 : 6}>
                <Text color="gray">No internal items</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

/* ------------------- External Table ------------------- */
function ExternalEquipmentTable({
  rows,
  canBook,
  jobId,
  companyId,
  bookItemsOpen,
  setBookItemsOpen,
  timePeriodId,
  editMode,
  setEditMode,
}: any) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [editingQty, setEditingQty] = React.useState<{
    id: string
    value: number
  } | null>(null)
  const [expandedOwners, setExpandedOwners] = React.useState<Set<string>>(
    new Set(),
  )
  const [ownerNotes, setOwnerNotes] = React.useState<Map<string, string>>(
    new Map(),
  )

  // Group items by external owner
  const ownerGroups = React.useMemo(() => {
    const groups = new Map<string, Array<any>>()
    for (const row of rows) {
      const item = firstItem(row.item) as any
      const ownerId = item?.external_owner_id
      if (!ownerId) continue

      const ownerItems = groups.get(ownerId) || []
      ownerItems.push(row)
      groups.set(ownerId, ownerItems)
    }
    return groups
  }, [rows])

  // Sync ownerNotes when data changes
  React.useEffect(() => {
    setOwnerNotes((prevNotes) => {
      const newNotes = new Map<string, string>()
      for (const [ownerId, items] of ownerGroups.entries()) {
        const currentNote = items[0]?.external_note ?? ''
        // Only keep notes that have been edited and differ from current
        const editedNote = prevNotes.get(ownerId)
        if (editedNote !== undefined && editedNote !== currentNote) {
          newNotes.set(ownerId, editedNote)
        }
      }
      return newNotes
    })
  }, [ownerGroups])

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(ownerId)) {
        next.delete(ownerId)
      } else {
        next.add(ownerId)
      }
      return next
    })
  }

  const handleSaveQty = async (rowId: string, newQty: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update({ quantity: newQty })
        .eq('id', rowId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      setEditingQty(null)
      success('Saved', 'Quantity updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  const handleDelete = async (rowId: string) => {
    try {
      const { error: delErr } = await supabase
        .from('reserved_items')
        .delete()
        .eq('id', rowId)
      if (delErr) throw delErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Deleted', 'Booking removed')
    } catch (e: any) {
      error('Failed to delete', e?.message || 'Please try again.')
    }
  }

  const handleUpdateOwnerItems = async (
    ownerItems: Array<any>,
    updates: {
      external_status?: ExternalReqStatus
      external_note?: string
      time_period_id?: string
    },
  ) => {
    try {
      const itemIds = ownerItems.map((r) => r.id)
      const { error: updateErr } = await supabase
        .from('reserved_items')
        .update(updates)
        .in('id', itemIds)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      success('Updated', 'All items for this owner updated')
    } catch (e: any) {
      error('Failed to update', e?.message || 'Please try again.')
    }
  }

  return (
    <Box>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">External equipment</Heading>
        <Box style={{ display: 'flex', gap: 8 }}>
          {rows.length > 0 && (
            <Button
              size="2"
              variant={editMode ? 'solid' : 'soft'}
              color={editMode ? 'green' : undefined}
              disabled={!canBook}
              onClick={() => setEditMode(!editMode)}
            >
              <Edit width={16} height={16} />{' '}
              {editMode ? 'Done editing' : 'Edit bookings'}
            </Button>
          )}
          <Button
            size="2"
            disabled={!canBook}
            onClick={() => setBookItemsOpen(true)}
          >
            <Plus width={16} height={16} /> Book items
          </Button>
        </Box>
        {canBook && (
          <BookItemsDialog
            open={bookItemsOpen}
            onOpenChange={setBookItemsOpen}
            jobId={jobId}
            companyId={companyId}
            timePeriodId={timePeriodId}
          />
        )}
      </Box>

      {rows.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text color="gray">No external items</Text>
        </Box>
      ) : (
        Array.from(ownerGroups.entries()).map(([ownerId, ownerItems]) => {
          const firstRow = ownerItems[0]
          const item = firstItem(firstRow.item) as any
          const ownerName = Array.isArray(item?.external_owner)
            ? item?.external_owner[0]?.name
            : item?.external_owner?.name
          const currentStatus = firstRow.external_status as ExternalReqStatus
          const currentNote = firstRow.external_note ?? ''
          const currentTimePeriod = firstRow.time_period_id
          const isExpanded = expandedOwners.has(ownerId)
          const editedNote = ownerNotes.get(ownerId) ?? currentNote
          const noteChanged = editedNote !== currentNote

          return (
            <Box key={ownerId} mb="4">
              {/* Owner Header */}
              <Box
                mb="2"
                p="3"
                style={{
                  background: 'var(--blue-a2)',
                  border: '1px solid var(--blue-a5)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                onClick={() => toggleOwner(ownerId)}
              >
                <Flex align="center" justify="between">
                  <Flex align="center" gap="3">
                    {isExpanded ? (
                      <NavArrowDown width={18} height={18} />
                    ) : (
                      <NavArrowRight width={18} height={18} />
                    )}
                    {ownerName ?? ownerId}
                    <Text size="2" color="gray">
                      ({ownerItems.length}{' '}
                      {ownerItems.length === 1 ? 'item' : 'items'})
                    </Text>
                  </Flex>
                  <Box onClick={(e) => e.stopPropagation()}>
                    <StatusBadge
                      value={currentStatus}
                      onChange={(v) =>
                        handleUpdateOwnerItems(ownerItems, {
                          external_status: v,
                        })
                      }
                    />
                  </Box>
                </Flex>
              </Box>

              {/* Expanded Details */}
              {isExpanded && (
                <Box
                  mb="2"
                  p="3"
                  style={{
                    background: 'var(--gray-a2)',
                    border: '1px solid var(--gray-a5)',
                    borderRadius: 8,
                  }}
                >
                  <Flex direction="column" gap="3">
                    <Box>
                      <Text size="1" weight="medium" mb="1">
                        Time Period
                      </Text>
                      {currentTimePeriod ? (
                        <FixedTimePeriodEditor
                          jobId={jobId}
                          timePeriodId={currentTimePeriod}
                        />
                      ) : (
                        <Box
                          p="2"
                          style={{
                            border: '1px dashed var(--amber-a6)',
                            borderRadius: 8,
                            background: 'var(--amber-a2)',
                          }}
                        >
                          <Text size="2" color="amber">
                            No time period set
                          </Text>
                        </Box>
                      )}
                    </Box>

                    <Box>
                      <Text size="1" weight="medium" mb="1">
                        Note
                      </Text>
                      <TextField.Root
                        placeholder="Add note for all items from this owner…"
                        value={editedNote}
                        onChange={(e) => {
                          const newNotes = new Map(ownerNotes)
                          newNotes.set(ownerId, e.target.value)
                          setOwnerNotes(newNotes)
                        }}
                      >
                        {noteChanged && (
                          <TextField.Slot side="right">
                            <Button
                              size="2"
                              variant="ghost"
                              onClick={() => {
                                handleUpdateOwnerItems(ownerItems, {
                                  external_note: editedNote,
                                })
                                // Clear the edited note after saving
                                const newNotes = new Map(ownerNotes)
                                newNotes.delete(ownerId)
                                setOwnerNotes(newNotes)
                              }}
                            >
                              Save
                            </Button>
                          </TextField.Slot>
                        )}
                      </TextField.Root>
                    </Box>
                  </Flex>
                </Box>
              )}

              {/* Items Table - Only show when expanded */}
              {isExpanded && (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
                      {editMode && <Table.ColumnHeaderCell />}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {ownerItems.map((r: ReservedItemRow) => {
                      const rowItem = firstItem(r.item) as any
                      const price = rowItem?.price ?? 0
                      return (
                        <Table.Row key={r.id}>
                          <Table.Cell>{rowItem?.name ?? '—'}</Table.Cell>
                          <Table.Cell>
                            {editMode ? (
                              <Box
                                style={{
                                  display: 'flex',
                                  gap: 4,
                                  alignItems: 'center',
                                }}
                              >
                                <TextField.Root
                                  type="number"
                                  min="1"
                                  value={String(
                                    editingQty?.id === r.id
                                      ? editingQty.value
                                      : r.quantity,
                                  )}
                                  onChange={(e) =>
                                    setEditingQty({
                                      id: r.id,
                                      value: Math.max(
                                        1,
                                        Number(e.target.value || 1),
                                      ),
                                    })
                                  }
                                  style={{ width: 80 }}
                                />
                                {editingQty?.id === r.id && (
                                  <Button
                                    size="1"
                                    variant="soft"
                                    onClick={() =>
                                      handleSaveQty(r.id, editingQty.value)
                                    }
                                  >
                                    <Check width={14} height={14} />
                                  </Button>
                                )}
                              </Box>
                            ) : (
                              r.quantity
                            )}
                          </Table.Cell>
                          <Table.Cell>{formatNOK(price)}</Table.Cell>
                          {editMode && (
                            <Table.Cell align="right">
                              <Button
                                size="1"
                                variant="soft"
                                color="red"
                                onClick={() => handleDelete(r.id)}
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
            </Box>
          )
        })
      )}
    </Box>
  )
}

/* ------------------- Helpers ------------------- */
function StatusBadge({
  value,
  onChange,
}: {
  value: ExternalReqStatus
  onChange: (v: ExternalReqStatus) => void
}) {
  const all: Array<ExternalReqStatus> = ['planned', 'requested', 'confirmed']
  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={(v) => onChange(v as ExternalReqStatus)}
      size="1"
    >
      {all.map((s) => (
        <SegmentedControl.Item key={s} value={s}>
          {s}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}

function firstItem(it: ReservedItemRow['item']): ItemLite | null {
  return Array.isArray(it) ? (it[0] ?? null) : it
}
function extOwnerId(it: ReservedItemRow['item']) {
  return firstItem(it)?.external_owner_id ?? null
}
function fmtDate(v?: string) {
  return v ? new Date(v).toLocaleDateString() : ''
}
function formatNOK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'NOK',
  }).format(Number(n))
}

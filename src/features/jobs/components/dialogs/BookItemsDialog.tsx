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
  const { success, error } = useToast()

  // Update local state when prop changes
  React.useEffect(() => {
    if (initialTimePeriodId) {
      setSelectedTimePeriodId(initialTimePeriodId)
    }
  }, [initialTimePeriodId])

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

    setRows((r) => {
      if (p.kind === 'item') {
        const i = r.findIndex((x) => x.kind === 'item' && x.item_id === p.id)
        if (i >= 0) {
          const newQty = r[i].quantity + 1
          // Check if we're trying to book more than available
          if (onHand > 0 && newQty > onHand) {
            error(
              'Not enough available',
              `Only ${onHand} ${p.name} available. Already booking ${r[i].quantity}.`,
            )
            return r
          }
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: newQty } as Row
          return clone
        }
        // Adding new item
        if (onHand > 0 && 1 > onHand) {
          error('Not enough available', `Only ${onHand} ${p.name} available.`)
          return r
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
          const newQty = r[i].quantity + 1
          // Check if we're trying to book more than available
          if (onHand > 0 && newQty > onHand) {
            error(
              'Not enough available',
              `Only ${onHand} ${p.name} available. Already booking ${r[i].quantity}.`,
            )
            return r
          }
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: newQty } as Row
          return clone
        }
        // Adding new group
        if (onHand > 0 && 1 > onHand) {
          error('Not enough available', `Only ${onHand} ${p.name} available.`)
          return r
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
      error(
        'Not enough available',
        `Only ${maxAvailable} available. Cannot book ${qty}.`,
      )
      return
    }

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

      const time_period_id = selectedTimePeriodId

      // 2) build payload for items
      const itemPayload = itemRows.map((r) => ({
        time_period_id,
        item_id: r.item_id,
        quantity: r.quantity,
        source_kind: 'direct' as const,
      }))
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
              time_period_id,
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
      const { error: insErr } = await supabase
        .from('reserved_items')
        .insert(payload)
      console.log('Payload', payload)
      console.log('insErr', insErr)
      if (insErr) throw insErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
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

        {/* Time Period Selection - Required */}
        <TimePeriodPicker
          jobId={jobId}
          value={selectedTimePeriodId}
          onChange={setSelectedTimePeriodId}
        />

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
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

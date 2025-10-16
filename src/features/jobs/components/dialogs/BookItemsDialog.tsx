// src/features/jobs/components/dialogs/BookItemsDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import type { UUID } from '../../types'

type PickerItem = { id: UUID; name: string }

type Row = { item_id: UUID; name: string; quantity: number }

export default function BookItemsDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
  onSaved?: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [rows, setRows] = React.useState<Array<Row>>([])

  const { data: picker = [], isFetching } = useQuery({
    queryKey: ['company', companyId, 'item-picker', search],
    enabled: open,
    queryFn: async (): Promise<Array<PickerItem>> => {
      let q = supabase
        .from('items')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('active', true)
        .limit(20)
      if (search) q = q.ilike('name', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data as Array<PickerItem>
    },
  })

  const add = (it: PickerItem) => {
    setRows((r) => {
      const i = r.findIndex((x) => x.item_id === it.id)
      if (i >= 0) {
        const clone = [...r]
        clone[i].quantity += 1
        return clone
      }
      return [...r, { item_id: it.id, name: it.name, quantity: 1 }]
    })
  }
  const updateQty = (id: UUID, qty: number) =>
    setRows((r) =>
      r.map((x) =>
        x.item_id === id ? { ...x, quantity: Math.max(1, qty) } : x,
      ),
    )
  const remove = (id: UUID) => setRows((r) => r.filter((x) => x.item_id !== id))

  const save = useMutation({
    mutationFn: async () => {
      if (rows.length === 0) return
      // ensure a reservation exists (see SQL helper below)
      const { data: resIdRow, error: resErr } = await supabase.rpc(
        'ensure_default_reservation',
        { p_job_id: jobId },
      )
      if (resErr) throw resErr
      const reservation_id = resIdRow?.id ?? resIdRow

      const payload = rows.map((r) => ({
        reservation_id,
        item_id: r.item_id,
        quantity: r.quantity,
        source_kind: 'direct' as const,
      }))
      const { error } = await supabase.from('reserved_items').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      onOpenChange(false)
      onSaved?.()
      setRows([])
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="960px"
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>Book equipment</Dialog.Title>

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
            <Text size="2" color="gray">
              Search items
            </Text>
            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
            />
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
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
                    <Table.ColumnHeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {picker.map((it) => (
                    <Table.Row key={it.id}>
                      <Table.Cell>{it.name}</Table.Cell>
                      <Table.Cell align="right">
                        <Button
                          size="1"
                          variant="classic"
                          onClick={() => add(it)}
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
                    <Table.Row key={r.item_id}>
                      <Table.Cell>{r.name}</Table.Cell>
                      <Table.Cell>
                        <TextField.Root
                          type="number"
                          min="1"
                          value={String(r.quantity)}
                          onChange={(e) =>
                            updateQty(
                              r.item_id,
                              Math.max(1, Number(e.target.value || 1)),
                            )
                          }
                        />
                      </Table.Cell>
                      <Table.Cell align="right">
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={() => remove(r.item_id)}
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
            disabled={save.isPending || rows.length === 0}
          >
            {save.isPending ? 'Booking…' : 'Book items'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Heading,
  SegmentedControl,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, Plus } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import BookItemsDialog from '../dialogs/BookItemsDialog'
import EditItemBookingDialog from '../dialogs/EditItemBookingDialog'
import type { ExternalReqStatus, ItemLite, ReservedItemRow } from '../../types'

export default function EquipmentTab({ jobId }: { jobId: string }) {
  const qc = useQueryClient()

  const [bookItemsOpen, setBookItemsOpen] = React.useState(false)
  const [editItem, setEditItem] = React.useState<ReservedItemRow | null>(null)
  const { companyId } = useCompany()
  const canBook = !!companyId

  const { data } = useQuery({
    queryKey: ['jobs.equipment', jobId],
    queryFn: async () => {
      const { data: reservations, error: rErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('job_id', jobId)
      if (rErr) throw rErr
      const resIds = reservations.map((r) => r.id)
      if (!resIds.length) return { internal: [], external: [] }

      const { data: items, error } = await supabase
        .from('reserved_items')
        .select(
          `
          id, reservation_id, item_id, quantity, source_group_id, source_kind,
          external_status, external_note, forced,
          item:item_id ( id, name, external_owner_id )
        `,
        )
        .in('reservation_id', resIds)
      if (error) throw error

      const rows = items as Array<ReservedItemRow>

      const internal = rows.filter((x) => !extOwnerId(x.item))
      const external = rows.filter((x) => !!extOwnerId(x.item))
      return { internal, external }
    },
  })

  const updateExt = useMutation({
    mutationFn: async (payload: {
      id: string
      external_status?: ExternalReqStatus
      external_note?: string
    }) => {
      const { error } = await supabase
        .from('reserved_items')
        .update(payload)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] }),
  })

  return (
    <div>
      <Heading size="3" mb="2">
        Internal equipment
      </Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Conflicts</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.internal ?? []).map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{firstItem(r.item)?.name ?? '—'}</Table.Cell>
              <Table.Cell>{r.quantity}</Table.Cell>
              <Table.Cell>
                <AvailabilityBadge jobId={jobId} itemId={r.item_id} />
              </Table.Cell>
              <Table.Cell>
                <Button size="1" variant="soft">
                  <Edit width={14} height={14} /> Edit booking
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
          {(data?.internal ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <Text color="gray">No internal items</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

      <Box mt="4">
        <Box
          mb="2"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Heading size="3">External equipment</Heading>
          <Button
            size="2"
            disabled={!canBook}
            onClick={() => setBookItemsOpen(true)}
          >
            <Plus width={16} height={16} /> Book items
          </Button>
          {canBook && (
            <BookItemsDialog
              open={bookItemsOpen}
              onOpenChange={setBookItemsOpen}
              jobId={jobId}
              companyId={companyId} // now definitely string
            />
          )}
        </Box>

        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data?.external ?? []).map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{firstItem(r.item)?.name ?? '—'}</Table.Cell>
                <Table.Cell>{r.quantity}</Table.Cell>
                <Table.Cell>
                  <StatusBadge
                    value={r.external_status as ExternalReqStatus}
                    onChange={(v) =>
                      updateExt.mutate({ id: r.id, external_status: v })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <TextField.Root
                    size="1"
                    placeholder="Add note…"
                    value={r.external_note ?? ''}
                    onChange={(e) =>
                      updateExt.mutate({
                        id: r.id,
                        external_note: e.target.value,
                      })
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => setEditItem(r)}
                  >
                    …Edit booking
                  </Button>
                  {editItem && (
                    <EditItemBookingDialog
                      open={!!editItem}
                      onOpenChange={(v) => !v && setEditItem(null)}
                      row={editItem}
                      jobId={jobId}
                    />
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
            {(data?.external ?? []).length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Text color="gray">No external items</Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </div>
  )
}

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

// supabase sometimes returns nested relation as array; normalize
function firstItem(it: ReservedItemRow['item']): ItemLite | null {
  if (!it) return null
  return Array.isArray(it) ? (it[0] ?? null) : it
}
function extOwnerId(it: ReservedItemRow['item']) {
  return firstItem(it)?.external_owner_id ?? null
}

/* availability badge via RPC */
function AvailabilityBadge({
  itemId,
  jobId,
}: {
  itemId: string
  jobId: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['jobs.itemAvail', jobId, itemId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'check_item_availability_for_job',
        {
          p_job_id: jobId,
          p_item_id: itemId,
        },
      )
      if (error) throw error
      return data as { conflicts: number }
    },
  })
  if (isLoading) return <Badge variant="soft">checking…</Badge>
  if (!data || data.conflicts === 0)
    return (
      <Badge color="green" variant="soft" radius="full">
        free
      </Badge>
    )
  return (
    <Badge color="red" variant="soft" radius="full">
      conflicts: {data.conflicts}
    </Badge>
  )
}

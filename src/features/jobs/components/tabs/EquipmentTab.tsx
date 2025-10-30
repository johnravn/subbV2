import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Heading,
  SegmentedControl,
  Table,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, Plus } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import TimePeriodPicker from '@features/calendar/components/reservations/TimePeriodPicker'
import BookItemsDialog from '../dialogs/BookItemsDialog'
import EditItemBookingDialog from '../dialogs/EditItemBookingDialog'
import type { ExternalReqStatus, ItemLite, ReservedItemRow } from '../../types'

export default function EquipmentTab({ jobId }: { jobId: string }) {
  const qc = useQueryClient()
  const [bookItemsOpen, setBookItemsOpen] = React.useState(false)
  const [editItem, setEditItem] = React.useState<ReservedItemRow | null>(null)
  const { companyId } = useCompany()
  const canBook = !!companyId
  const [timePeriodId, setTimePeriodId] = React.useState<string | null>(null)

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
            external_owner_id
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
    <Box>
      <Tabs.Root defaultValue="internal">
        <Tabs.List mb="3">
          <Tabs.Trigger value="internal">Internal equipment</Tabs.Trigger>
          <Tabs.Trigger value="external">External equipment</Tabs.Trigger>
        </Tabs.List>

        {/* INTERNAL TAB */}
        <Tabs.Content value="internal">
          <InternalEquipmentTable rows={data?.internal ?? []} jobId={jobId} />
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
            editItem={editItem}
            setEditItem={setEditItem}
            updateExt={updateExt}
            timePeriodId={timePeriodId}
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
}: {
  rows: Array<any>
  jobId: string
}) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Price pr</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Price total</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Time period</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((r) => {
          const item = firstItem(r.item)
          const pricePr = item?.price ?? 0
          const total = pricePr * (r.quantity ?? 0)
          return (
            <Table.Row key={r.id}>
              <Table.Cell>{item?.name ?? '—'}</Table.Cell>
              <Table.Cell>{r.quantity}</Table.Cell>
              <Table.Cell>{pricePr.toFixed(2)}</Table.Cell>
              <Table.Cell>{total.toFixed(2)}</Table.Cell>
              <Table.Cell>{item?.category?.name ?? '—'}</Table.Cell>
              <Table.Cell>
                {r.time_period?.title ??
                  `${fmtDate(r.time_period?.start_at)} – ${fmtDate(r.time_period?.end_at)}`}
              </Table.Cell>
            </Table.Row>
          )
        })}
        {rows.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={6}>
              <Text color="gray">No internal items</Text>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table.Root>
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
  editItem,
  setEditItem,
  updateExt,
  timePeriodId,
}: any) {
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
            companyId={companyId}
            timePeriodId={timePeriodId}
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
            <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r: ReservedItemRow) => {
            const item = firstItem(r.item)
            return (
              <Table.Row key={r.id}>
                <Table.Cell>{item?.name ?? '—'}</Table.Cell>
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
                  <Badge color="blue" variant="soft">
                    {item?.external_owner_id ?? '—'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => setEditItem(r)}
                  >
                    <Edit width={14} height={14} /> Edit booking
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
            )
          })}
          {rows.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text color="gray">No external items</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
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

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Heading,
  SegmentedControl,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, Truck } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import BookVehicleDialog, {
  EditVehicleBookingDialog,
} from '../dialogs/BookVehicleDialog'
import type { ExternalReqStatus, ReservedVehicleRow } from '../../types'

export default function TransportTab({ jobId }: { jobId: string }) {
  const [bookVehOpen, setBookVehOpen] = React.useState(false)
  const [editVeh, setEditVeh] = React.useState<ReservedVehicleRow | null>(null)
  const { companyId } = useCompany()
  const canBook = !!companyId

  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['jobs.transport', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: rErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
      if (rErr) throw rErr
      const resIds = timePeriods.map((r) => r.id)
      if (!resIds.length) return [] as Array<ReservedVehicleRow>
      const { data: rows, error } = await supabase
        .from('reserved_vehicles')
        .select(
          `
          id, time_period_id, vehicle_id, external_status, external_note,
          vehicle:vehicle_id ( id, name, external_owner_id )
        `,
        )
        .in('time_period_id', resIds)
      if (error) throw error
      // CHECK THIS
      return rows as unknown as Array<ReservedVehicleRow>
    },
  })

  const updateExt = useMutation({
    mutationFn: async (payload: {
      id: string
      external_status?: ExternalReqStatus
      external_note?: string
    }) => {
      const { error } = await supabase
        .from('reserved_vehicles')
        .update(payload)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] }),
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Heading size="3">Transportation</Heading>
        <Button
          size="2"
          disabled={!canBook}
          onClick={() => setBookVehOpen(true)}
        >
          <Truck /> Book vehicle
        </Button>
        {canBook && (
          <BookVehicleDialog
            open={bookVehOpen}
            onOpenChange={setBookVehOpen}
            jobId={jobId}
            companyId={companyId}
          />
        )}
      </div>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Vehicle</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data ?? []).map((r) => {
            const external = !!r.vehicle?.external_owner_id
            return (
              <Table.Row key={r.id}>
                <Table.Cell>{r.vehicle?.name ?? '—'}</Table.Cell>
                <Table.Cell>{external ? 'External' : 'Internal'}</Table.Cell>
                <Table.Cell>
                  {external ? (
                    <SegmentedControl.Root
                      size="1"
                      value={r.external_status as ExternalReqStatus}
                      onValueChange={(v) =>
                        updateExt.mutate({
                          id: r.id,
                          external_status: v as ExternalReqStatus,
                        })
                      }
                    >
                      {(
                        [
                          'planned',
                          'requested',
                          'confirmed',
                        ] as Array<ExternalReqStatus>
                      ).map((s) => (
                        <SegmentedControl.Item key={s} value={s}>
                          {s}
                        </SegmentedControl.Item>
                      ))}
                    </SegmentedControl.Root>
                  ) : (
                    '—'
                  )}
                </Table.Cell>
                <Table.Cell>
                  {external ? (
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
                  ) : (
                    '—'
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Button size="1" variant="soft" onClick={() => setEditVeh(r)}>
                    Edit booking
                  </Button>
                  {editVeh && (
                    <EditVehicleBookingDialog
                      open={!!editVeh}
                      onOpenChange={(v) => !v && setEditVeh(null)}
                      row={editVeh}
                      jobId={jobId}
                    />
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
          {(data ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={5}>
                <Text color="gray">No vehicles</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Heading,
  SegmentedControl,
  Table,
  Text,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, Mail, Plus } from 'iconoir-react'
import type { CrewReqStatus, ReservedCrewRow } from '../../types'

export default function CrewTab({ jobId }: { jobId: string }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['jobs.crew', jobId],
    queryFn: async () => {
      const { data: reservations, error: rErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('job_id', jobId)
      if (rErr) throw rErr
      const resIds = reservations.map((r) => r.id)
      if (!resIds.length) return [] as Array<ReservedCrewRow>
      const { data: rows, error } = await supabase
        .from('reserved_crew')
        .select(
          `
          id, reservation_id, user_id, assignment, notes, status, start_at, end_at,
          user:user_id ( user_id, display_name, email )
        `,
        )
        .in('reservation_id', resIds)
      if (error) throw error
      return rows as unknown as Array<ReservedCrewRow>
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: CrewReqStatus
    }) => {
      const { error } = await supabase
        .from('reserved_crew')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] }),
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
        <Heading size="3">Crew</Heading>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="2">
            <Plus width={16} height={16} /> Add crew booking
          </Button>
          <Button size="2" variant="soft">
            <Mail width={16} height={16} /> Send requests
          </Button>
        </div>
      </div>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data ?? []).map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>
                {r.user?.display_name ?? r.user?.email ?? '—'}
              </Table.Cell>
              <Table.Cell>{r.assignment ?? '—'}</Table.Cell>
              <Table.Cell>{fmt(r.start_at)}</Table.Cell>
              <Table.Cell>{fmt(r.end_at)}</Table.Cell>
              <Table.Cell>
                <SegmentedControl.Root
                  size="1"
                  value={r.status}
                  onValueChange={(v) =>
                    updateStatus.mutate({
                      id: r.id,
                      status: v as CrewReqStatus,
                    })
                  }
                >
                  {(
                    [
                      'planned',
                      'requested',
                      'declined',
                      'accepted',
                    ] as Array<CrewReqStatus>
                  ).map((s) => (
                    <SegmentedControl.Item key={s} value={s}>
                      {s}
                    </SegmentedControl.Item>
                  ))}
                </SegmentedControl.Root>
              </Table.Cell>
              <Table.Cell>
                <Button size="1" variant="soft">
                  <Edit width={14} height={14} /> Edit booking
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
          {(data ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text color="gray">No crew</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : '—'
}

// src/features/jobs/components/dialogs/AddCrewDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import type { CrewReqStatus, UUID } from '../../types'

export default function AddCrewDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [userId, setUserId] = React.useState<UUID | ''>('')
  const [assignment, setAssignment] = React.useState('')
  const [status, setStatus] = React.useState<CrewReqStatus>('planned')
  const [startAt, setStartAt] = React.useState('')
  const [endAt, setEndAt] = React.useState('')

  const { data: people = [] } = useQuery({
    queryKey: ['crew-picker'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  // preload job times
  useQuery({
    queryKey: ['job-times', jobId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('start_at, end_at')
        .eq('id', jobId)
        .single()
      if (error) throw error
      const s = (data.start_at as string | null) ?? ''
      const e = (data.end_at as string | null) ?? ''
      setStartAt(s)
      setEndAt(e)
      return data
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Choose a person')
      const { data: resIdRow, error: resErr } = await supabase.rpc(
        'ensure_default_reservation',
        { p_job_id: jobId },
      )
      if (resErr) throw resErr
      const reservation_id = resIdRow?.id ?? resIdRow
      const { error } = await supabase.from('reserved_crew').insert({
        reservation_id,
        user_id: userId,
        assignment: assignment || null,
        status,
        start_at: startAt || null,
        end_at: endAt || null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      onOpenChange(false)
      setUserId('')
      setAssignment('')
      setStatus('planned')
    },
  })

  const disabled = save.isPending || !userId

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add crew booking</Dialog.Title>

        <Field label="Person">
          <Select.Root value={userId} onValueChange={(v) => setUserId(v)}>
            <Select.Trigger placeholder="Select…" />
            <Select.Content>
              {people.map((p) => (
                <Select.Item key={p.user_id} value={p.user_id}>
                  {p.display_name ?? p.email}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>

        <Field label="Assignment">
          <TextField.Root
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
            placeholder="e.g., FOH"
          />
        </Field>

        <Field label="Status">
          <Select.Root
            value={status}
            onValueChange={(v) => setStatus(v as CrewReqStatus)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="requested">requested</Select.Item>
              <Select.Item value="declined">declined</Select.Item>
              <Select.Item value="accepted">accepted</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>

        <Field label="Start">
          <TextField.Root
            type="datetime-local"
            value={toLocal(startAt)}
            onChange={(e) => setStartAt(fromLocal(e.target.value))}
          />
        </Field>
        <Field label="End">
          <TextField.Root
            type="datetime-local"
            value={toLocal(endAt)}
            onChange={(e) => setEndAt(fromLocal(e.target.value))}
          />
        </Field>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={disabled}
          >
            {save.isPending ? 'Saving…' : 'Add'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export function EditCrewDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: {
    id: UUID
    assignment: string | null
    status: CrewReqStatus
    start_at: string | null
    end_at: string | null
  }
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [assignment, setAssignment] = React.useState(row.assignment ?? '')
  const [status, setStatus] = React.useState<CrewReqStatus>(row.status)
  const [startAt, setStartAt] = React.useState(row.start_at ?? '')
  const [endAt, setEndAt] = React.useState(row.end_at ?? '')

  React.useEffect(() => {
    if (!open) return
    setAssignment(row.assignment ?? '')
    setStatus(row.status)
    setStartAt(row.start_at ?? '')
    setEndAt(row.end_at ?? '')
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reserved_crew')
        .update({
          assignment: assignment || null,
          status,
          start_at: startAt || null,
          end_at: endAt || null,
        })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit crew booking</Dialog.Title>
        <Field label="Assignment">
          <TextField.Root
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <Select.Root
            value={status}
            onValueChange={(v) => setStatus(v as CrewReqStatus)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="requested">requested</Select.Item>
              <Select.Item value="declined">declined</Select.Item>
              <Select.Item value="accepted">accepted</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>
        <Field label="Start">
          <TextField.Root
            type="datetime-local"
            value={toLocal(startAt)}
            onChange={(e) => setStartAt(fromLocal(e.target.value))}
          />
        </Field>
        <Field label="End">
          <TextField.Root
            type="datetime-local"
            value={toLocal(endAt)}
            onChange={(e) => setEndAt(fromLocal(e.target.value))}
          />
        </Field>
        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: 'var(--gray-11)', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const toLocal = (iso?: string | null) =>
  !iso ? '' : new Date(iso).toISOString().slice(0, 16)
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '')

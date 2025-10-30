// src/features/jobs/components/dialogs/BookVehicleDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import type { ExternalReqStatus, UUID } from '../../types'

export default function BookVehicleDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = React.useState<UUID | ''>('')
  const [status, setStatus] = React.useState<ExternalReqStatus>('planned')
  const [note, setNote] = React.useState('')
  // Times come from the selected time period

  // No job-times preload required

  const { data: vehicles = [] } = useQuery({
    queryKey: ['company', companyId, 'vehicles'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, external_owner_id')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{
        id: UUID
        name: string
        external_owner_id: UUID | null
      }>
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!vehicleId) throw new Error('Choose a vehicle')
      const { data: resIdRow, error: resErr } = await supabase.rpc(
        'ensure_default_time_period',
        { p_job_id: jobId },
      )
      if (resErr) throw resErr
      const time_period_id = resIdRow?.id ?? resIdRow
      const v = vehicles.find((x) => x.id === vehicleId)
      const payload: any = { time_period_id, vehicle_id: vehicleId }
      if (v?.external_owner_id) {
        payload.external_status = status
        payload.external_note = note || null
      }
      const { error } = await supabase.from('reserved_vehicles').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      onOpenChange(false)
      setVehicleId('')
      setNote('')
      setStatus('planned')
    },
  })

  const selected = vehicles.find((v) => v.id === vehicleId)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Book vehicle</Dialog.Title>
        <Field label="Vehicle">
          <Select.Root value={vehicleId} onValueChange={(v) => setVehicleId(v)}>
            <Select.Trigger placeholder="Select…" />
            <Select.Content>
              {vehicles.map((v) => (
                <Select.Item key={v.id} value={v.id}>
                  {v.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>
        {/* Start/end are defined by the selected time period */}
        {selected?.external_owner_id && (
          <>
            <Field label="External status">
              <Select.Root
                value={status}
                onValueChange={(v) => setStatus(v as ExternalReqStatus)}
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="planned">planned</Select.Item>
                  <Select.Item value="requested">requested</Select.Item>
                  <Select.Item value="confirmed">confirmed</Select.Item>
                </Select.Content>
              </Select.Root>
            </Field>
            <Field label="Note">
              <TextField.Root
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </>
        )}
        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={save.isPending || !vehicleId}
          >
            {save.isPending ? 'Saving…' : 'Book'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export function EditVehicleBookingDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: {
    id: UUID
    external_status: ExternalReqStatus | null
    external_note: string | null
  }
  jobId: UUID
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState<ExternalReqStatus>(
    row.external_status ?? 'planned',
  )
  const [note, setNote] = React.useState(row.external_note ?? '')

  React.useEffect(() => {
    if (!open) return
    setStatus(row.external_status as ExternalReqStatus)
    setNote(row.external_note ?? '')
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reserved_vehicles')
        .update({
          external_status: status,
          external_note: note || null,
        })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Edit vehicle booking</Dialog.Title>
        <Field label="External status">
          <Select.Root
            value={status}
            onValueChange={(v) => setStatus(v as ExternalReqStatus)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="planned">planned</Select.Item>
              <Select.Item value="requested">requested</Select.Item>
              <Select.Item value="confirmed">confirmed</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>
        <Field label="Note">
          <TextField.Root
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
// no local time helpers needed here

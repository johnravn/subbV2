// src/features/jobs/components/dialogs/BookVehicleDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  SegmentedControl,
  Select,
  Separator,
  Switch,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { jobDetailQuery } from '@features/jobs/api/queries'
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
  const { success, error: showError } = useToast()
  const [vehicleId, setVehicleId] = React.useState<UUID | ''>('')
  const [status, setStatus] = React.useState<ExternalReqStatus>('planned')
  const [note, setNote] = React.useState('')
  const [timePeriodStartAt, setTimePeriodStartAt] = React.useState<string>('')
  const [timePeriodEndAt, setTimePeriodEndAt] = React.useState<string>('')

  const [showExternalVehicles, setShowExternalVehicles] = React.useState(false)

  // Fetch job details
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })

  // Fetch vehicles with owner information
  const { data: vehicles = [] } = useQuery({
    queryKey: ['company', companyId, 'vehicles-with-owners'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(
          'id, name, external_owner_id, external_owner:external_owner_id(id, name)',
        )
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return (data || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        external_owner_id: v.external_owner_id,
        external_owner: Array.isArray(v.external_owner)
          ? v.external_owner[0] || null
          : v.external_owner || null,
      })) as Array<{
        id: UUID
        name: string
        external_owner_id: UUID | null
        external_owner: { id: UUID; name: string } | null
      }>
    },
  })

  // Auto-generated title based on selected vehicle
  const timePeriodTitle = React.useMemo(() => {
    if (!vehicleId) return ''
    const selected = vehicles.find((v) => v.id === vehicleId)
    if (!selected) return ''

    if (selected.external_owner_id && selected.external_owner) {
      return `${selected.external_owner.name} Transport period`
    }
    return `${selected.name} Transport period`
  }, [vehicleId, vehicles])

  // Set default dates when vehicle changes
  React.useEffect(() => {
    if (!open || !vehicleId || !job) return

    // Set default dates from job
    if (job.start_at) {
      setTimePeriodStartAt(job.start_at)
    }
    if (job.end_at) {
      setTimePeriodEndAt(job.end_at)
    }
  }, [open, vehicleId, job])

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setVehicleId('')
      setStatus('planned')
      setNote('')
      setTimePeriodStartAt('')
      setTimePeriodEndAt('')
      setShowExternalVehicles(false)
    }
  }, [open])

  // Filter vehicles based on toggle
  const filteredVehicles = React.useMemo(() => {
    if (showExternalVehicles) {
      return vehicles.filter((v) => v.external_owner_id !== null)
    }
    return vehicles.filter((v) => v.external_owner_id === null)
  }, [vehicles, showExternalVehicles])

  // Clear selection if selected vehicle is not in filtered list
  React.useEffect(() => {
    if (vehicleId && !filteredVehicles.find((v) => v.id === vehicleId)) {
      setVehicleId('')
    }
  }, [filteredVehicles, vehicleId])

  const save = useMutation({
    mutationFn: async () => {
      if (!vehicleId) throw new Error('Choose a vehicle')
      if (!timePeriodTitle) throw new Error('Time period title required')
      if (!timePeriodStartAt || !timePeriodEndAt)
        throw new Error('Time period dates required')
      if (!job) throw new Error('Job not loaded')

      const selected = vehicles.find((v) => v.id === vehicleId)
      if (!selected) throw new Error('Vehicle not found')

      // Always create a new time period for both internal and external vehicles
      const startAt = timePeriodStartAt
      const endAt = timePeriodEndAt

      const { data: newTp, error: createErr } = await supabase
        .from('time_periods')
        .insert({
          job_id: jobId,
          company_id: companyId,
          title: timePeriodTitle,
          start_at: startAt,
          end_at: endAt,
          category: 'transport',
        })
        .select('id')
        .single()
      if (createErr) throw createErr

      const payload: any = {
        time_period_id: newTp.id,
        vehicle_id: vehicleId,
      }
      if (selected.external_owner_id) {
        payload.external_status = status
        if (note.trim()) {
          payload.external_note = note.trim()
        }
      }
      // Note is only stored for external vehicles as external_note
      // Internal vehicles don't have a note field in reserved_vehicles

      const { error } = await supabase.from('reserved_vehicles').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Success', 'Vehicle booked successfully')
      onOpenChange(false)
    },
    onError: (err: any) => {
      showError('Failed to book vehicle', err?.message || 'Please try again.')
    },
  })

  const selected = vehicles.find((v) => v.id === vehicleId)
  const isExternal = !!selected?.external_owner_id

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Book vehicle</Dialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <Field label="Vehicle">
            <Flex justify="between" align="center">
              <Flex align="center" gap="2">
                <Box style={{ flex: 1 }}>
                  <Select.Root
                    value={vehicleId}
                    onValueChange={(v) => setVehicleId(v)}
                  >
                    <Select.Trigger placeholder="Select vehicle…" />
                    <Select.Content>
                      {filteredVehicles.map((v) => (
                        <Select.Item key={v.id} value={v.id}>
                          {v.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
                {selected && isExternal && selected.external_owner && (
                  <Flex align="center" gap="2">
                    <Badge size="2" variant="soft">
                      {selected.external_owner.name}
                    </Badge>
                  </Flex>
                )}
              </Flex>
              <Flex align="center" gap="2">
                <Text size="2">Show external vehicles</Text>
                <Switch
                  checked={showExternalVehicles}
                  onCheckedChange={setShowExternalVehicles}
                />
              </Flex>
            </Flex>
          </Field>

          <Field label="Time Period">
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a5)',
                borderRadius: 8,
                background: 'var(--gray-a2)',
              }}
            >
              <Text size="2" weight="medium">
                {timePeriodTitle || '—'}
              </Text>
            </Box>
          </Field>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="Start"
                value={timePeriodStartAt}
                onChange={setTimePeriodStartAt}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <DateTimePicker
                label="End"
                value={timePeriodEndAt}
                onChange={setTimePeriodEndAt}
              />
            </Box>
          </Flex>

          {vehicleId && isExternal && (
            <>
              <Field label="Status">
                <SegmentedControl.Root
                  size="2"
                  value={status}
                  onValueChange={(v) => setStatus(v as ExternalReqStatus)}
                >
                  <SegmentedControl.Item value="planned">
                    Planned
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="requested">
                    Requested
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="confirmed">
                    Confirmed
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </Field>

              <Field label="Note">
                <TextField.Root
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note…"
                />
              </Field>
            </>
          )}

          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="classic"
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !vehicleId ||
                !timePeriodTitle ||
                !timePeriodStartAt ||
                !timePeriodEndAt
              }
            >
              {save.isPending ? 'Saving…' : 'Book vehicle'}
            </Button>
          </Flex>
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
  const { success, error: showError } = useToast()
  const isExternal = row.external_status !== null

  const [status, setStatus] = React.useState<ExternalReqStatus>(
    row.external_status ?? 'planned',
  )
  const [note, setNote] = React.useState(row.external_note ?? '')

  React.useEffect(() => {
    if (!open) return
    setStatus(row.external_status ?? 'planned')
    setNote(row.external_note ?? '')
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      if (!isExternal) {
        // Internal vehicles have nothing to edit
        throw new Error('Internal vehicles cannot be edited')
      }

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
      success('Success', 'Vehicle booking updated')
      onOpenChange(false)
    },
    onError: (err: any) => {
      showError('Failed to update', err?.message || 'Please try again.')
    },
  })

  // For internal vehicles, show message that there's nothing to edit
  if (!isExternal) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Edit vehicle booking</Dialog.Title>
          <Separator my="3" />
          <Text size="2" color="gray" mb="4">
            Internal vehicles don't have editable fields. You can delete the
            booking if needed.
          </Text>
          <Flex justify="end">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Edit vehicle booking</Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="4">
          <Field label="Status">
            <SegmentedControl.Root
              size="2"
              value={status}
              onValueChange={(v) => setStatus(v as ExternalReqStatus)}
            >
              <SegmentedControl.Item value="planned">
                Planned
              </SegmentedControl.Item>
              <SegmentedControl.Item value="requested">
                Requested
              </SegmentedControl.Item>
              <SegmentedControl.Item value="confirmed">
                Confirmed
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Field>

          <Field label="Note">
            <TextField.Root
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
            />
          </Field>

          <Separator my="2" />

          <Flex justify="end" gap="2">
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

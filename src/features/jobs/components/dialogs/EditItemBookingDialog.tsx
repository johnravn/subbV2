// src/features/jobs/components/dialogs/EditItemBookingDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import type { ExternalReqStatus, ReservedItemRow } from '../../types'

export default function EditItemBookingDialog({
  open,
  onOpenChange,
  row,
  jobId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: ReservedItemRow
  jobId: string
}) {
  const qc = useQueryClient()
  const [quantity, setQuantity] = React.useState<number>(row.quantity)
  const [status, setStatus] = React.useState<ExternalReqStatus>(
    row.external_status ?? 'planned',
  )
  const [note, setNote] = React.useState(row.external_note ?? '')

  const [useTimePeriodWindow, setUseTimePeriodWindow] = React.useState<boolean>(
    !row.start_at && !row.end_at,
  )
  const [lineStart, setLineStart] = React.useState<string>(
    row.start_at || '',
  )
  const [lineEnd, setLineEnd] = React.useState<string>(
    row.end_at || '',
  )

  React.useEffect(() => {
    if (!open) return
    setQuantity(row.quantity)
    setStatus(row.external_status as ExternalReqStatus)
    setNote(row.external_note ?? '')
    setUseTimePeriodWindow(!row.start_at && !row.end_at)
    setLineStart(row.start_at || '')
    setLineEnd(row.end_at || '')
  }, [open, row])

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        quantity,
        external_status: status,
        external_note: note,
      }
      if (useTimePeriodWindow) {
        payload.start_at = null
        payload.end_at = null
      } else {
        payload.start_at = lineStart || null
        payload.end_at = lineEnd || null
      }
      const { error } = await supabase
        .from('reserved_items')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Edit item booking</Dialog.Title>
        <Field label="Quantity">
          <TextField.Root
            type="number"
            min="1"
            value={String(quantity)}
            onChange={(e) =>
              setQuantity(Math.max(1, Number(e.target.value || 1)))
            }
          />
        </Field>
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
        <Field label="Timing">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={useTimePeriodWindow}
              onChange={(e) => setUseTimePeriodWindow(e.target.checked)}
            />
            <span>Use time period window</span>
          </label>
          {!useTimePeriodWindow && (
            <Flex gap="2" mt="2">
              <Box style={{ flex: 1 }}>
                <DateTimePicker
                  label="Start"
                  value={lineStart}
                  onChange={setLineStart}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <DateTimePicker
                  label="End"
                  value={lineEnd}
                  onChange={setLineEnd}
                />
              </Box>
            </Flex>
          )}
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


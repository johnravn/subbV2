import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Select, TextField } from '@radix-ui/themes'
import { Calendar, Edit, Plus } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import type { TimePeriodLite } from '@features/jobs/types'

type Props = {
  jobId: string
  value: string | null
  onChange: (timePeriodId: string | null) => void
}

export default function TimePeriodPicker({ jobId, value, onChange }: Props) {
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)

  const save = useMutation({
    mutationFn: async (p: {
      id?: string
      title: string
      start_at: string
      end_at: string
    }) => {
      if (!companyId) throw new Error('No companyId')
      const id = await upsertTimePeriod({
        id: p.id,
        job_id: jobId,
        company_id: companyId,
        title: p.title,
        start_at: p.start_at,
        end_at: p.end_at,
      })
      return id
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      onChange(id)
      setEditing(null)
      success('Success', 'Time period saved successfully')
    },
    onError: (e: any) => {
      error('Failed to update', e?.hint || e?.message || 'Please try again.')
    },
  })

  return (
    <Box
      mb="3"
      p="2"
      style={{ border: '1px dashed var(--gray-a6)', borderRadius: 10 }}
    >
      <Flex direction={'column'} align="start" gap="2">
        <Flex align="center" gap="2">
          <Calendar />
          <strong>Time period</strong>
        </Flex>
        <Flex
          align="center"
          justify="between"
          gap="2"
          wrap="wrap"
          width={'100%'}
        >
          <Flex align="center" gap="2">
            <Select.Root
              value={value ?? ''}
              onValueChange={(v) => onChange(v || null)}
            >
              <Select.Trigger placeholder="Select time period…" />
              <Select.Content>
                {timePeriods.map((r) => (
                  <Select.Item key={r.id} value={r.id}>
                    {r.title || '(untitled)'} — {fmt(r.start_at)} →{' '}
                    {fmt(r.end_at)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {value && (
              <Button
                size="1"
                variant="soft"
                onClick={() => {
                  const r = timePeriods.find((x) => x.id === value) || null
                  setEditing(r)
                }}
              >
                <Edit width={14} height={14} /> Edit
              </Button>
            )}
          </Flex>
          <Button
            size="1"
            onClick={() =>
              setEditing({
                id: '' as any,
                job_id: jobId,
                company_id: companyId!,
                title: '',
                start_at: isoLocalStart(), // see util below
                end_at: isoLocalEnd(),
              } as TimePeriodLite)
            }
          >
            <Plus width={14} height={14} /> New time period
          </Button>
        </Flex>
      </Flex>

      {/* inline editor (minimal) */}
      {editing && (
        <Box
          mt="2"
          p="2"
          style={{ background: 'var(--gray-2)', borderRadius: 8 }}
        >
          <Flex gap="2" wrap="wrap" align="center">
            <TextField.Root
              placeholder="Title"
              value={editing.title ?? ''}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
            <TextField.Root
              type="datetime-local"
              value={toLocal(editing.start_at)}
              onChange={(e) =>
                setEditing({ ...editing, start_at: fromLocal(e.target.value) })
              }
            />
            <TextField.Root
              type="datetime-local"
              value={toLocal(editing.end_at)}
              onChange={(e) =>
                setEditing({ ...editing, end_at: fromLocal(e.target.value) })
              }
            />
            <Flex gap="2" ml="auto">
              <Button size="1" variant="soft" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                size="1"
                variant="classic"
                onClick={() =>
                  save.mutate({
                    id: editing.id || undefined,
                    title: editing.title ?? '',
                    start_at: editing.start_at,
                    end_at: editing.end_at,
                  })
                }
              >
                Save
              </Button>
            </Flex>
          </Flex>
        </Box>
      )}
    </Box>
  )
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

// datetime-local ↔ ISO helpers (preserve local timezone semantics)
function toLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const da = pad(d.getDate())
  const h = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${y}-${m}-${da}T${h}:${mi}`
}
function fromLocal(local: string) {
  // Treat as local time, convert to ISO with timezone
  const d = new Date(local)
  return d.toISOString()
}
function isoLocalStart() {
  return new Date().toISOString()
}
function isoLocalEnd() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
}

import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Separator,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Plus, Trash } from 'iconoir-react'
import {
  jobDetailQuery,
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import type { JobStatus, TimePeriodLite } from '@features/jobs/types'

const JOB_STATUS_ORDER: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'invoiced',
  'paid',
]

export default function TimelineTab({ jobId }: { jobId: string }) {
  const { data: job } = useQuery(jobDetailQuery({ jobId }))

  if (!job) return <Text>Loading...</Text>

  return (
    <Box>
      {/* Job Status Timeline */}
      <Card mb="4">
        <Heading size="3" mb="3">
          Job Status
        </Heading>
        <JobStatusTimeline jobId={jobId} currentStatus={job.status} />
      </Card>

      {/* Time Periods Management */}
      <Card>
        <Heading size="3" mb="3">
          Time Periods
        </Heading>
        <TimePeriodsManager jobId={jobId} />
      </Card>
    </Box>
  )
}

function JobStatusTimeline({
  jobId,
  currentStatus,
}: {
  jobId: string
  currentStatus: JobStatus
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const currentIndex = JOB_STATUS_ORDER.indexOf(currentStatus)
  const isCanceled = currentStatus === 'canceled'

  const updateStatus = useMutation({
    mutationFn: async (newStatus: JobStatus) => {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
      if (updateError) throw updateError
    },
    onSuccess: async (_, newStatus) => {
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      success(
        'Status updated',
        `Job status changed to ${makeWordPresentable(newStatus)}`,
      )
    },
    onError: (err: any) => {
      error('Failed to update status', err?.message || 'Please try again.')
    },
  })

  return (
    <Box>
      {/* Progress Bar */}
      <Flex direction="column" gap="2" mb="4">
        <Flex align="center" justify="between">
          {JOB_STATUS_ORDER.filter((s) => s !== 'canceled').map(
            (status, idx) => {
              const isActive = status === currentStatus
              const isPast = idx < currentIndex && !isCanceled
              const isFuture = idx > currentIndex || isCanceled

              return (
                <Flex
                  key={status}
                  direction="column"
                  align="center"
                  style={{
                    flex: 1,
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: updateStatus.isPending ? 0.6 : 1,
                  }}
                  onClick={() => {
                    if (!updateStatus.isPending && status !== currentStatus) {
                      updateStatus.mutate(status)
                    }
                  }}
                >
                  {/* Connector line */}
                  {idx < JOB_STATUS_ORDER.length - 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '16px',
                        left: '50%',
                        width: '100%',
                        height: '2px',
                        background: isPast
                          ? 'var(--accent-9)'
                          : 'var(--gray-a5)',
                        zIndex: 0,
                      }}
                    />
                  )}

                  {/* Status dot */}
                  <Box
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isActive
                        ? 'var(--accent-9)'
                        : isPast
                          ? 'var(--accent-9)'
                          : 'var(--gray-a5)',
                      border: isActive
                        ? '3px solid var(--accent-a9)'
                        : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      position: 'relative',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    className="status-dot"
                  >
                    {isPast && (
                      <Text size="1" style={{ color: 'white' }}>
                        ✓
                      </Text>
                    )}
                  </Box>

                  {/* Status label */}
                  <Text
                    size="1"
                    mt="2"
                    weight={isActive ? 'bold' : 'regular'}
                    style={{
                      color: isActive
                        ? 'var(--accent-11)'
                        : isFuture
                          ? 'var(--gray-a9)'
                          : 'inherit',
                    }}
                  >
                    {makeWordPresentable(status)}
                  </Text>
                </Flex>
              )
            },
          )}
        </Flex>
      </Flex>

      {/* Current Status Badge */}
      <Flex align="center" gap="2">
        <Text size="2" weight="medium">
          Current:
        </Text>
        <Badge size="2" variant="solid" color={isCanceled ? 'red' : 'blue'}>
          {makeWordPresentable(currentStatus)}
        </Badge>
      </Flex>

      {/* Add hover styles */}
      <style>{`
        .status-dot:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </Box>
  )
}

function TimePeriodsManager({ jobId }: { jobId: string }) {
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)
  const [deleting, setDeleting] = React.useState<TimePeriodLite | null>(null)

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      setEditing(null)
      success('Success', 'Time period saved successfully')
    },
    onError: (e: any) => {
      error('Failed to save', e?.hint || e?.message || 'Please try again.')
    },
  })

  const deleteTimePeriod = useMutation({
    mutationFn: async (periodId: string) => {
      // Find the "Job duration" time period to reassign items to
      const jobDuration = timePeriods.find((tp) =>
        tp.title?.toLowerCase().includes('job duration'),
      )
      if (!jobDuration) {
        throw new Error('Job duration time period not found. Cannot delete.')
      }

      // Reassign all reserved_items to job duration
      const { error: itemsErr } = await supabase
        .from('reserved_items')
        .update({ time_period_id: jobDuration.id })
        .eq('time_period_id', periodId)
      if (itemsErr) throw itemsErr

      // Reassign all reserved_crew to job duration
      const { error: crewErr } = await supabase
        .from('reserved_crew')
        .update({ time_period_id: jobDuration.id })
        .eq('time_period_id', periodId)
      if (crewErr) throw crewErr

      // Reassign all reserved_vehicles to job duration
      const { error: vehiclesErr } = await supabase
        .from('reserved_vehicles')
        .update({ time_period_id: jobDuration.id })
        .eq('time_period_id', periodId)
      if (vehiclesErr) throw vehiclesErr

      // Now delete the time period
      const { error: deleteErr } = await supabase
        .from('time_periods')
        .delete()
        .eq('id', periodId)
      if (deleteErr) throw deleteErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs.vehicles', jobId] })
      setDeleting(null)
      success(
        'Deleted',
        'Time period deleted and items reassigned to Job duration',
      )
    },
    onError: (e: any) => {
      error('Failed to delete', e?.hint || e?.message || 'Please try again.')
    },
  })

  const isJobDuration = (tp: TimePeriodLite) =>
    tp.title?.toLowerCase().includes('job duration')

  return (
    <Box>
      {/* Time Periods Table */}
      <Table.Root variant="surface" mb="3">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ width: '120px' }}>
              Actions
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {timePeriods.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <Text size="2" color="gray">
                  No time periods yet
                </Text>
              </Table.Cell>
            </Table.Row>
          )}
          {timePeriods.map((tp) => (
            <Table.Row key={tp.id}>
              <Table.Cell>
                <Flex align="center" gap="2">
                  <Text weight={isJobDuration(tp) ? 'bold' : 'regular'}>
                    {tp.title || '(untitled)'}
                  </Text>
                  {isJobDuration(tp) && (
                    <Badge size="1" color="orange">
                      Required
                    </Badge>
                  )}
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(tp.start_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(tp.end_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Flex gap="1">
                  <IconButton
                    size="1"
                    variant="ghost"
                    onClick={() => setEditing(tp)}
                  >
                    <Edit width={14} height={14} />
                  </IconButton>
                  {!isJobDuration(tp) && (
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() => setDeleting(tp)}
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {/* Add New Button */}
      <Button
        size="2"
        onClick={() =>
          setEditing({
            id: '' as any,
            job_id: jobId,
            company_id: companyId!,
            title: '',
            start_at: new Date().toISOString(),
            end_at: new Date(Date.now() + 86400000).toISOString(), // +1 day
          } as TimePeriodLite)
        }
      >
        <Plus width={16} height={16} /> Add time period
      </Button>

      {/* Edit Dialog */}
      {editing && (
        <EditTimePeriodDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          timePeriod={editing}
          onSave={(data) => save.mutate(data)}
          isSaving={save.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleting && (
        <Dialog.Root
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Time Period?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to delete "{deleting.title}"? All items,
              crew, and vehicles in this period will be reassigned to "Job
              duration".
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button variant="soft" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => deleteTimePeriod.mutate(deleting.id)}
                disabled={deleteTimePeriod.isPending}
              >
                {deleteTimePeriod.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

function EditTimePeriodDialog({
  open,
  onOpenChange,
  timePeriod,
  onSave,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  timePeriod: TimePeriodLite
  onSave: (data: {
    id?: string
    title: string
    start_at: string
    end_at: string
  }) => void
  isSaving: boolean
}) {
  const [title, setTitle] = React.useState(timePeriod.title || '')
  const [startAt, setStartAt] = React.useState(
    toLocalInput(timePeriod.start_at),
  )
  const [endAt, setEndAt] = React.useState(toLocalInput(timePeriod.end_at))

  const handleSave = () => {
    onSave({
      id: timePeriod.id || undefined,
      title: title.trim(),
      start_at: fromLocalInput(startAt),
      end_at: fromLocalInput(endAt),
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          {timePeriod.id ? 'Edit Time Period' : 'New Time Period'}
        </Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Title
            </Text>
            <TextField.Root
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Setup, Show, Teardown"
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Start
            </Text>
            <TextField.Root
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              End
            </Text>
            <TextField.Root
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Utility functions
function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const da = pad(d.getDate())
  const h = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${y}-${m}-${da}T${h}:${mi}`
}

function fromLocalInput(local: string) {
  const d = new Date(local)
  return d.toISOString()
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n)
}

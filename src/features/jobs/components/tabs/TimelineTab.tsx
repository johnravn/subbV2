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
import { Edit, NavArrowDown, NavArrowRight, Plus, Trash } from 'iconoir-react'
import {
  jobDetailQuery,
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
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
        <TimePeriodsManager
          jobId={jobId}
          defaultStartAt={job.start_at}
          defaultEndAt={job.end_at}
        />
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

function TimePeriodsManager({
  jobId,
  defaultStartAt,
  defaultEndAt,
}: {
  jobId: string
  defaultStartAt: string | null
  defaultEndAt: string | null
}) {
  const qc = useQueryClient()
  const { companyId } = useCompany()
  const { data: timePeriods = [] } = useQuery(jobTimePeriodsQuery({ jobId }))
  const { success, error } = useToast()

  const [editing, setEditing] = React.useState<TimePeriodLite | null>(null)
  const [deleting, setDeleting] = React.useState<TimePeriodLite | null>(null)
  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set())

  // Helper function to check if time period is Job duration
  const isJobDuration = (tp: TimePeriodLite) =>
    tp.title?.toLowerCase().includes('job duration')

  // Separate Job duration from other periods
  const { jobDuration, otherPeriods } = React.useMemo(() => {
    const jobDurationPeriod = timePeriods.find((tp) => isJobDuration(tp))
    const others = timePeriods.filter((tp) => !isJobDuration(tp))
    return {
      jobDuration: jobDurationPeriod || null,
      otherPeriods: others,
    }
  }, [timePeriods])

  // Group other time periods by category
  const groupedPeriods = React.useMemo(() => {
    const groups = new Map<
      'program' | 'equipment' | 'crew' | 'transport',
      Array<TimePeriodLite>
    >()
    const defaultCategory: 'program' | 'equipment' | 'crew' | 'transport' =
      'program'

    for (const tp of otherPeriods) {
      const category = tp.category || defaultCategory
      const existing = groups.get(category) || []
      existing.push(tp)
      groups.set(category, existing)
    }

    return groups
  }, [otherPeriods])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const categoryLabels: Record<
    'program' | 'equipment' | 'crew' | 'transport',
    string
  > = {
    program: 'Program',
    equipment: 'Equipment',
    crew: 'Crew',
    transport: 'Transport',
  }

  const categoryOrder: Array<'program' | 'equipment' | 'crew' | 'transport'> = [
    'program',
    'equipment',
    'crew',
    'transport',
  ]

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
      const durationPeriod = timePeriods.find((tp) =>
        tp.title?.toLowerCase().includes('job duration'),
      )
      if (!durationPeriod) {
        throw new Error('Job duration time period not found. Cannot delete.')
      }

      // Reassign all reserved_items to job duration
      const { error: itemsErr } = await supabase
        .from('reserved_items')
        .update({ time_period_id: durationPeriod.id })
        .eq('time_period_id', periodId)
      if (itemsErr) throw itemsErr

      // Reassign all reserved_crew to job duration
      const { error: crewErr } = await supabase
        .from('reserved_crew')
        .update({ time_period_id: durationPeriod.id })
        .eq('time_period_id', periodId)
      if (crewErr) throw crewErr

      // Reassign all reserved_vehicles to job duration
      const { error: vehiclesErr } = await supabase
        .from('reserved_vehicles')
        .update({ time_period_id: durationPeriod.id })
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

          {/* Job Duration Row (always visible at top) */}
          {jobDuration && (
            <Table.Row>
              <Table.Cell>
                <Flex align="center" gap="2">
                  <Text weight="bold">{jobDuration.title || '(untitled)'}</Text>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(jobDuration.start_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="2">{formatDateTime(jobDuration.end_at)}</Text>
              </Table.Cell>
              <Table.Cell>
                <Badge size="1" color="orange">
                  Required
                </Badge>
              </Table.Cell>
            </Table.Row>
          )}

          {/* Category Groups */}
          {categoryOrder.map((category) => {
            const periods = groupedPeriods.get(category) || []
            if (periods.length === 0) return null

            const isExpanded = expandedCategories.has(category)
            const categoryLabel = categoryLabels[category]

            return (
              <React.Fragment key={category}>
                {/* Category Header Row */}
                <Table.Row
                  style={{
                    cursor: 'pointer',
                    background: 'var(--gray-a2)',
                    fontWeight: '600',
                  }}
                  onClick={() => toggleCategory(category)}
                >
                  <Table.Cell colSpan={4}>
                    <Flex align="center" gap="2">
                      {isExpanded ? (
                        <NavArrowDown width={18} height={18} />
                      ) : (
                        <NavArrowRight width={18} height={18} />
                      )}
                      <Text weight="bold">{categoryLabel}</Text>
                      <Badge size="1" variant="soft" color="gray">
                        {periods.length}
                      </Badge>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                {/* Time Period Rows (when expanded) */}
                {isExpanded &&
                  periods.map((tp) => (
                    <Table.Row key={tp.id}>
                      <Table.Cell>
                        <Flex
                          align="center"
                          gap="2"
                          style={{ paddingLeft: 24 }}
                        >
                          <Text weight="regular">
                            {tp.title || '(untitled)'}
                          </Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatDateTime(tp.start_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{formatDateTime(tp.end_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap="2">
                          <IconButton
                            size="1"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(tp)
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="1"
                            variant="ghost"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleting(tp)
                            }}
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </React.Fragment>
            )
          })}
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
            start_at: defaultStartAt || new Date().toISOString(),
            end_at:
              defaultEndAt || new Date(Date.now() + 86400000).toISOString(),
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
  const [startAt, setStartAt] = React.useState(timePeriod.start_at)
  const [endAt, setEndAt] = React.useState(timePeriod.end_at)

  const handleSave = () => {
    onSave({
      id: timePeriod.id || undefined,
      title: title.trim(),
      start_at: startAt,
      end_at: endAt,
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
          <Box>
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
            {!timePeriod.id && (
              <Flex gap="2" wrap="wrap" mt="2">
                <Text size="1" color="gray" style={{ width: '100%' }}>
                  Quick suggestions:
                </Text>
                {[
                  'Equipment period',
                  'Crew period',
                  'Vehicle period',
                  'Setup',
                  'Show',
                  'Teardown',
                  'Load in',
                  'Load out',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    size="1"
                    variant="soft"
                    color="gray"
                    onClick={() => setTitle(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Flex>
            )}
          </Box>

          <DateTimePicker label="Start" value={startAt} onChange={setStartAt} />
          <DateTimePicker label="End" value={endAt} onChange={setEndAt} />
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

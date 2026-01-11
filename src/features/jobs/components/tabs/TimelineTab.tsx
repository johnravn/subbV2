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
import { Edit, NavArrowDown, NavArrowRight, Trash } from 'iconoir-react'
import {
  jobDetailQuery,
  jobTimePeriodsQuery,
  upsertTimePeriod,
} from '@features/jobs/api/queries'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { supabase } from '@shared/api/supabase'
import {
  addThreeHours,
  makeWordPresentable,
} from '@shared/lib/generalFunctions'
import { logActivity } from '@features/latest/api/queries'
import type { JobStatus, TimePeriodLite } from '@features/jobs/types'

// Main flow statuses (canceled is separate)
const JOB_STATUS_FLOW: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
]

// Subtle color variants using blue-to-green gradient progression
const getStatusColor = (status: JobStatus): { bg: string; border: string; text: string; dotBg: string } => {
  // Use a single blue color family with progressive intensity
  const baseBlue = 'var(--blue-9)'
  const baseGreen = 'var(--green-9)'
  
  switch (status) {
    case 'draft':
      return {
        bg: 'var(--blue-3)',
        border: 'var(--blue-6)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-5)',
      }
    case 'planned':
      return {
        bg: 'var(--blue-4)',
        border: 'var(--blue-7)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-6)',
      }
    case 'requested':
      return {
        bg: 'var(--blue-5)',
        border: 'var(--blue-8)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-7)',
      }
    case 'confirmed':
      return {
        bg: 'var(--blue-6)',
        border: 'var(--blue-9)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-8)',
      }
    case 'in_progress':
      return {
        bg: 'var(--blue-7)',
        border: 'var(--blue-10)',
        text: 'var(--blue-11)',
        dotBg: 'var(--blue-9)',
      }
    case 'completed':
      return {
        bg: 'var(--blue-8)',
        border: 'var(--blue-11)',
        text: 'var(--blue-12)',
        dotBg: 'var(--blue-10)',
      }
    case 'invoiced':
      return {
        bg: 'var(--teal-6)',
        border: 'var(--teal-9)',
        text: 'var(--teal-11)',
        dotBg: 'var(--teal-8)',
      }
    case 'paid':
      return {
        bg: 'var(--green-7)',
        border: 'var(--green-10)',
        text: 'var(--green-12)',
        dotBg: 'var(--green-9)',
      }
    case 'canceled':
      return {
        bg: 'var(--red-3)',
        border: 'var(--red-6)',
        text: 'var(--red-11)',
        dotBg: 'var(--red-5)',
      }
  }
}

const STATUS_COLORS: Record<JobStatus, { bg: string; border: string; text: string; dotBg: string }> = {
  draft: getStatusColor('draft'),
  planned: getStatusColor('planned'),
  requested: getStatusColor('requested'),
  confirmed: getStatusColor('confirmed'),
  in_progress: getStatusColor('in_progress'),
  completed: getStatusColor('completed'),
  invoiced: getStatusColor('invoiced'),
  paid: getStatusColor('paid'),
  canceled: getStatusColor('canceled'),
}

// Helper function to mask status for freelancers
function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    // Freelancers should not see statuses beyond 'completed'
    if (status === 'invoiced' || status === 'paid') {
      return 'completed'
    }
  }
  return status
}

export default function TimelineTab({ jobId }: { jobId: string }) {
  const { data: job } = useQuery(jobDetailQuery({ jobId }))
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'

  if (!job) return <Text>Loading...</Text>

  return (
    <Box>
      {/* Job Status Timeline - Hidden for freelancers */}
      {!isReadOnly && (
        <Card mb="4" style={{ background: 'var(--gray-a2)' }}>
          <Heading size="3" mb="3">
            Job Status
          </Heading>
          <JobStatusTimeline
            jobId={jobId}
            currentStatus={job.status}
            jobTitle={job.title}
            companyId={job.company_id}
          />
        </Card>
      )}

      {/* Time Periods Management */}
      <Card style={{ background: 'var(--gray-a2)' }}>
        <Heading size="3" mb="3">
          Time Periods
        </Heading>
        <TimePeriodsManager
          jobId={jobId}
          jobStartAt={job.start_at}
          jobEndAt={job.end_at}
        />
      </Card>
    </Box>
  )
}

function JobStatusTimeline({
  jobId,
  currentStatus,
  jobTitle,
  companyId,
}: {
  jobId: string
  currentStatus: JobStatus
  jobTitle: string
  companyId: string
}) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { companyRole } = useAuthz()
  const displayStatus = getDisplayStatus(currentStatus, companyRole)
  const isCanceled = displayStatus === 'canceled'
  const [pendingStatusChange, setPendingStatusChange] =
    React.useState<JobStatus | null>(null)

  const updateStatus = useMutation({
    mutationFn: async (newStatus: JobStatus) => {
      const previousStatus = currentStatus
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
      if (updateError) throw updateError

      // Log activity if status changed to confirmed, canceled, or paid
      if (
        previousStatus !== newStatus &&
        (newStatus === 'confirmed' ||
          newStatus === 'canceled' ||
          newStatus === 'paid')
      ) {
        try {
          await logActivity({
            companyId,
            activityType: 'job_status_changed',
            metadata: {
              job_id: jobId,
              job_title: jobTitle,
              previous_status: previousStatus,
              new_status: newStatus,
            },
            title: jobTitle,
          })
        } catch (logErr) {
          console.error('Failed to log job status change activity:', logErr)
          // Don't fail the whole status update if logging fails
        }
      }

      return newStatus
    },
    onSuccess: async (newStatus) => {
      // Invalidate and refetch queries
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
        // Force refetch of latest feed to ensure new activity appears immediately
        qc.refetchQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      success(
        'Status updated',
        `Job status changed to ${makeWordPresentable(newStatus)}`,
      )
    },
    onError: (err: any) => {
      error('Failed to update status', err?.message || 'Please try again.')
    },
  })

  // Filter statuses for freelancers - only show up to 'completed'
  const flowStatuses = React.useMemo(() => {
    if (companyRole === 'freelancer') {
      return JOB_STATUS_FLOW.filter((s) => s !== 'invoiced' && s !== 'paid')
    }
    return JOB_STATUS_FLOW
  }, [companyRole])

  // Find current position in flow
  const currentFlowIndex = flowStatuses.indexOf(displayStatus)

  return (
    <Box>
      {/* Main Flow Timeline */}
      <Flex direction="column" gap="3" mb="4">
        <Flex align="center" gap="2" style={{ position: 'relative' }}>
          {/* Main Flow Statuses */}
          <Flex align="center" style={{ flex: 1 }} gap="0">
            {flowStatuses.map((status, idx) => {
              const isActive = status === displayStatus && !isCanceled
              const statusIndex = flowStatuses.indexOf(status)
              const isPast = !isCanceled && statusIndex < currentFlowIndex && statusIndex >= 0
              const isFuture = statusIndex > currentFlowIndex
              const colors = STATUS_COLORS[status]
              const nextColors = idx < flowStatuses.length - 1 ? STATUS_COLORS[flowStatuses[idx + 1]] : null

              return (
                <React.Fragment key={status}>
                  <Flex
                    direction="column"
                    align="center"
                    style={{
                      flex: 1,
                      position: 'relative',
                      cursor: companyRole === 'freelancer' ? 'default' : 'pointer',
                      opacity: updateStatus.isPending ? 0.5 : 1,
                      pointerEvents: companyRole === 'freelancer' ? 'none' : 'auto',
                      minWidth: 0,
                    }}
                    onClick={() => {
                      if (
                        companyRole !== 'freelancer' &&
                        !updateStatus.isPending &&
                        status !== displayStatus
                      ) {
                        setPendingStatusChange(status)
                      }
                    }}
                  >
                    {/* Connector line to next status */}
                    {idx < flowStatuses.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: '50%',
                          width: 'calc(100% - 28px)',
                          height: '2px',
                          background: isPast || isActive
                            ? nextColors
                              ? `linear-gradient(to right, ${colors.dotBg}, ${nextColors.dotBg})`
                              : colors.dotBg
                            : 'var(--gray-a4)',
                          zIndex: 0,
                          borderRadius: '1px',
                          transition: 'background 0.4s ease',
                          opacity: isFuture ? 0.4 : 1,
                        }}
                      />
                    )}

                    {/* Status dot */}
                    <Box
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isActive 
                          ? colors.dotBg 
                          : isPast 
                            ? colors.dotBg
                            : 'var(--gray-a3)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                        position: 'relative',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      className="status-dot"
                    >
                      {(isPast || (isActive && status === 'paid')) && (
                        <Text size="1" weight="bold" style={{ color: 'white', fontSize: '12px' }}>
                          ✓
                        </Text>
                      )}
                      {isActive && status !== 'paid' && (
                        <Box
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'white',
                          }}
                        />
                      )}
                    </Box>

                    {/* Status label */}
                    <Text
                      size="1"
                      mt="2"
                      weight={isActive ? 'medium' : 'regular'}
                      style={{
                        color: isActive || isPast ? colors.text : 'var(--gray-a9)',
                        textAlign: 'center',
                        transition: 'color 0.3s ease',
                        fontSize: '11px',
                        opacity: isFuture ? 0.5 : 1,
                      }}
                    >
                      {makeWordPresentable(status)}
                    </Text>
                  </Flex>
                </React.Fragment>
              )
            })}
          </Flex>

          {/* Separator */}
          {!isCanceled && (
            <Box
              style={{
                width: '1px',
                height: '50px',
                background: 'var(--gray-a4)',
                margin: '0 20px',
                opacity: 0.5,
              }}
            />
          )}

          {/* Canceled Status (on the right) */}
          <Flex
            direction="column"
            align="center"
            style={{
              cursor: companyRole === 'freelancer' ? 'default' : 'pointer',
              opacity: updateStatus.isPending ? 0.5 : 1,
              pointerEvents: companyRole === 'freelancer' ? 'none' : 'auto',
              minWidth: '70px',
            }}
            onClick={() => {
              if (
                companyRole !== 'freelancer' &&
                !updateStatus.isPending &&
                !isCanceled
              ) {
                setPendingStatusChange('canceled')
              }
            }}
          >
            <Box
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isCanceled 
                  ? STATUS_COLORS.canceled.dotBg 
                  : 'var(--gray-a3)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="status-dot"
            >
              {isCanceled && (
                <Text size="1" weight="bold" style={{ color: 'white', fontSize: '12px' }}>
                  ✕
                </Text>
              )}
            </Box>
            <Text
              size="1"
              mt="2"
              weight={isCanceled ? 'medium' : 'regular'}
              style={{
                color: isCanceled ? STATUS_COLORS.canceled.text : 'var(--gray-a9)',
                textAlign: 'center',
                transition: 'color 0.3s ease',
                fontSize: '11px',
                opacity: !isCanceled ? 0.5 : 1,
              }}
            >
              {makeWordPresentable('canceled')}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* Current Status Badge */}
      <Flex align="center" gap="2" mt="4" pt="3" style={{ borderTop: '1px solid var(--gray-a4)' }}>
        <Text size="2" weight="regular" color="gray">
          Current status:
        </Text>
        <Badge
          size="2"
          variant="soft"
          style={{
            background: STATUS_COLORS[displayStatus].bg,
            color: STATUS_COLORS[displayStatus].text,
            borderColor: STATUS_COLORS[displayStatus].border,
          }}
        >
          {makeWordPresentable(displayStatus)}
        </Badge>
      </Flex>

      {/* Subtle hover styles */}
      <style>{`
        .status-dot:hover {
          transform: scale(1.1);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .status-dot:active {
          transform: scale(1.0);
        }
      `}</style>

      {/* Confirmation Dialog */}
      {pendingStatusChange && (
        <Dialog.Root
          open={!!pendingStatusChange}
          onOpenChange={(open) => {
            if (!open && !updateStatus.isPending) {
              setPendingStatusChange(null)
            }
          }}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Change Job Status?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to change the job status from{' '}
              <strong>{makeWordPresentable(displayStatus)}</strong> to{' '}
              <strong>{makeWordPresentable(pendingStatusChange)}</strong>?
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                onClick={() => setPendingStatusChange(null)}
                disabled={updateStatus.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (pendingStatusChange) {
                    updateStatus.mutate(pendingStatusChange, {
                      onSuccess: () => {
                        setPendingStatusChange(null)
                      },
                      onError: () => {
                        // Keep dialog open on error so user can try again
                      },
                    })
                  }
                }}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? 'Updating...' : 'Confirm'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

function TimePeriodsManager({
  jobId,
  jobStartAt,
  jobEndAt,
}: {
  jobId: string
  jobStartAt: string | null
  jobEndAt: string | null
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

  // Auto-create "Job duration" if missing
  const createJobDuration = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No companyId')
      const periodStart = jobStartAt || new Date().toISOString()
      const periodEnd =
        jobEndAt || new Date(Date.now() + 86400000).toISOString() // +1 day

      await upsertTimePeriod({
        job_id: jobId,
        company_id: companyId,
        title: 'Job duration',
        start_at: periodStart,
        end_at: periodEnd,
        category: 'program',
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Created', 'Job duration time period created automatically')
    },
    onError: (e: any) => {
      error('Failed to create Job duration', e?.message || 'Please try again.')
    },
  })

  // Auto-create "Job duration" when component mounts if it's missing
  React.useEffect(() => {
    if (
      !jobDuration &&
      timePeriods.length > 0 && // Only create if we've loaded time periods (avoid race condition)
      !createJobDuration.isPending
    ) {
      createJobDuration.mutate()
    }
  }, [jobDuration, timePeriods.length, createJobDuration.isPending])

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
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
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
          open={true}
          onOpenChange={(open) => {
            if (!open && !deleteTimePeriod.isPending) {
              setDeleting(null)
            }
          }}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Time Period?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to delete "{deleting.title}"? All items,
              crew, and vehicles in this period will be reassigned to "Job
              duration".
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                onClick={() => setDeleting(null)}
                disabled={deleteTimePeriod.isPending}
              >
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
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(!timePeriod.id)

  // Auto-set end time when start time changes (only for new time periods)
  React.useEffect(() => {
    if (!startAt || !autoSetEndTime || timePeriod.id) return
    setEndAt(addThreeHours(startAt))
  }, [startAt, autoSetEndTime, timePeriod.id])

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

          <DateTimePicker
            label="Start"
            value={startAt}
            onChange={(value) => {
              setStartAt(value)
              setAutoSetEndTime(!timePeriod.id)
            }}
          />
          <DateTimePicker
            label="End"
            value={endAt}
            onChange={(value) => {
              setEndAt(value)
              setAutoSetEndTime(false)
            }}
          />
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
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + `, ${hours}:${minutes}`
  )
}

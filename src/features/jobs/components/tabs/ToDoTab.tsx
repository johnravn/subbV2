// src/features/jobs/components/tabs/ToDoTab.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { ArrowRight, CheckCircle, XmarkCircle } from 'iconoir-react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import type { JobDetail } from '../../types'

type TodoItem = {
  id: string
  type:
    | 'missing_location'
    | 'unassigned_crew'
    | 'unconfirmed_vehicle'
    | 'uninvoiced_completed'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
}

export default function ToDoTab({
  jobId,
  job,
}: {
  jobId: string
  job: JobDetail
}) {
  const navigate = useNavigate()

  // Fetch crew roles with needed_count and actual assignments
  const { data: crewRoles } = useQuery({
    queryKey: ['jobs', jobId, 'todo', 'crew-roles'],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, needed_count')
        .eq('job_id', jobId)
        .eq('category', 'crew')
        .eq('deleted', false)
      if (tpErr) throw tpErr

      if (timePeriods.length === 0) return []

      const tpIds = timePeriods.map((tp) => tp.id)
      const { data: assignments, error: assignErr } = await supabase
        .from('reserved_crew')
        .select('time_period_id')
        .in('time_period_id', tpIds)
      if (assignErr) throw assignErr

      const assignmentCounts = new Map<string, number>()
      for (const a of assignments) {
        assignmentCounts.set(
          a.time_period_id,
          (assignmentCounts.get(a.time_period_id) || 0) + 1,
        )
      }

      return timePeriods.map((tp) => ({
        id: tp.id,
        title: tp.title || 'Untitled Role',
        needed_count: tp.needed_count || 0,
        assigned_count: assignmentCounts.get(tp.id) || 0,
      }))
    },
  })

  // Fetch vehicle bookings that might need confirmation
  const { data: vehicleBookings } = useQuery({
    queryKey: ['jobs', jobId, 'todo', 'vehicles'],
    queryFn: async () => {
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)
      if (tpErr) throw tpErr

      if (timePeriods.length === 0) return []

      const tpIds = timePeriods.map((tp) => tp.id)
      const { data: bookings, error: bookErr } = await supabase
        .from('reserved_vehicles')
        .select(
          'id, vehicle_id, external_status, vehicle:vehicle_id ( id, name, external_owner_id )',
        )
        .in('time_period_id', tpIds)
      if (bookErr) throw bookErr

      // Check for bookings that might need confirmation
      // External bookings with certain statuses, or internal bookings that might need confirmation
      return bookings.map((booking: any) => ({
        id: booking.id,
        vehicle_id: booking.vehicle_id,
        external_status: booking.external_status,
        vehicle: Array.isArray(booking.vehicle)
          ? booking.vehicle[0]
          : booking.vehicle,
        is_external: !!(Array.isArray(booking.vehicle)
          ? booking.vehicle[0]?.external_owner_id
          : booking.vehicle?.external_owner_id),
      }))
    },
  })

  // Generate todo items
  const todoItems = React.useMemo<Array<TodoItem>>(() => {
    const items: Array<TodoItem> = []

    // 1. Check for missing location
    if (!job.job_address_id) {
      items.push({
        id: 'missing-location',
        type: 'missing_location',
        title: 'Missing Location',
        description: 'No location has been set for this job.',
        severity: 'high',
        actionUrl: `/jobs?jobId=${jobId}&tab=overview`,
        actionLabel: 'Add Location',
      })
    }

    // 2. Check for unassigned crew roles
    if (crewRoles) {
      crewRoles.forEach((role) => {
        if (role.needed_count > role.assigned_count) {
          const missing = role.needed_count - role.assigned_count
          items.push({
            id: `unassigned-crew-${role.id}`,
            type: 'unassigned_crew',
            title: `Unassigned Crew Role: ${role.title}`,
            description: `${missing} crew member(s) still needed (${role.assigned_count}/${role.needed_count} assigned)`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=crew`,
            actionLabel: 'Assign Crew',
            metadata: { roleId: role.id, roleTitle: role.title },
          })
        }
      })
    }

    // 3. Check for unconfirmed vehicle bookings
    // Note: This is a placeholder - you may need to adjust based on your actual confirmation logic
    // For now, we'll check for external vehicle bookings with certain statuses
    if (vehicleBookings) {
      vehicleBookings.forEach((booking) => {
        // If it's an external vehicle booking, it might need confirmation
        // Adjust this logic based on your actual requirements
        if (booking.is_external && !booking.external_status) {
          items.push({
            id: `unconfirmed-vehicle-${booking.id}`,
            type: 'unconfirmed_vehicle',
            title: `Vehicle Booking Needs Confirmation`,
            description: `External vehicle booking for "${booking.vehicle?.name || 'Unknown Vehicle'}" needs confirmation`,
            severity: 'medium',
            actionUrl: `/jobs?jobId=${jobId}&tab=transport`,
            actionLabel: 'Review Booking',
            metadata: { bookingId: booking.id },
          })
        }
      })
    }

    // 4. Check for completed jobs that aren't invoiced
    if (job.status === 'completed') {
      items.push({
        id: 'uninvoiced-completed',
        type: 'uninvoiced_completed',
        title: 'Job Completed - Invoice Required',
        description:
          'This job is marked as completed but has not been invoiced yet.',
        severity: 'high',
        actionUrl: `/jobs?jobId=${jobId}&tab=invoice`,
        actionLabel: 'Create Invoice',
      })
    }

    return items
  }, [job, crewRoles, vehicleBookings, jobId])

  const getSeverityColor = (severity: TodoItem['severity']) => {
    switch (severity) {
      case 'high':
        return 'red'
      case 'medium':
        return 'orange'
      case 'low':
        return 'blue'
      default:
        return 'gray'
    }
  }

  const handleAction = (item: TodoItem) => {
    if (item.actionUrl) {
      navigate({ to: item.actionUrl })
    }
  }

  if (todoItems.length === 0) {
    return (
      <Box>
        <Heading size="3" mb="3">
          To Do
        </Heading>
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ minHeight: '300px', padding: '40px' }}
          >
            <CheckCircle width={48} height={48} color="var(--green-9)" />
            <Text size="4" weight="medium">
              All tasks complete!
            </Text>
            <Text size="2" color="gray" align="center">
              There are no pending action items for this job.
            </Text>
          </Flex>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Heading size="3" mb="3">
        To Do ({todoItems.length})
      </Heading>
      <Flex direction="column" gap="3">
        {todoItems.map((item) => (
          <Card key={item.id}>
            <Flex gap="3" align="start">
              <Box style={{ paddingTop: '4px' }}>
                <XmarkCircle
                  width={20}
                  height={20}
                  color={`var(--${getSeverityColor(item.severity)}-9)`}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Flex gap="2" align="center" mb="2">
                  <Heading size="3">{item.title}</Heading>
                  <Box
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: `var(--${getSeverityColor(item.severity)}-3)`,
                      border: `1px solid var(--${getSeverityColor(item.severity)}-6)`,
                    }}
                  >
                    <Text
                      size="1"
                      weight="medium"
                      style={{
                        color: `var(--${getSeverityColor(item.severity)}-11)`,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.severity}
                    </Text>
                  </Box>
                </Flex>
                <Text size="2" color="gray" mb="3">
                  {item.description}
                </Text>
                {item.actionUrl && (
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => handleAction(item)}
                  >
                    {item.actionLabel || 'Fix'}
                    <ArrowRight width={14} height={14} />
                  </Button>
                )}
              </Box>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  )
}

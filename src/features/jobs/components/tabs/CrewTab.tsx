import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Flex,
  Heading,
  SegmentedControl,
  Table,
  Tabs,
  Text,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Mail, NavArrowDown, NavArrowRight, Plus } from 'iconoir-react'
import AddCrewDialog, { EditCrewDialog } from '../dialogs/AddCrewDialog'
import AddRoleDialog from '../dialogs/AddRoleDialog'
import AddCrewToRoleDialog from '../dialogs/AddCrewToRoleDialog'
import ConfirmStatusChangeDialog from '../dialogs/ConfirmStatusChangeDialog'
import type { CrewReqStatus, ReservedCrewRow } from '../../types'

export default function CrewTab({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}) {
  const [addCrewOpen, setAddCrewOpen] = React.useState(false)
  const [addRoleOpen, setAddRoleOpen] = React.useState(false)
  const [editCrew, setEditCrew] = React.useState<ReservedCrewRow | null>(null)
  const [expandedRoles, setExpandedRoles] = React.useState<Set<string>>(
    new Set(),
  )
  const [addCrewToRole, setAddCrewToRole] = React.useState<string | null>(null)
  const [statusChangeConfirm, setStatusChangeConfirm] = React.useState<{
    crewId: string
    crewName: string
    currentStatus: CrewReqStatus
    newStatus: CrewReqStatus
  } | null>(null)

  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['jobs.crew', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: rErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
      if (rErr) throw rErr
      const resIds = timePeriods.map((r) => r.id)
      if (!resIds.length) return [] as Array<ReservedCrewRow>
      const { data: rows, error } = await supabase
        .from('reserved_crew')
        .select(
          `
          id, time_period_id, user_id, notes, status,
          user:user_id ( user_id, display_name, email )
        `,
        )
        .in('time_period_id', resIds)
      if (error) throw error
      return rows as unknown as Array<ReservedCrewRow>
    },
  })

  // Roles (time periods) with counts per status
  const { data: roles = [] } = useQuery({
    queryKey: ['jobs', jobId, 'time_periods'],
    queryFn: async () => {
      // Try with is_role filter first (assumes columns exist)
      const { data: tps, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, needed_count, role_category')
        .eq('job_id', jobId)
        .eq('is_role', true)
        .order('start_at', { ascending: true })

      // If error (columns might not exist), return empty array
      // This prevents errors but shows empty state until migration is applied
      if (error) {
        console.warn(
          'is_role column may not exist yet. Please run migration:',
          error,
        )
        return []
      }

      if (tps.length === 0) return []

      // fetch crew counts grouped by status for these tps
      const tpIds = tps.map((t) => t.id)
      const statusByTp = new Map<string, Record<string, number>>()
      if (tpIds.length) {
        const { data: rows, error: cErr } = await supabase
          .from('reserved_crew')
          .select('time_period_id, status')
          .in('time_period_id', tpIds)
        if (cErr) throw cErr
        for (const r of rows) {
          const key = r.time_period_id as string
          const bag = statusByTp.get(key) || {}
          bag[r.status as string] = (bag[r.status as string] || 0) + 1
          statusByTp.set(key, bag)
        }
      }

      return tps.map((tp: any) => ({
        ...tp,
        counts: statusByTp.get(tp.id) ?? {},
      })) as Array<{
        id: string
        title: string | null
        start_at: string | null
        end_at: string | null
        needed_count?: number | null
        role_category?: string | null
        counts?: Record<string, number>
      }>
    },
  })

  // quick lookup for time period
  const roleById = React.useMemo(() => {
    const map = new Map<
      string,
      { start_at: string | null; end_at: string | null; title: string | null }
    >()
    for (const r of roles) {
      map.set(r.id, { start_at: r.start_at, end_at: r.end_at, title: r.title })
    }
    return map
  }, [roles])

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
    },
  })

  const handleStatusChange = (
    crewId: string,
    crewName: string,
    currentStatus: CrewReqStatus,
    newStatus: CrewReqStatus,
  ) => {
    if (currentStatus === newStatus) return
    setStatusChangeConfirm({
      crewId,
      crewName,
      currentStatus,
      newStatus,
    })
  }

  const confirmStatusChange = () => {
    if (!statusChangeConfirm) return
    updateStatus.mutate({
      id: statusChangeConfirm.crewId,
      status: statusChangeConfirm.newStatus,
    })
  }

  // Group roles by category
  const groupedRoles = React.useMemo(() => {
    const groups = new Map<string | null, typeof roles>()
    const noCategory: typeof roles = []

    for (const role of roles) {
      const cat = role.role_category || null
      if (!cat) {
        noCategory.push(role)
      } else {
        const existing = groups.get(cat) || []
        existing.push(role)
        groups.set(cat, existing)
      }
    }

    // Convert map to sorted array: no category first, then sorted categories
    const result: Array<{ category: string | null; roles: typeof roles }> = []
    if (noCategory.length > 0) {
      result.push({ category: null, roles: noCategory })
    }

    const sortedCategories = Array.from(groups.keys()).sort()
    for (const cat of sortedCategories) {
      result.push({ category: cat, roles: groups.get(cat)! })
    }

    return result
  }, [roles])

  // Get crew for a specific role
  const crewByRoleId = React.useMemo(() => {
    const map = new Map<string, Array<ReservedCrewRow>>()
    for (const crew of data || []) {
      const roleId = crew.time_period_id
      const existing = map.get(roleId) || []
      existing.push(crew)
      map.set(roleId, existing)
    }
    return map
  }, [data])

  const toggleRole = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  return (
    <div>
      <Tabs.Root defaultValue="roles">
        <Tabs.List mb="3">
          <Tabs.Trigger value="roles">Roles</Tabs.Trigger>
          <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="roles">
          <Box
            mb="2"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <Heading size="3">Roles</Heading>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="2" onClick={() => setAddRoleOpen(true)}>
                <Plus /> Add role
              </Button>
              <AddRoleDialog
                open={addRoleOpen}
                onOpenChange={setAddRoleOpen}
                jobId={jobId}
              />
            </div>
          </Box>

          <Box
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {groupedRoles.length === 0 && (
              <Text color="gray">No roles yet</Text>
            )}
            {groupedRoles.map((group) => (
              <Box key={group.category || 'no-category'}>
                {group.category && (
                  <Heading
                    size="4"
                    mb="2"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {group.category}
                  </Heading>
                )}
                {!group.category && (
                  <Heading size="4" mb="2">
                    Roles
                  </Heading>
                )}
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {group.roles.map((role) => {
                    const isExpanded = expandedRoles.has(role.id)
                    const counts = role.counts ?? {}
                    const roleCrew = crewByRoleId.get(role.id) || []
                    return (
                      <Box
                        key={role.id}
                        p="3"
                        style={{
                          border: '1px solid var(--gray-a6)',
                          borderRadius: 8,
                          background: 'var(--gray-a2)',
                        }}
                      >
                        <Box
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onClick={() => toggleRole(role.id)}
                        >
                          <Flex align="center" gap="2">
                            {isExpanded ? (
                              <NavArrowDown width={18} height={18} />
                            ) : (
                              <NavArrowRight width={18} height={18} />
                            )}
                            <Text weight="bold">{role.title ?? '—'}</Text>
                            <Text size="2" color="gray">
                              Needed: {role.needed_count ?? 1}
                            </Text>
                            <Text size="2" color="gray">
                              • Planned: {counts['planned'] ?? 0}
                            </Text>
                            <Text size="2" color="gray">
                              • Requested: {counts['requested'] ?? 0}
                            </Text>
                            <Text size="2" color="gray">
                              • Accepted: {counts['accepted'] ?? 0}
                            </Text>
                            <Text size="2" color="gray">
                              • Declined: {counts['declined'] ?? 0}
                            </Text>
                          </Flex>
                          <Button
                            size="1"
                            variant="soft"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAddCrewToRole(role.id)
                            }}
                          >
                            <Plus width={14} height={14} /> Add crew
                          </Button>
                        </Box>

                        {isExpanded && (
                          <Box
                            mt="3"
                            pt="3"
                            style={{ borderTop: '1px solid var(--gray-a6)' }}
                          >
                            <Flex mb="2" justify="between" align="center">
                              <Text size="2" weight="medium">
                                Crew ({roleCrew.length})
                              </Text>
                            </Flex>
                            {roleCrew.length === 0 && (
                              <Text size="2" color="gray">
                                No crew assigned yet
                              </Text>
                            )}
                            {roleCrew.length > 0 && (
                              <Table.Root variant="surface" size="1">
                                <Table.Header>
                                  <Table.Row>
                                    <Table.ColumnHeaderCell>
                                      Name
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>
                                      Status
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {roleCrew.map((crew) => {
                                    const crewName =
                                      crew.user?.display_name ??
                                      crew.user?.email ??
                                      'Unknown'
                                    return (
                                      <Table.Row key={crew.id}>
                                        <Table.Cell>{crewName}</Table.Cell>
                                        <Table.Cell>
                                          <SegmentedControl.Root
                                            size="1"
                                            value={crew.status}
                                            onValueChange={(v) =>
                                              handleStatusChange(
                                                crew.id,
                                                crewName,
                                                crew.status,
                                                v as CrewReqStatus,
                                              )
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
                                              <SegmentedControl.Item
                                                key={s}
                                                value={s}
                                              >
                                                {s}
                                              </SegmentedControl.Item>
                                            ))}
                                          </SegmentedControl.Root>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Button
                                            size="1"
                                            variant="soft"
                                            onClick={() => {
                                              // TODO: Implement invite sending
                                              console.log(
                                                'Send invite to',
                                                crewName,
                                              )
                                            }}
                                          >
                                            <Mail width={14} height={14} /> Send
                                            invite
                                          </Button>
                                        </Table.Cell>
                                      </Table.Row>
                                    )
                                  })}
                                </Table.Body>
                              </Table.Root>
                            )}
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            ))}
          </Box>

          {addCrewToRole && (
            <AddCrewToRoleDialog
              open={!!addCrewToRole}
              onOpenChange={(v) => !v && setAddCrewToRole(null)}
              jobId={jobId}
              timePeriodId={addCrewToRole}
              companyId={companyId}
            />
          )}

          {statusChangeConfirm && (
            <ConfirmStatusChangeDialog
              open={!!statusChangeConfirm}
              onOpenChange={(v) => !v && setStatusChangeConfirm(null)}
              currentStatus={statusChangeConfirm.currentStatus}
              newStatus={statusChangeConfirm.newStatus}
              crewName={statusChangeConfirm.crewName}
              onConfirm={() => {
                confirmStatusChange()
                setStatusChangeConfirm(null)
              }}
            />
          )}
        </Tabs.Content>

        <Tabs.Content value="crew">
          <Box
            mb="2"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <Heading size="3">Crew</Heading>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="2" onClick={() => setAddCrewOpen(true)}>
                <Plus /> Add crew booking
              </Button>
              <AddCrewDialog
                open={addCrewOpen}
                onOpenChange={setAddCrewOpen}
                jobId={jobId}
              />
              <Button size="2" variant="soft">
                <Mail width={16} height={16} /> Send requests
              </Button>
            </div>
          </Box>

          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Role period</Table.ColumnHeaderCell>
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
                  <Table.Cell>
                    {(() => {
                      const tp = r.time_period_id
                        ? roleById.get(r.time_period_id)
                        : undefined
                      if (!tp) return '—'
                      const title = tp.title ?? 'Role'
                      const range = `${fmt(tp.start_at)} → ${fmt(tp.end_at)}`
                      return `${title} (${range})`
                    })()}
                  </Table.Cell>
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
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => setEditCrew(r)}
                    >
                      …Edit booking
                    </Button>
                    {editCrew && (
                      <EditCrewDialog
                        open={!!editCrew}
                        onOpenChange={(v) => !v && setEditCrew(null)}
                        row={editCrew}
                        jobId={jobId}
                      />
                    )}
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
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : '—'
}

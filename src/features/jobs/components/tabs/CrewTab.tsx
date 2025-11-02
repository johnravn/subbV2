import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  SegmentedControl,
  Table,
  Text,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Mail, NavArrowDown, NavArrowRight, Plus, Trash } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { sendCrewInvite, sendCrewInvites } from '../../../matters/api/queries'
import AddRoleDialog from '../dialogs/AddRoleDialog'
import AddCrewToRoleDialog from '../dialogs/AddCrewToRoleDialog'
import ConfirmStatusChangeDialog from '../dialogs/ConfirmStatusChangeDialog'
import SendInviteDialog from '../dialogs/SendInviteDialog'
import type { CrewReqStatus, ReservedCrewRow } from '../../types'

export default function CrewTab({
  jobId,
  companyId,
  view,
  onViewChange,
}: {
  jobId: string
  companyId: string
  view: 'roles' | 'crew'
  onViewChange?: (view: 'roles' | 'crew') => void
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [addRoleOpen, setAddRoleOpen] = React.useState(false)
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
  const [sendInviteDialog, setSendInviteDialog] = React.useState<{
    userId?: string // Optional - if not provided, it's "send to all"
    timePeriodId: string
    crewName: string
    roleTitle: string
    isSendToAll?: boolean
  } | null>(null)
  const [deleteRoleConfirm, setDeleteRoleConfirm] = React.useState<{
    roleId: string
    roleTitle: string
    crewCount: number
  } | null>(null)

  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const { data } = useQuery({
    queryKey: ['jobs.crew', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: rErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
        .eq('category', 'crew')
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
      const { data: tps, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at, needed_count, role_category')
        .eq('job_id', jobId)
        .eq('category', 'crew')
        .order('start_at', { ascending: true })

      if (error) throw error

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
          const key = r.time_period_id
          const bag = statusByTp.get(key) || {}
          bag[r.status] = (bag[r.status] || 0) + 1
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

  const removeRole = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      // Find and delete all matters (crew_invite) for this time period
      const { data: matters, error: matterError } = await supabase
        .from('matters' as any)
        .select('id')
        .eq('job_id', jobId)
        .eq('time_period_id', roleId)
        .eq('matter_type', 'crew_invite')

      if (matterError) throw matterError

      // Delete all matters for this role
      const mattersList = matters as unknown as Array<{ id: string }>
      for (const matter of mattersList) {
        const { error: deleteError } = await supabase
          .from('matters' as any)
          .delete()
          .eq('id', matter.id)

        if (deleteError) throw deleteError
      }

      // Delete all crew entries for this role
      const { error: deleteCrewError } = await supabase
        .from('reserved_crew')
        .delete()
        .eq('time_period_id', roleId)

      if (deleteCrewError) throw deleteCrewError

      // Delete the time period (role) itself
      const { error: deleteRoleError } = await supabase
        .from('time_periods')
        .delete()
        .eq('id', roleId)

      if (deleteRoleError) throw deleteRoleError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      qc.invalidateQueries({ queryKey: ['matters'] })
      success('Success', 'Role and all crew members removed')
      setDeleteRoleConfirm(null)
    },
    onError: (e: any) => {
      toastError('Failed to remove role', e?.message || 'Please try again.')
    },
  })

  const removeCrew = useMutation({
    mutationFn: async ({
      crewId,
      timePeriodId,
      userId,
    }: {
      crewId: string
      timePeriodId: string
      userId: string
    }) => {
      // Find and delete the matter (crew_invite) for this user and time period
      const { data: matters, error: matterError } = await supabase
        .from('matters' as any)
        .select('id')
        .eq('job_id', jobId)
        .eq('time_period_id', timePeriodId)
        .eq('matter_type', 'crew_invite')

      if (matterError) throw matterError

      // Check if user is a recipient of this matter
      const mattersList = matters as unknown as Array<{ id: string }>
      for (const matter of mattersList) {
        const { data: recipients } = await supabase
          .from('matter_recipients' as any)
          .select('id')
          .eq('matter_id', matter.id)
          .eq('user_id', userId)
          .maybeSingle()

        if (recipients) {
          // Delete the matter (this will cascade delete recipients and responses)
          const { error: deleteError } = await supabase
            .from('matters' as any)
            .delete()
            .eq('id', matter.id)

          if (deleteError) throw deleteError
          break // Found and deleted, no need to continue
        }
      }

      // Delete the crew entry
      const { error } = await supabase
        .from('reserved_crew')
        .delete()
        .eq('id', crewId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      qc.invalidateQueries({ queryKey: ['matters'] })
      success('Success', 'Crew member removed')
    },
    onError: (e: any) => {
      toastError(
        'Failed to remove crew member',
        e?.message || 'Please try again.',
      )
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

  const sendInvites = useMutation({
    mutationFn: async ({
      timePeriodId,
      message,
    }: {
      timePeriodId: string
      message?: string | null
    }) => {
      await sendCrewInvites(jobId, timePeriodId, companyId, message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      qc.invalidateQueries({ queryKey: ['matters'] })
      success('Success', 'Invitations sent and matter created')
      setSendInviteDialog(null)
    },
    onError: (e: any) => {
      toastError(
        'Failed to send invitations',
        e?.message || 'Please try again.',
      )
    },
  })

  // Fetch job title for dialog
  const { data: jobTitleData } = useQuery({
    queryKey: ['job-title', jobId],
    queryFn: async () => {
      const { data: jobData, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return jobData as { title: string }
    },
    enabled: !!jobId,
  })

  const sendInvite = useMutation({
    mutationFn: async ({
      timePeriodId,
      userId,
      message,
    }: {
      timePeriodId: string
      userId: string
      message?: string | null
    }) => {
      await sendCrewInvite(jobId, timePeriodId, userId, companyId, message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      qc.invalidateQueries({ queryKey: ['matters'] })
      success('Success', 'Invitation sent and matter created')
      setSendInviteDialog(null)
    },
    onError: (e: any) => {
      toastError('Failed to send invitation', e?.message || 'Please try again.')
    },
  })

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

  if (view === 'roles') {
    return (
      <div>
        <Box
          mb="2"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Heading size="3">Roles</Heading>
          {!isReadOnly && (
            <Flex align="center" gap="3">
              <Button size="2" onClick={() => setAddRoleOpen(true)}>
                <Plus /> Add role
              </Button>
              {onViewChange && (
                <SegmentedControl.Root
                  size="2"
                  value={view}
                  onValueChange={(v) => onViewChange(v as 'roles' | 'crew')}
                >
                  <SegmentedControl.Item value="roles">
                    Roles
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="crew">
                    Crew
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              )}
              <AddRoleDialog
                open={addRoleOpen}
                onOpenChange={setAddRoleOpen}
                jobId={jobId}
              />
            </Flex>
          )}
        </Box>

        <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedRoles.length === 0 && <Text color="gray">No roles yet</Text>}
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
                          <Text
                            weight="bold"
                            style={{
                              color:
                                (counts['accepted'] ?? 0) >=
                                (role.needed_count ?? 1)
                                  ? 'var(--green-9)'
                                  : undefined,
                            }}
                          >
                            {role.title ?? '—'}
                          </Text>
                        </Flex>
                        {!isReadOnly && (
                          <Flex gap="2">
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
                            <Button
                              size="1"
                              variant="soft"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteRoleConfirm({
                                  roleId: role.id,
                                  roleTitle: role.title || 'Untitled Role',
                                  crewCount: roleCrew.length,
                                })
                              }}
                              disabled={removeRole.isPending}
                            >
                              <Trash width={14} height={14} />
                            </Button>
                          </Flex>
                        )}
                      </Box>

                      {isExpanded && (
                        <Box
                          mt="3"
                          pt="3"
                          style={{ borderTop: '1px solid var(--gray-a6)' }}
                        >
                          {/* Stats section */}
                          <Flex mb="3" gap="4" wrap="wrap">
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

                          <Flex mb="2" justify="between" align="center">
                            <Text size="2" weight="medium">
                              Crew ({roleCrew.length})
                            </Text>
                            {!isReadOnly &&
                              roleCrew.filter((c) => c.status === 'planned')
                                .length > 0 && (
                                <Button
                                  size="1"
                                  variant="soft"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSendInviteDialog({
                                      timePeriodId: role.id,
                                      crewName: `${roleCrew.filter((c) => c.status === 'planned').length} crew members`,
                                      roleTitle: role.title || 'Role',
                                      isSendToAll: true,
                                    })
                                  }}
                                  disabled={sendInvites.isPending}
                                >
                                  <Mail width={14} height={14} /> Send to all (
                                  {
                                    roleCrew.filter(
                                      (c) => c.status === 'planned',
                                    ).length
                                  }
                                  )
                                </Button>
                              )}
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
                                  <Table.ColumnHeaderCell>
                                    Actions
                                  </Table.ColumnHeaderCell>
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
                                        {isReadOnly ? (
                                          <Badge
                                            radius="full"
                                            highContrast
                                            color={
                                              crew.status === 'accepted'
                                                ? 'green'
                                                : crew.status === 'declined'
                                                  ? 'red'
                                                  : crew.status === 'requested'
                                                    ? 'blue'
                                                    : 'gray'
                                            }
                                          >
                                            {crew.status}
                                          </Badge>
                                        ) : (
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
                                                style={{
                                                  color:
                                                    s === 'accepted'
                                                      ? 'var(--green-9)'
                                                      : s === 'declined'
                                                        ? 'var(--red-9)'
                                                        : s === 'requested'
                                                          ? 'var(--blue-9)'
                                                          : undefined,
                                                }}
                                              >
                                                {s}
                                              </SegmentedControl.Item>
                                            ))}
                                          </SegmentedControl.Root>
                                        )}
                                      </Table.Cell>
                                      <Table.Cell>
                                        <Flex gap="2">
                                          {!isReadOnly &&
                                            crew.status === 'planned' && (
                                              <Button
                                                size="1"
                                                variant="soft"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setSendInviteDialog({
                                                    userId: crew.user_id,
                                                    timePeriodId: role.id,
                                                    crewName: crewName,
                                                    roleTitle:
                                                      role.title || 'Role',
                                                  })
                                                }}
                                                disabled={sendInvite.isPending}
                                              >
                                                <Mail width={14} height={14} />{' '}
                                                Send invite
                                              </Button>
                                            )}
                                          {!isReadOnly && (
                                            <Button
                                              size="1"
                                              variant="soft"
                                              color="red"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                removeCrew.mutate({
                                                  crewId: crew.id,
                                                  timePeriodId: role.id,
                                                  userId: crew.user_id,
                                                })
                                              }}
                                              disabled={removeCrew.isPending}
                                            >
                                              <Trash width={14} height={14} />
                                            </Button>
                                          )}
                                        </Flex>
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

        {sendInviteDialog && jobTitleData && (
          <SendInviteDialog
            open={!!sendInviteDialog}
            onOpenChange={(v) => !v && setSendInviteDialog(null)}
            crewName={sendInviteDialog.crewName}
            jobTitle={jobTitleData.title}
            roleTitle={sendInviteDialog.roleTitle}
            onSend={(message) => {
              if (sendInviteDialog.isSendToAll) {
                sendInvites.mutate({
                  timePeriodId: sendInviteDialog.timePeriodId,
                  message,
                })
              } else if (sendInviteDialog.userId) {
                sendInvite.mutate({
                  timePeriodId: sendInviteDialog.timePeriodId,
                  userId: sendInviteDialog.userId,
                  message,
                })
              }
            }}
            isPending={sendInvite.isPending || sendInvites.isPending}
          />
        )}

        {deleteRoleConfirm && (
          <Dialog.Root
            open={!!deleteRoleConfirm}
            onOpenChange={(v) => !v && setDeleteRoleConfirm(null)}
          >
            <Dialog.Content style={{ maxWidth: 450 }}>
              <Dialog.Title>Delete Role</Dialog.Title>
              <Dialog.Description>
                Are you sure you want to delete the role "
                {deleteRoleConfirm.roleTitle}"? This will permanently remove:
              </Dialog.Description>
              <Box
                mt="3"
                p="3"
                style={{ background: 'var(--red-a2)', borderRadius: 8 }}
              >
                <Flex direction="column" gap="1">
                  <Text size="2">• The role itself</Text>
                  <Text size="2">
                    • All {deleteRoleConfirm.crewCount} crew member
                    {deleteRoleConfirm.crewCount !== 1 ? 's' : ''} assigned to
                    it
                  </Text>
                  <Text size="2">• All invitation matters for this role</Text>
                </Flex>
              </Box>
              <Text size="2" color="red" weight="bold" mt="3">
                ⚠️ This action cannot be undone!
              </Text>
              <Flex mt="4" gap="2" justify="end">
                <Dialog.Close>
                  <Button variant="soft" disabled={removeRole.isPending}>
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  color="red"
                  onClick={() => {
                    removeRole.mutate({ roleId: deleteRoleConfirm.roleId })
                  }}
                  disabled={removeRole.isPending}
                >
                  {removeRole.isPending ? 'Deleting...' : 'Yes, delete'}
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        )}
      </div>
    )
  }

  // Crew view - read-only
  return (
    <div>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">Crew</Heading>
        {onViewChange && (
          <SegmentedControl.Root
            size="2"
            value={view}
            onValueChange={(v) => onViewChange(v as 'roles' | 'crew')}
          >
            <SegmentedControl.Item value="roles">Roles</SegmentedControl.Item>
            <SegmentedControl.Item value="crew">Crew</SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
      </Box>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
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
                  return tp.title ?? 'Role'
                })()}
              </Table.Cell>
              <Table.Cell>
                <Badge radius="full" highContrast>
                  {r.status}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
          {(data ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">No crew</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

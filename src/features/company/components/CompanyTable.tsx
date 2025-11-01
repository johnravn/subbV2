// src/features/company/components/CompanyTable.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  DropdownMenu,
  Flex,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { EditPencil, Search, Trash } from 'iconoir-react'
import {
  crewIndexQuery,
  deleteInvite,
  myPendingInvitesQuery,
} from '../../crew/api/queries'
import AddFreelancerDialog from '../../crew/components/dialogs/AddFreelancerDialog'
import { removeCompanyUser, setCompanyUserRole, type CompanyRole } from '../api/queries'
import AddEmployeeDialog from './dialogs/AddEmployeeDialog'
import ChangeRoleConfirmDialog from './dialogs/ChangeRoleConfirmDialog'
import RemoveUserConfirmDialog from './dialogs/RemoveUserConfirmDialog'
import type { PendingInvite } from '../../crew/api/queries'

type Row = {
  kind: 'employee' | 'freelancer' | 'invite' | 'owner'
  id: string
  title: string
  subtitle?: string
  role?: 'owner' | 'employee' | 'freelancer' | 'super_user'
  email?: string
}

export default function CompanyTable({
  selectedUserId,
  onSelectUser,
  showEmployees,
  showFreelancers,
  showMyPending,
}: {
  selectedUserId: string | null
  onSelectUser: (id: string) => void
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const { success, error } = useToast()

  // Queries
  const { data: owners = [], isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'owner' }),
    enabled: !!companyId, // owners always shown (like Crew page)
  })

  const { data: employees = [], isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'employee' }),
    enabled: !!companyId && showEmployees,
  })

  const { data: freelancers = [], isLoading: frLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'freelancer' }),
    enabled: !!companyId && showFreelancers,
  })

  const [inviterId, setInviterId] = React.useState<string | null>(null)
  React.useEffect(() => {
    ;(async () => {
      const { supabase } = await import('@shared/api/supabase')
      const { data } = await supabase.auth.getUser()
      setInviterId(data.user?.id ?? null)
    })()
  }, [])

  const { data: myInvites = [], isLoading: invLoading } = useQuery({
    ...myPendingInvitesQuery({ companyId: companyId!, inviterId }),
    enabled: !!companyId && showMyPending,
  })

  const rows = React.useMemo(() => {
    const L: Array<Row> = []

    owners.forEach((u) =>
      L.push({
        kind: 'owner',
        id: u.user_id,
        title: u.display_name ?? u.email,
        subtitle: `${u.email} · owner`,
        email: u.email,
      }),
    )

    if (showEmployees) {
      employees.forEach((u) =>
        L.push({
          kind: 'employee',
          id: u.user_id,
          title: u.display_name ?? u.email,
          subtitle: `${u.email} · employee`,
          email: u.email,
        }),
      )
    }

    if (showFreelancers) {
      freelancers.forEach((u) =>
        L.push({
          kind: 'freelancer',
          id: u.user_id,
          title: u.display_name ?? u.email,
          subtitle: `${u.email} · freelancer`,
          email: u.email,
        }),
      )
    }

    if (showMyPending) {
      myInvites.forEach((i) =>
        L.push({
          kind: 'invite',
          id: `invite:${i.id}`,
          title: i.email,
          subtitle: `${i.role} · expires ${new Date(i.expires_at).toLocaleDateString()}`,
          role: i.role as Row['role'],
          email: i.email,
        }),
      )
    }

    const term = search.trim().toLowerCase()
    const filtered = term
      ? L.filter(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            (r.subtitle ?? '').toLowerCase().includes(term),
        )
      : L

    const priority: Record<(typeof filtered)[number]['kind'], number> = {
      invite: 0,
      owner: 1,
      employee: 2,
      freelancer: 3,
    }
    return filtered.slice().sort((a, b) => priority[a.kind] - priority[b.kind])
  }, [
    owners,
    employees,
    freelancers,
    myInvites,
    showEmployees,
    showFreelancers,
    showMyPending,
    search,
  ])

  const [addEmployeeOpen, setAddEmployeeOpen] = React.useState(false)
  const [addFreelancerOpen, setAddFreelancerOpen] = React.useState(false)
  const [removeUserOpen, setRemoveUserOpen] = React.useState(false)
  const [userToRemove, setUserToRemove] = React.useState<{
    id: string
    name: string
    email: string
    kind: 'employee' | 'freelancer'
  } | null>(null)
  const [changeRoleOpen, setChangeRoleOpen] = React.useState(false)
  const [roleChangeInfo, setRoleChangeInfo] = React.useState<{
    userId: string
    userName: string
    userEmail: string
    currentRole: CompanyRole
    newRole: CompanyRole
  } | null>(null)

  const delInvite = useMutation({
    mutationFn: (inviteId: string) => deleteInvite({ inviteId }),
    onSuccess: () => {
      // Invalidate any pending-invites queries for this company regardless of inviterId readiness
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === companyId &&
          q.queryKey[2] === 'pending-invites',
      })
      success('Success', 'Invite successfully deleted')
    },
  })

  const roleColor = (role: Row['role'] | Row['kind']) =>
    role === 'owner'
      ? 'purple'
      : role === 'employee'
        ? 'blue'
        : role === 'freelancer'
          ? 'green'
          : 'amber' // super_user

  // We can guard last owner in UI using owners.length, server will enforce too
  const isLastOwner = (r: Row) => r.kind === 'owner' && owners.length <= 1

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <Flex gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {(empLoading || invLoading || owLoading) && (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            )}
          </TextField.Slot>
        </TextField.Root>

        {/* Add employee */}
        <Button variant="classic" onClick={() => setAddEmployeeOpen(true)}>
          Add employee
        </Button>

        {/* Optional: keep inviting freelancers from here too */}
        <Button variant="soft" onClick={() => setAddFreelancerOpen(true)}>
          Add freelancer
        </Button>

        <AddEmployeeDialog
          open={addEmployeeOpen}
          onOpenChange={setAddEmployeeOpen}
          onAdded={() => {
            qc.invalidateQueries({
              queryKey: ['company', companyId, 'crew-index', 'employee'],
            })
            // also refresh invites in case it was an invite outcome
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) &&
                q.queryKey[0] === 'company' &&
                q.queryKey[1] === companyId &&
                q.queryKey[2] === 'pending-invites',
            })
          }}
        />
        <AddFreelancerDialog
          open={addFreelancerOpen}
          onOpenChange={setAddFreelancerOpen}
          onAdded={() => {
            qc.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) &&
                q.queryKey[0] === 'company' &&
                q.queryKey[1] === companyId &&
                q.queryKey[2] === 'pending-invites',
            })
          }}
        />
      </Flex>

      <ChangeRoleConfirmDialog
        open={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        onChanged={() => {}}
        userName={roleChangeInfo?.userName ?? ''}
        userEmail={roleChangeInfo?.userEmail ?? ''}
        currentRole={roleChangeInfo?.currentRole ?? 'employee'}
        newRole={roleChangeInfo?.newRole ?? 'employee'}
        userId={roleChangeInfo?.userId ?? ''}
      />
      <RemoveUserConfirmDialog
        open={removeUserOpen}
        onOpenChange={setRemoveUserOpen}
        onRemoved={() => {}}
        userName={userToRemove?.name ?? ''}
        userEmail={userToRemove?.email ?? ''}
        userKind={userToRemove?.kind ?? 'employee'}
        userId={userToRemove?.id ?? ''}
      />
      <Table.Root variant="surface" style={{ marginTop: 16 }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name / Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ width: 120, textAlign: 'right' }} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={3}>No results</Table.Cell>
            </Table.Row>
          ) : (
            rows.map((r) => {
              const active = r.kind !== 'invite' && r.id === selectedUserId
              return (
                <Table.Row
                  key={r.id}
                  onClick={() => r.kind !== 'invite' && onSelectUser(r.id)}
                  style={{
                    cursor: r.kind !== 'invite' ? 'pointer' : 'default',
                    background: active ? 'var(--accent-a3)' : undefined,
                  }}
                  data-state={active ? 'active' : undefined}
                >
                  <Table.Cell>
                    <Text size="2" weight="medium">
                      {r.title}
                    </Text>
                    {r.subtitle && (
                      <Text as="div" size="1" color="gray">
                        {r.subtitle}
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ verticalAlign: 'middle' }}>
                    {r.kind === 'invite' ? (
                      <Flex gap="2" align="center">
                        <Badge variant="soft" color="amber">
                          Pending invite
                        </Badge>
                        {r.role && (
                          <Badge
                            variant="soft"
                            color={
                              r.role === 'owner'
                                ? 'purple'
                                : r.role === 'employee'
                                  ? 'blue'
                                  : r.role === 'freelancer'
                                    ? 'green'
                                    : 'amber'
                            }
                          >
                            {r.role === 'super_user' ? 'super user' : r.role}
                          </Badge>
                        )}
                      </Flex>
                    ) : (
                      <Flex gap={'1'}>
                        <Badge
                          asChild={false}
                          variant="soft"
                          color={roleColor(r.kind)}
                          style={{ cursor: 'pointer' }}
                        >
                          {r.kind}
                        </Badge>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <EditPencil style={{ color: 'var(--gray-9)' }} />
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="start" side="bottom">
                            <DropdownMenu.Label>Set role</DropdownMenu.Label>
                            <DropdownMenu.Item
                              disabled={r.kind === 'owner' || isLastOwner(r)}
                              onSelect={(e) => {
                                e.preventDefault()
                                setRoleChangeInfo({
                                  userId: r.id,
                                  userName: r.title,
                                  userEmail: r.email ?? '',
                                  currentRole: r.kind as CompanyRole,
                                  newRole: 'freelancer',
                                })
                                setChangeRoleOpen(true)
                              }}
                            >
                              Freelancer
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              disabled={r.kind === 'employee'}
                              onSelect={(e) => {
                                e.preventDefault()
                                setRoleChangeInfo({
                                  userId: r.id,
                                  userName: r.title,
                                  userEmail: r.email ?? '',
                                  currentRole: r.kind as CompanyRole,
                                  newRole: 'employee',
                                })
                                setChangeRoleOpen(true)
                              }}
                            >
                              Employee
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              disabled={r.kind === 'owner'}
                              onSelect={(e) => {
                                e.preventDefault()
                                setRoleChangeInfo({
                                  userId: r.id,
                                  userName: r.title,
                                  userEmail: r.email ?? '',
                                  currentRole: r.kind as CompanyRole,
                                  newRole: 'owner',
                                })
                                setChangeRoleOpen(true)
                              }}
                            >
                              Owner
                            </DropdownMenu.Item>
                            {isLastOwner(r) && (
                              <>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item disabled>
                                  Can't demote last owner
                                </DropdownMenu.Item>
                              </>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      </Flex>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    {r.kind === 'invite' && (
                      <Button
                        variant="soft"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          const id = r.id.replace('invite:', '')
                          delInvite.mutate(id)
                        }}
                        disabled={delInvite.isPending}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    )}
                    {(r.kind === 'employee' || r.kind === 'freelancer') && (
                      <Button
                        variant="soft"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUserToRemove({
                            id: r.id,
                            name: r.title,
                            email: r.email ?? '',
                            kind: r.kind,
                          })
                          setRemoveUserOpen(true)
                        }}
                      >
                        <Trash width={14} height={14} />
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

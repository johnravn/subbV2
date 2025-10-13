import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  crewIndexQuery,
  deleteInvite,
  myPendingInvitesQuery,
} from '../api/queries'
import AddFreelancerDialog from './dialogs/AddFreelancerDialog'

type Props = {
  selectedUserId: string | null
  onSelect: (id: string) => void
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
}

type Row = {
  kind: 'employee' | 'freelancer' | 'invite' | 'owner'
  id: string
  title: string
  subtitle?: string
  role?: 'owner' | 'employee' | 'freelancer' | 'super_user'
}

export default function CrewTable({
  selectedUserId,
  onSelect,
  showEmployees,
  showFreelancers,
  showMyPending,
}: Props) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const { success, error } = useToast()

  const { data: userRes } = (window as any).supabase
    ? { data: null }
    : { data: null } // not used here; we will call supabase inside dialog for auth user

  const { data: employees = [], isLoading: empLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'employee' }),
    enabled: !!companyId && showEmployees,
  })

  const { data: freelancers = [], isLoading: frLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'freelancer' }),
    enabled: !!companyId && showFreelancers,
  })

  const { data: owners = [], isLoading: owLoading } = useQuery({
    ...crewIndexQuery({ companyId: companyId!, kind: 'owner' }),
    enabled: !!companyId && true,
  })

  const [inviterId, setInviterId] = React.useState<string | null>(null)
  React.useEffect(() => {
    ;(async () => {
      const { data } = await (
        await import('@shared/api/supabase')
      ).supabase.auth.getUser()
      setInviterId(data.user?.id ?? null)
    })()
  }, [])

  const { data: myInvites = [], isLoading: invLoading } = useQuery({
    ...myPendingInvitesQuery({ companyId: companyId!, inviterId }),
    enabled: !!companyId && showMyPending,
  })

  const rows = React.useMemo(() => {
    const L: Array<Row> = []

    if (showEmployees) {
      employees.forEach((u) =>
        L.push({
          kind: 'employee',
          id: u.user_id,
          title: u.display_name ?? u.email,
          subtitle: `${u.email} · employee`,
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
        }),
      )
    }

    owners.forEach((u) =>
      L.push({
        kind: 'owner',
        id: u.user_id,
        title: u.display_name ?? u.email,
        subtitle: `${u.email} · owner`,
      }),
    )

    if (showMyPending) {
      myInvites.forEach((i) =>
        L.push({
          kind: 'invite',
          id: `invite:${i.id}`,
          title: i.email,
          subtitle: `${i.role} · expires ${new Date(i.expires_at).toLocaleDateString()}`,
          role: i.role as Row['role'],
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

    // ⬇️ Put invites first; then owner, employee, freelancer. Tie-break by title.
    const priority: Record<(typeof filtered)[number]['kind'], number> = {
      invite: 0,
      owner: 1,
      employee: 2,
      freelancer: 3,
    }

    return filtered.slice().sort((a, b) => priority[a.kind] - priority[b.kind])
  }, [
    employees,
    freelancers,
    owners,
    myInvites,
    showEmployees,
    showFreelancers,
    showMyPending,
    search,
  ])

  const [addOpen, setAddOpen] = React.useState(false)

  const delInvite = useMutation({
    mutationFn: (inviteId: string) => deleteInvite({ inviteId }),
    onSuccess: () => {
      if (inviterId) {
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'pending-invites', inviterId],
        })
        success('Success', 'Invite successfully deleted')
      }
    },
  })

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <Flex gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crew…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="right">
            {(empLoading || frLoading || invLoading || owLoading) && (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            )}
          </TextField.Slot>
        </TextField.Root>

        <Button variant="classic" onClick={() => setAddOpen(true)}>
          Add freelancer
        </Button>

        <AddFreelancerDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={() => {
            // refresh lists
            qc.invalidateQueries({
              queryKey: ['company', companyId, 'crew-index', 'freelancer'],
            })
            if (inviterId)
              qc.invalidateQueries({
                queryKey: ['company', companyId, 'pending-invites', inviterId],
              })
          }}
        />
      </Flex>

      <Table.Root variant="surface" style={{ marginTop: 16 }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name / Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ width: 120 }} />
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
                  onClick={() => r.kind !== 'invite' && onSelect(r.id)}
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
                      <Badge variant="soft" color="amber">
                        Pending invite
                      </Badge>
                    ) : (
                      <Badge
                        variant="soft"
                        color={
                          r.kind === 'owner'
                            ? 'purple'
                            : r.kind === 'employee'
                              ? 'blue'
                              : 'green'
                        }
                      >
                        {r.kind}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
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
                        {delInvite.isPending ? 'Deleting…' : 'Delete'}
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

import * as React from 'react'
import {
  Badge,
  Box,
  Code,
  DropdownMenu,
  Flex,
  Avatar as RadixAvatar,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { prettyPhone } from '@shared/phone/phone'
import { EditPencil } from 'iconoir-react'
import { toEventInputs } from '@features/calendar/components/domain'
import InspectorCalendar from '@features/calendar/components/InspectorCalendar'
import { crewCalendarQuery } from '@features/calendar/api/queries'
import { crewDetailQuery, crewIndexQuery } from '../api/queries'
import type { CrewDetail } from '../api/queries'
import ChangeRoleConfirmDialog from '@features/company/components/dialogs/ChangeRoleConfirmDialog'
import type { CompanyRole } from '@features/company/api/queries'

export default function CrewInspector({ userId }: { userId: string | null }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [changeRoleOpen, setChangeRoleOpen] = React.useState(false)
  const [roleChangeInfo, setRoleChangeInfo] = React.useState<{
    userId: string
    userName: string
    userEmail: string
    currentRole: CompanyRole
    newRole: CompanyRole
  } | null>(null)

  const { data, isLoading, isError, error } = useQuery<CrewDetail | null>({
    ...(companyId && userId
      ? crewDetailQuery({ companyId, userId })
      : {
          queryKey: ['company', 'none', 'crew-detail', 'none'] as const,
          queryFn: async () => null,
        }),
    enabled: !!companyId && !!userId,
  })

  // Get owners count to check if this is the last owner
  const { data: owners = [] } = useQuery({
    ...(companyId && data?.role === 'owner'
      ? crewIndexQuery({ companyId, kind: 'owner' })
      : { queryKey: ['crew-index', 'none'], queryFn: async () => [] }),
    enabled: !!companyId && !!data && data.role === 'owner',
  })

  const isLastOwner = data?.role === 'owner' && owners.length <= 1

  // Fetch calendar events for this crew member
  const { data: calendarRecords = [] } = useQuery({
    ...crewCalendarQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })

  const events = React.useMemo(
    () => toEventInputs(calendarRecords),
    [calendarRecords],
  )

  const avatarUrl = React.useMemo(() => {
    if (!data?.avatar_url) return null
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.avatar_url)
    return urlData.publicUrl
  }, [data?.avatar_url])

  if (!userId)
    return <Text color="gray">Select a crew member to view details.</Text>
  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  const fullName =
    data.display_name ||
    [data.first_name, data.last_name].filter(Boolean).join(' ') ||
    null

  const roleColor: React.ComponentProps<typeof Badge>['color'] =
    data.role === 'owner'
      ? 'purple'
      : data.role === 'employee'
        ? 'blue'
        : data.role === 'super_user'
          ? 'amber'
          : 'green'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
        <Flex align="center" gap="3">
          <RadixAvatar
            size="5"
            radius="full"
            src={avatarUrl ?? undefined}
            fallback={initials(fullName ?? data.email)}
            style={{ border: '1px solid var(--gray-5)' }}
          />
          <div>
            <Text as="div" size="4" weight="bold">
              {fullName ?? data.email}
            </Text>
            <Text as="div" color="gray" size="2">
              <a href={`mailto:${data.email}`} style={{ color: 'inherit' }}>
                {data.email}
              </a>
            </Text>
          </div>
        </Flex>

        <Flex align="center" gap="2">
          <Badge variant="soft" color={roleColor}>
            {data.role}
          </Badge>
          {/* Only show role change for employees, freelancers, and owners (not super_user) */}
          {data.role !== 'super_user' && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <EditPencil
                  style={{ color: 'var(--gray-9)', cursor: 'pointer' }}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                <DropdownMenu.Label>Set role</DropdownMenu.Label>
                <DropdownMenu.Item
                  disabled={data.role === 'owner' || isLastOwner}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'freelancer',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Freelancer
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={data.role === 'employee'}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'employee',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Employee
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  disabled={data.role === 'owner'}
                  onSelect={(e) => {
                    e.preventDefault()
                    setRoleChangeInfo({
                      userId: data.user_id,
                      userName: fullName || data.email,
                      userEmail: data.email,
                      currentRole: data.role as CompanyRole,
                      newRole: 'owner',
                    })
                    setChangeRoleOpen(true)
                  }}
                >
                  Owner
                </DropdownMenu.Item>
                {isLastOwner && (
                  <>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item disabled>
                      Can't demote last owner
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>
      </Flex>

      <ChangeRoleConfirmDialog
        open={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        onChanged={() => {
          // Refresh crew detail to get updated role
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'crew-detail', userId],
          })
          // Also refresh crew index to update lists
          qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'company' &&
              q.queryKey[1] === companyId &&
              q.queryKey[2] === 'crew-index',
          })
        }}
        userName={roleChangeInfo?.userName ?? ''}
        userEmail={roleChangeInfo?.userEmail ?? ''}
        currentRole={roleChangeInfo?.currentRole ?? 'employee'}
        newRole={roleChangeInfo?.newRole ?? 'employee'}
        userId={roleChangeInfo?.userId ?? ''}
      />

      <Separator my="2" />

      {/* Primary info */}
      <DefinitionList>
        <DT>Joined</DT>
        <DD>{formatMonthYear(data.created_at)}</DD>

        <DT>Phone</DT>
        <DD>
          {data.phone ? (
            <a href={`tel:${data.phone}`} style={{ color: 'inherit' }}>
              {prettyPhone(data.phone)}
            </a>
          ) : (
            '—'
          )}
        </DD>

        <DT>First name</DT>
        <DD>{data.first_name || '—'}</DD>

        <DT>Last name</DT>
        <DD>{data.last_name || '—'}</DD>

        <DT>Display name</DT>
        <DD>{data.display_name || '—'}</DD>
      </DefinitionList>

      {/* Bio */}
      <SectionTitle>Bio</SectionTitle>
      <Box mb="3">
        <Text size="2" color={data.bio ? undefined : 'gray'}>
          {data.bio || '—'}
        </Text>
      </Box>

      <Separator my="2" />

      {/* Address */}
      <SectionTitle>Address</SectionTitle>
      <DefinitionList>
        <DT>Label</DT>
        <DD>{data.primary_address?.name || '—'}</DD>

        <DT>Street</DT>
        <DD>{data.primary_address?.address_line || '—'}</DD>

        <DT>City</DT>
        <DD>
          {data.primary_address
            ? `${data.primary_address.zip_code} ${data.primary_address.city}`
            : '—'}
        </DD>

        <DT>Country</DT>
        <DD>{data.primary_address?.country || '—'}</DD>
      </DefinitionList>

      {!data.primary_address && (
        <Text size="2" color="gray" mb="3">
          No address on file
        </Text>
      )}

      <Separator my="2" />

      {/* Optional details (preferences) */}
      <SectionTitle>Optional details</SectionTitle>
      <DefinitionList>
        <DT>Date of birth</DT>
        <DD>{formatMonthYear(data.preferences?.date_of_birth)}</DD>

        <DT>Driver's license</DT>
        <DD>{data.preferences?.drivers_license || '—'}</DD>

        <DT>Other licenses</DT>
        <DD>{listOrDash(data.preferences?.licenses)}</DD>

        <DT>Certificates</DT>
        <DD>{listOrDash(data.preferences?.certificates)}</DD>

        <DT>Notes</DT>
        <DD>
          <Text size="2" color={data.preferences?.notes ? undefined : 'gray'}>
            {data.preferences?.notes || '—'}
          </Text>
        </DD>
      </DefinitionList>

      <Separator my="2" />

      {/* Calendar */}
      <InspectorCalendar
        events={events}
        calendarHref={`/calendar?userId=${userId}`}
        onCreate={(e) => console.log('create in inspector', e)}
        onUpdate={(id, patch) => console.log('update', id, patch)}
        onDelete={(id) => console.log('delete', id)}
      />
    </Box>
  )
}

/* ---------- tiny UI helpers ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text as="div" size="2" weight="bold" mb="2">
      {children}
    </Text>
  )
}

function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        rowGap: 8,
        columnGap: 12,
        marginBottom: 12,
      }}
    >
      {children}
    </dl>
  )
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt>
      <Text size="1" color="gray">
        {children}
      </Text>
    </dt>
  )
}

function DD({ children }: { children: React.ReactNode }) {
  return (
    <dd>
      <Text size="2">{children}</Text>
    </dd>
  )
}

function initials(displayOrEmail: string) {
  const base = displayOrEmail.trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (base.includes('@')) return base[0].toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  // "5. sep 2024" vibe without spelling the day
  const day = d.getDate()
  const rest = d
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    .toLowerCase()
  return `${day}. ${rest}`
}

function listOrDash(arr?: Array<string> | null) {
  if (!arr || arr.length === 0) return '—'
  return arr.join(', ')
}

import * as React from 'react'
import {
  Badge,
  Box,
  Code,
  Flex,
  Avatar as RadixAvatar,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  formatPhoneNumberIntl,
  isValidPhoneNumber,
} from 'react-phone-number-input'
import { formatInternational, isPhoneValid } from '@shared/phone/phone'
import { crewDetailQuery } from '../api/queries'
import type { CrewDetail } from '../api/queries'

export default function CrewInspector({ userId }: { userId: string | null }) {
  const { companyId } = useCompany()

  const { data, isLoading, isError, error } = useQuery<CrewDetail | null>({
    ...(companyId && userId
      ? crewDetailQuery({ companyId, userId })
      : {
          queryKey: ['company', 'none', 'crew-detail', 'none'] as const,
          queryFn: async () => null,
        }),
    enabled: !!companyId && !!userId,
  })

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
      <Flex align={'center'} gap={'1'}>
        <Text>Loading</Text>
        <Spinner size={'2'} />
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

        <Badge variant="soft" color={roleColor}>
          {data.role}
        </Badge>
      </Flex>

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
      </DefinitionList>

      {/* Bio */}
      <SectionTitle>Bio</SectionTitle>
      <Box mb="3">
        <Text size="2" color={data.bio ? undefined : 'gray'}>
          {data.bio || '—'}
        </Text>
      </Box>

      <Separator my="2" />

      {/* Optional details (preferences) */}
      <SectionTitle>Optional details</SectionTitle>
      <DefinitionList>
        <DT>Address</DT>
        <DD>{data.preferences?.address || '—'}</DD>

        <DT>Date of birth</DT>
        <DD>{formatMonthYear(data.preferences?.date_of_birth)}</DD>

        <DT>Driver’s license</DT>
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
function prettyPhone(e164?: string | null) {
  if (!e164) return '—'
  try {
    return isPhoneValid(e164) ? formatInternational(e164) : e164
  } catch {
    return e164
  }
}

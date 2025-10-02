import * as React from 'react'
import { Badge, Box, Code, Flex, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useQuery } from '@tanstack/react-query'
import { crewDetailQuery } from '../api/queries'
import type { CrewDetail } from '../api/queries'

export default function CrewInspector({ userId }: { userId: string | null }) {
  const { companyId } = useCompany()

  if (!userId)
    return <Text color="gray">Select a crew member to view details.</Text>

  const { data, isLoading, isError, error } = useQuery<CrewDetail | null>({
    ...crewDetailQuery({ companyId: companyId!, userId }),
    enabled: !!companyId && !!userId,
  })

  if (isLoading) return <Text>Loading…</Text>
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

  return (
    <Box>
      <Flex align="center" justify="between" gap="2" mb="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {fullName ?? data.email}
          </Text>
          <Text as="div" color="gray" size="2">
            {data.email} · {data.role}
          </Text>
        </div>
        <Badge
          variant="soft"
          color={
            data.role === 'owner'
              ? 'purple'
              : data.role === 'employee'
                ? 'blue'
                : 'green'
          }
        >
          {data.role}
        </Badge>
      </Flex>

      <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
        <dt>
          <Text size="1" color="gray">
            Joined
          </Text>
        </dt>
        <dd>
          <Text size="2">
            {data.created_at ? new Date(data.created_at).toLocaleString() : '—'}
          </Text>
        </dd>

        <dt>
          <Text size="1" color="gray">
            Phone
          </Text>
        </dt>
        <dd>
          <Text size="2">{data.phone ?? '—'}</Text>
        </dd>
      </dl>
    </Box>
  )
}

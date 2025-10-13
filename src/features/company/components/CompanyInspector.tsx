// src/features/company/components/CompanyInspector.tsx
import * as React from 'react'
import { Box, Code, Flex, Separator, Spinner, Text } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { companyDetailQuery } from '../api/queries'

export default function CompanyInspector() {
  const { companyId } = useCompany()
  const { data, isLoading, isError, error } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: async () => null,
        }),
    enabled: !!companyId,
  })

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

  return (
    <Box>
      <SectionTitle>Company</SectionTitle>
      <DefinitionList>
        <DT>Name</DT>
        <DD>{data.name}</DD>

        <DT>Created</DT>
        <DD>{formatDate(data.created_at)}</DD>

        <DT>Address</DT>
        <DD>{data.address || '—'}</DD>

        <DT>VAT number</DT>
        <DD>{data.vat_number || '—'}</DD>

        <DT>General email</DT>
        <DD>
          {data.general_email ? (
            <a
              href={`mailto:${data.general_email}`}
              style={{ color: 'inherit' }}
            >
              {data.general_email}
            </a>
          ) : (
            '—'
          )}
        </DD>

        <DT>Contact person</DT>
        <DD>
          {data.contact_person?.display_name ||
            data.contact_person?.email ||
            '—'}
        </DD>
      </DefinitionList>

      <Separator my="2" />
    </Box>
  )
}

/* ----- mini UI helpers (same vibe as CrewInspector) ----- */
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
function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

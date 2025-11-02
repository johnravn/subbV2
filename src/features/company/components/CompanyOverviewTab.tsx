// src/features/company/components/CompanyOverviewTab.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import MapEmbed from '@shared/maps/MapEmbed'
import { Edit } from 'iconoir-react'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import { companyDetailQuery } from '../api/queries'
import EditCompanyDialog from './dialogs/EditCompanyDialog'

const FIELD_MAX = 420

export default function CompanyOverviewTab() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)

  const { data, isLoading, isError, error } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  if (isLoading) {
    return (
      <Box p="4">
        <Text>Loading…</Text>
      </Box>
    )
  }
  if (isError || !data) {
    return (
      <Box p="4">
        <Text color="red">
          Failed to load company details.{' '}
          {error ? String((error as any).message) : ''}
        </Text>
      </Box>
    )
  }

  // Parse address string into components
  const parseAddress = (addr: string | null) => {
    if (!addr) {
      return {
        address_line: '',
        zip_code: '',
        city: '',
        country: 'Norway',
      }
    }
    const parts = addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 4) {
      return {
        address_line: parts[0] || '',
        zip_code: parts[1] || '',
        city: parts[2] || '',
        country: parts[3] || 'Norway',
      }
    }
    return {
      address_line: addr,
      zip_code: '',
      city: '',
      country: 'Norway',
    }
  }

  const parsedAddress = parseAddress(data.address)

  // Build a single-line address for the map preview
  const mapQuery = [
    parsedAddress.address_line,
    parsedAddress.zip_code,
    parsedAddress.city,
    parsedAddress.country,
  ]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ')

  return (
    <Card size="4" style={{ minHeight: 0, overflow: 'auto' }}>
      {/* Header */}
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Heading size="4">{data.name}</Heading>
        <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
          <Edit />
          Edit
        </Button>
      </Flex>

      <EditCompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={data}
        onSaved={() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'company-detail'],
          })
        }}
      />

      {/* Main content in columns */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Flex direction="column" gap="4" p="4">
          <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
            {/* LEFT: Company information */}
            <Column title="Company information">
              <Field label="Company name" maxWidth={FIELD_MAX}>
                <Text size="3" weight="medium">
                  {data.name}
                </Text>
              </Field>
              <Field label="VAT number" maxWidth={FIELD_MAX}>
                <Text size="3">{fmtVAT(data.vat_number)}</Text>
              </Field>
              <Field label="General email" maxWidth={FIELD_MAX}>
                {data.general_email ? (
                  <a
                    href={`mailto:${data.general_email}`}
                    style={{ color: 'inherit' }}
                  >
                    <Text size="3">{data.general_email}</Text>
                  </a>
                ) : (
                  <Text size="3" color="gray">
                    —
                  </Text>
                )}
              </Field>
              <Field label="Created" maxWidth={FIELD_MAX}>
                <Text size="3">{formatDate(data.created_at)}</Text>
              </Field>
            </Column>

            {/* MIDDLE: Address */}
            <Column title="Address">
              <Field label="Address line" maxWidth={520}>
                <Text size="3">{parsedAddress.address_line || '—'}</Text>
              </Field>
              <FieldRow>
                <Flex gap={'2'} width={'100%'}>
                  <Field label="ZIP" maxWidth={100}>
                    <Text size="3">{parsedAddress.zip_code || '—'}</Text>
                  </Field>
                  <Field label="City" maxWidth={FIELD_MAX}>
                    <Text size="3">{parsedAddress.city || '—'}</Text>
                  </Field>
                </Flex>
              </FieldRow>
              <Field label="Country" maxWidth={FIELD_MAX}>
                <Text size="3">{parsedAddress.country || '—'}</Text>
              </Field>

              {/* Live map preview (only if we have something to show) */}
              {mapQuery && (
                <Box mt="2" style={{ maxWidth: 520 }}>
                  <MapEmbed query={mapQuery} zoom={15} />
                </Box>
              )}
            </Column>

            {/* RIGHT: Contact person */}
            <Column title="Contact person">
              <Field
                label="For system owner to contact this company"
                maxWidth={520}
              >
                {data.contact_person ? (
                  <Box
                    style={{
                      padding: 12,
                      background: 'var(--gray-a2)',
                      borderRadius: 6,
                    }}
                  >
                    <Text as="div" size="3" weight="medium" mb="2">
                      {data.contact_person.display_name || 'No name'}
                    </Text>
                    {data.contact_person.email && (
                      <Text as="div" size="2" color="gray" mb="1">
                        <a
                          href={`mailto:${data.contact_person.email}`}
                          style={{ color: 'inherit' }}
                        >
                          {data.contact_person.email}
                        </a>
                      </Text>
                    )}
                    {data.contact_person.phone && (
                      <Text as="div" size="2" color="gray">
                        <a
                          href={`tel:${data.contact_person.phone}`}
                          style={{ color: 'inherit' }}
                        >
                          {prettyPhone(data.contact_person.phone)}
                        </a>
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Text size="2" color="gray">
                    No contact person assigned
                  </Text>
                )}
              </Field>
            </Column>
          </Grid>
        </Flex>
      </div>
    </Card>
  )
}

/* ---------- Small helpers ---------- */

function Column({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Heading size="3" mb="2">
        {title}
      </Heading>
      <Flex direction="column" gap="3">
        {children}
      </Flex>
    </Box>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Flex wrap="wrap" gap="3" style={{ alignItems: 'start' }}>
      {children}
    </Flex>
  )
}

function Field({
  label,
  children,
  maxWidth = FIELD_MAX,
}: {
  label: string
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <Box style={{ maxWidth, width: 'min(100%, ' + maxWidth + 'px)' }}>
      <Text as="div" size="2" color="gray" mb="1">
        {label}
      </Text>
      <Box style={{ width: '100%' }}>{children}</Box>
    </Box>
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

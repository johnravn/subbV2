// src/features/super/components/CompanyInspector.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { companyDetailQuery } from '@features/company/api/queries'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import MapEmbed from '@shared/maps/MapEmbed'

export default function CompanyInspector({
  id,
  onDeleted,
  onEdit,
  onDelete,
}: {
  id: string | null
  onDeleted?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { data, isLoading, isError, error } = useQuery({
    ...companyDetailQuery({ companyId: id ?? '__none__' }),
    enabled: !!id,
  })

  // If query returns no data (company was deleted), clear selection
  React.useEffect(() => {
    if (id && !isLoading && data === undefined && !isError && onDeleted) {
      onDeleted()
    }
  }, [id, isLoading, data, isError, onDeleted])

  if (!id) return <Text color="gray">Select a company to view details.</Text>

  if (isLoading) return <InspectorSkeleton />

  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )

  if (!data) return <Text color="gray">Not found.</Text>

  const company = data
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2" mb="3">
        <Text as="div" size="4" weight="bold">
          {company.name}
        </Text>
        <Flex gap="2" align="center">
          <Button
            size="2"
            variant="soft"
            onClick={() => {
              onEdit?.()
            }}
          >
            <Edit />
          </Button>
          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => {
              onDelete?.()
            }}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Company Details */}
      <Flex direction="column" gap="3">
        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Company ID
          </Text>
          <Text size="2">{company.id}</Text>
        </div>

        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Created
          </Text>
          <Text size="2">{fmtDate(company.created_at)}</Text>
        </div>

        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            VAT number
          </Text>
          <Text size="2">{fmtVAT(company.vat_number)}</Text>
        </div>

        {company.general_email && (
          <div>
            <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
              General email
            </Text>
            <Text size="2">
              <a
                href={`mailto:${company.general_email}`}
                style={{ color: 'inherit' }}
              >
                {company.general_email}
              </a>
            </Text>
          </div>
        )}
      </Flex>

      <Separator my="3" />

      {/* Address section */}
      <Text as="div" size="2" weight="bold" mb="2">
        Address
      </Text>
      {company.address ? (
        (() => {
          // Parse the address string (stored as comma-separated: address_line, zip_code, city, country)
          const parts = company.address
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          const parsed = {
            address_line: parts[0] || '',
            zip_code: parts[1] || '',
            city: parts[2] || '',
            country: parts[3] || '',
          }

          return (
            <Grid columns={{ initial: '1', sm: '2' }} gap="4" mb="3">
              {/* Left column: Address fields */}
              <Flex direction="column" gap="2">
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    Street
                  </Text>
                  <Text size="2">{parsed.address_line || '—'}</Text>
                </div>
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    City
                  </Text>
                  <Text size="2">
                    {parsed.zip_code || parsed.city
                      ? `${parsed.zip_code} ${parsed.city}`.trim() || '—'
                      : '—'}
                  </Text>
                </div>
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    Country
                  </Text>
                  <Text size="2">{parsed.country || '—'}</Text>
                </div>
              </Flex>
              {/* Right column: Map */}
              <Box>
                <Text as="div" size="2" color="gray" mb="2">
                  Location
                </Text>
                <MapEmbed
                  query={company.address}
                  zoom={15}
                  style={{ maxWidth: '100%' }}
                />
              </Box>
            </Grid>
          )
        })()
      ) : (
        <Text size="2" color="gray" mb="3">
          No address on file
        </Text>
      )}

      <Separator my="3" />

      {/* Contact person section */}
      <Box>
        <Text as="div" size="2" weight="bold" mb="2">
          Contact person
        </Text>
        <Text as="div" size="1" color="gray" mb="3">
          For system owner to contact this company
        </Text>
        {company.contact_person ? (
          <Flex
            direction="column"
            gap="2"
            style={{
              padding: 12,
              background: 'var(--gray-a2)',
              borderRadius: 6,
            }}
          >
            <div>
              <Text as="div" size="2" weight="medium">
                {company.contact_person.display_name || 'No name'}
              </Text>
            </div>
            {company.contact_person.email && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Email
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`mailto:${company.contact_person.email}`}
                    style={{ color: 'inherit' }}
                  >
                    {company.contact_person.email}
                  </a>
                </Text>
              </div>
            )}
            {company.contact_person.phone && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Phone
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`tel:${company.contact_person.phone}`}
                    style={{ color: 'inherit' }}
                  >
                    {prettyPhone(company.contact_person.phone)}
                  </a>
                </Text>
              </div>
            )}
          </Flex>
        ) : (
          <Text size="2" color="gray">
            No contact person assigned
          </Text>
        )}
      </Box>
    </Box>
  )
}

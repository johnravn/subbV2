// src/features/super/components/CompaniesTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flex, Spinner, Table, Text, TextField } from '@radix-ui/themes'
import { companiesIndexQuery } from '@features/company/api/queries'
import type { CompanyIndexRow } from '@features/company/api/queries'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (company: CompanyIndexRow) => void
  onDelete: (company: CompanyIndexRow) => void
}

export default function CompaniesTable({ selectedId, onSelect }: Props) {
  const [search, setSearch] = React.useState('')

  const { data: companies = [], isLoading } = useQuery({
    ...companiesIndexQuery(),
  })

  const filteredCompanies = React.useMemo(() => {
    if (!search.trim()) return companies
    const query = search.toLowerCase()
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.general_email?.toLowerCase().includes(query) ||
        c.address?.toLowerCase().includes(query) ||
        c.vat_number?.toLowerCase().includes(query),
    )
  }, [companies, search])

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py="8">
        <Spinner size="3" />
      </Flex>
    )
  }

  return (
    <div>
      <Flex gap="2" mb="4" align="center">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          size="3"
          style={{ flex: '1 1 260px' }}
        />
      </Flex>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Contact Person</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filteredCompanies.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">
                  {search ? 'No companies found' : 'No companies'}
                </Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            filteredCompanies.map((company) => (
              <Table.Row
                key={company.id}
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    selectedId === company.id ? 'var(--accent-a3)' : undefined,
                }}
                onClick={() => onSelect(company.id)}
              >
                <Table.Cell>
                  <Text weight="medium">{company.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {company.general_email || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {company.contact_person?.display_name ||
                      company.contact_person?.email ||
                      '—'}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

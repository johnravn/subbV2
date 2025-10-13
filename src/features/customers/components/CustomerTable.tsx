import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  Spinner,
  Table,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { InfoCircle } from 'iconoir-react'
import { customersIndexQuery } from '../api/queries'
import AddCustomerDialog from './dialogs/AddCustomerDialog'

export default function CustomerTable({
  selectedId,
  onSelect,
  showRegular,
  showPartner,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  showRegular: boolean
  showPartner: boolean
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [addOpen, setAddOpen] = React.useState(false)

  const {
    data: rows = [],
    isFetching,
    isLoading,
  } = useQuery({
    ...customersIndexQuery({
      companyId: companyId ?? '__none__',
      search,
      showRegular,
      showPartner,
    }),
    enabled: !!companyId,
    staleTime: 10_000,
  })

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <Flex gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="right">
            {(isFetching || isLoading) && (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            )}
          </TextField.Slot>
        </TextField.Root>

        <Button variant="classic" onClick={() => setAddOpen(true)}>
          Add customer
        </Button>

        <AddCustomerDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={() =>
            qc.invalidateQueries({
              queryKey: ['company', companyId, 'customers-index'],
            })
          }
        />
      </Flex>

      <Table.Root variant="surface" style={{ marginTop: 16 }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Contact</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>VAT</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Flex gap={'1'}>
                Type
                <Tooltip content="Customer: normal customer, Partner: supplier & customer">
                  <InfoCircle width={'1em'} />
                </Tooltip>
              </Flex>
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4}>No results</Table.Cell>
            </Table.Row>
          ) : (
            rows.map((r) => {
              const active = r.id === selectedId
              return (
                <Table.Row
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--accent-a3)' : undefined,
                  }}
                  data-state={active ? 'active' : undefined}
                >
                  <Table.Cell>
                    <Text size="2" weight="medium">
                      {r.name}
                    </Text>
                    {r.address && (
                      <Text as="div" size="1" color="gray">
                        {r.address}
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {r.email || '—'}
                    </Text>
                    {r.phone && (
                      <Text as="div" size="1" color="gray">
                        {r.phone}
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>{r.vat_number || '—'}</Table.Cell>
                  <Table.Cell>
                    {r.is_partner ? (
                      <Badge variant="soft" color="green">
                        Partner
                      </Badge>
                    ) : (
                      <Badge variant="soft">Customer</Badge>
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

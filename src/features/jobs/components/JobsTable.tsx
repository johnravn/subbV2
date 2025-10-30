import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  IconButton,
  Popover,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { ArrowDown, ArrowUp, Calendar, Plus, Search, X } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { jobsIndexQuery } from '../api/queries'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow } from '../types'

type SortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type SortDir = 'asc' | 'desc'

export default function JobsTable({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { companyId } = useCompany()
  const [search, setSearch] = React.useState('')
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const [createOpen, setCreateOpen] = React.useState(false)

  const { data, isFetching, refetch } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search,
      selectedDate,
      sortBy,
      sortDir,
    }),
    enabled: !!companyId,
  })

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  return (
    <>
      <Flex gap="2" align="center" wrap="wrap" mb="3">
        <Flex gap="2" align="center" style={{ flex: '1 1 240px' }}>
          <TextField.Root
            placeholder="Search title, customer, or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="3"
            style={{ flex: 1 }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {isFetching && <Spinner />}
            </TextField.Slot>
          </TextField.Root>

          <Flex align="center" gap="2">
            <Popover.Root>
              <Popover.Trigger>
                <IconButton
                  size="3"
                  variant={selectedDate ? 'soft' : 'ghost'}
                  color={selectedDate ? 'blue' : undefined}
                >
                  <Calendar width={18} height={18} />
                </IconButton>
              </Popover.Trigger>
              <Popover.Content style={{ width: 300 }}>
                <Flex direction="column" gap="3">
                  <Flex align="center" justify="between">
                    <Text size="2" weight="medium">
                      Filter by date
                    </Text>
                    {selectedDate && (
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() => setSelectedDate('')}
                      >
                        <X width={14} height={14} />
                      </IconButton>
                    )}
                  </Flex>
                  <TextField.Root
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    placeholder="Select date"
                  />
                </Flex>
              </Popover.Content>
            </Popover.Root>
            {selectedDate && (
              <Text size="2" color="gray">
                {new Date(selectedDate).toLocaleDateString()}
              </Text>
            )}
          </Flex>
        </Flex>

        <Button size="2" variant="classic" onClick={() => setCreateOpen(true)}>
          <Plus width={16} height={16} /> New job
        </Button>
        <JobDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          companyId={companyId!}
          mode="create"
          onSaved={(id) => {
            // optional: highlight the newly created job
            onSelect(id)
            // refresh the table so it shows up
            refetch()
          }}
        />
      </Flex>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>
              <Flex
                align="center"
                gap="2"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('title')}
              >
                Title
                {sortBy === 'title' &&
                  (sortDir === 'asc' ? (
                    <ArrowUp width={14} height={14} />
                  ) : (
                    <ArrowDown width={14} height={14} />
                  ))}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Flex
                align="center"
                gap="2"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('customer_name')}
              >
                Customer
                {sortBy === 'customer_name' &&
                  (sortDir === 'asc' ? (
                    <ArrowUp width={14} height={14} />
                  ) : (
                    <ArrowDown width={14} height={14} />
                  ))}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Flex
                align="center"
                gap="2"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('start_at')}
              >
                Start
                {sortBy === 'start_at' &&
                  (sortDir === 'asc' ? (
                    <ArrowUp width={14} height={14} />
                  ) : (
                    <ArrowDown width={14} height={14} />
                  ))}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>
              <Flex
                align="center"
                gap="2"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('status')}
              >
                Status
                {sortBy === 'status' &&
                  (sortDir === 'asc' ? (
                    <ArrowUp width={14} height={14} />
                  ) : (
                    <ArrowDown width={14} height={14} />
                  ))}
              </Flex>
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data ?? []).map((j: JobListRow) => {
            const active = j.id === selectedId
            return (
              <Table.Row
                key={j.id}
                onClick={() => onSelect(j.id)}
                style={{
                  cursor: 'pointer',
                  background: active ? 'var(--accent-a3)' : undefined,
                }}
                data-state={active ? 'active' : undefined}
              >
                <Table.Cell>{j.title}</Table.Cell>
                <Table.Cell>{j.customer?.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  {j.start_at ? new Date(j.start_at).toLocaleString() : '—'}
                </Table.Cell>
                <Table.Cell>
                  <Badge radius="full" highContrast>
                    {makeWordPresentable(j.status)}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            )
          })}
          {(!data || data.length === 0) && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <Text color="gray">No jobs</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </>
  )
}

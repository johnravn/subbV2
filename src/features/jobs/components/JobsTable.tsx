import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  SegmentedControl,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Plus, Search } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { jobsIndexQuery } from '../api/queries'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow, JobStatus } from '../types'

export default function JobsTable({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { companyId } = useCompany()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | 'all'>(
    'all',
  )

  const [createOpen, setCreateOpen] = React.useState(false)

  const { data, isFetching, refetch } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search,
      status: statusFilter,
    }),
    enabled: !!companyId,
  })

  return (
    <>
      <Flex gap="2" align="center" wrap="wrap" mb="3">
        <TextField.Root
          placeholder="Search jobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="3"
          style={{ flex: '1 1 240px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner />}
          </TextField.Slot>
        </TextField.Root>

        <SegmentedControl.Root
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as any)}
        >
          <SegmentedControl.Item value="all">All</SegmentedControl.Item>
          <SegmentedControl.Item value="planned">Planned</SegmentedControl.Item>
          <SegmentedControl.Item value="confirmed">
            Confirmed
          </SegmentedControl.Item>
          <SegmentedControl.Item value="in_progress">
            Active
          </SegmentedControl.Item>
        </SegmentedControl.Root>

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
            <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
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

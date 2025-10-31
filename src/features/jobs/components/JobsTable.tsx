import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Button,
  Flex,
  IconButton,
  Spinner,
  Table,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { ArrowDown, ArrowUp, CalendarXmark, Plus, Search } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { jobsIndexQuery } from '../api/queries'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow } from '../types'

type SortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type SortDir = 'asc' | 'desc'

function getInitials(displayOrEmail: string | null): string {
  const base = (displayOrEmail || '').trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (base.includes('@')) return base[0].toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

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
            placeholder="Search title, customer, project lead, or date…"
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

          {selectedDate ? (
            <IconButton
              size="3"
              variant="soft"
              onClick={() => setSelectedDate('')}
            >
              <CalendarXmark width={18} height={18} />
            </IconButton>
          ) : (
            <DateTimePicker
              value=""
              onChange={(iso) => {
                // Convert ISO to YYYY-MM-DD for the query (which expects date string)
                if (iso) {
                  const d = new Date(iso)
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  setSelectedDate(dateStr)
                }
              }}
              dateOnly
              iconButton
              iconButtonSize="3"
            />
          )}
          {selectedDate && (
            <Text size="2" color="gray">
              {new Date(selectedDate).toLocaleDateString()}
            </Text>
          )}
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
            <Table.ColumnHeaderCell style={{ width: 50 }} />
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
            const projectLead = j.project_lead
            const avatarUrl = projectLead?.avatar_url
              ? supabase.storage
                  .from('avatars')
                  .getPublicUrl(projectLead.avatar_url).data.publicUrl
              : null
            const initials = projectLead
              ? getInitials(projectLead.display_name || projectLead.email)
              : ''
            const leadName =
              projectLead?.display_name || projectLead?.email || null

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
                <Table.Cell style={{ width: 50 }}>
                  {leadName ? (
                    <Tooltip content={leadName}>
                      <Avatar
                        size="2"
                        radius="full"
                        fallback={initials}
                        src={avatarUrl || undefined}
                        style={{ border: '1px solid var(--gray-5)' }}
                      />
                    </Tooltip>
                  ) : (
                    <Avatar
                      size="2"
                      radius="full"
                      fallback="—"
                      style={{
                        border: '1px solid var(--gray-5)',
                        opacity: 0.5,
                      }}
                    />
                  )}
                </Table.Cell>
                <Table.Cell>{j.title}</Table.Cell>
                <Table.Cell>{j.customer?.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  {j.start_at
                    ? new Date(j.start_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
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
              <Table.Cell colSpan={5}>
                <Text color="gray">No jobs</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </>
  )
}

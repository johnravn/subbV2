import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
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
import { useAuthz } from '@shared/auth/useAuthz'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarXmark,
  Plus,
  Search,
} from 'iconoir-react'
import { getInitials, makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { jobsIndexQuery } from '../api/queries'
import JobDialog from './dialogs/JobDialog'
import type { JobListRow, JobStatus } from '../types'

// Helper function to mask status for freelancers
function getDisplayStatus(
  status: JobStatus,
  companyRole: string | null,
): JobStatus {
  if (companyRole === 'freelancer') {
    // Freelancers should not see statuses beyond 'completed'
    if (status === 'invoiced' || status === 'paid') {
      return 'completed'
    }
  }
  return status
}

type SortBy = 'title' | 'start_at' | 'status' | 'customer_name'
type SortDir = 'asc' | 'desc'

// Using shared getInitials from generalFunctions

export default function JobsTable({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { companyId } = useCompany()
  const { userId, companyRole } = useAuthz()
  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [search, setSearch] = React.useState('')
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [createOpen, setCreateOpen] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

  const {
    data: allData = [],
    isFetching,
    refetch,
  } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search,
      selectedDate,
      sortBy,
      sortDir,
      userId,
      companyRole,
      includeArchived,
    }),
    enabled: !!companyId,
  })

  // Archive/unarchive mutation
  const archiveJob = useMutation({
    mutationFn: async ({
      jobId,
      archived,
    }: {
      jobId: string
      archived: boolean
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ archived })
        .eq('id', jobId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company'] })
      await qc.invalidateQueries({ queryKey: ['jobs-index'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail'] })
      success('Job updated', 'Job archive status has been updated.')
    },
    onError: (err: any) => {
      showError('Failed to update job', err?.message || 'Please try again.')
    },
  })

  // Recompute page size based on available space
  const recomputePageSize = React.useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const screenH = containerRect.height

    if (screenH === 0) return

    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    const miscPadding = 48 // Increased to account for pagination controls

    const available = Math.max(
      0,
      screenH - controlsH - theadH - pagerH - miscPadding,
    )

    if (available < 100) {
      setPageSize(5)
      return
    }

    const visibleRow = containerRef.current.querySelector<HTMLTableRowElement>(
      'tbody tr:not([data-row-probe])',
    )
    const rowH = visibleRow?.getBoundingClientRect().height || 60

    // Be conservative - don't add extra rows, and use floor to ensure we don't overflow
    const rows = Math.max(5, Math.min(50, Math.floor(available / rowH)))
    setPageSize(rows)
  }, [])

  React.useEffect(() => {
    if (!containerRef.current) return

    const onResize = () => recomputePageSize()
    window.addEventListener('resize', onResize)

    const resizeObserver = new ResizeObserver(() => {
      recomputePageSize()
    })

    resizeObserver.observe(containerRef.current)

    const timeoutId = setTimeout(() => {
      recomputePageSize()
    }, 0)

    const rafId = requestAnimationFrame(() => {
      recomputePageSize()
    })

    return () => {
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
    }
  }, [recomputePageSize])

  React.useEffect(() => {
    if (allData.length > 0) {
      requestAnimationFrame(() => {
        recomputePageSize()
      })
    }
  }, [allData.length, recomputePageSize])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1)
  }, [search, selectedDate, sortBy, sortDir, includeArchived])

  // Paginate the data
  const totalPages = Math.ceil(allData.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const data = allData.slice(startIndex, endIndex)

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  return (
    <Box
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div ref={controlsRef}>
        <Flex gap="2" align="center" mb="3" wrap="wrap">
          <TextField.Root
            placeholder="Search title, customer, status, project lead, or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="3"
            style={{ flex: 1, minWidth: 200 }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {isFetching && <Spinner />}
            </TextField.Slot>
          </TextField.Root>

          <Button
            size="2"
            variant={includeArchived ? 'classic' : 'soft'}
            onClick={() => setIncludeArchived(!includeArchived)}
          >
            <Archive width={16} height={16} />
            {includeArchived ? 'Hide archived' : 'Show archived'}
          </Button>

          {selectedDate ? (
            <Tooltip
              content={`Selected: ${new Date(selectedDate).toLocaleDateString()}`}
            >
              <IconButton
                size="2"
                variant="soft"
                color="blue"
                onClick={() => setSelectedDate('')}
              >
                <CalendarXmark width={16} height={16} />
              </IconButton>
            </Tooltip>
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
              iconButtonSize="2"
            />
          )}

          {companyRole !== 'freelancer' && (
            <Button
              size="2"
              variant="classic"
              onClick={() => setCreateOpen(true)}
            >
              <Plus width={16} height={16} /> New job
            </Button>
          )}
        </Flex>
      </div>
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

      <Box style={{ flex: 1, minHeight: 0 }}>
        <Table.Root variant="surface">
          <Table.Header ref={theadRef}>
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
              <Table.ColumnHeaderCell style={{ width: 60, textAlign: 'right' }}>
                Actions
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>No jobs found</Table.Cell>
              </Table.Row>
            ) : (
              data.map((j: JobListRow) => {
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

                // Show archive button only for paid or canceled jobs and only if user is project lead
                const isProjectLead = userId && projectLead?.user_id === userId
                const canArchive =
                  (j.status === 'paid' || j.status === 'canceled') &&
                  isProjectLead
                const isPaid = j.status === 'paid'
                const isCanceled = j.status === 'canceled'

                return (
                  <Table.Row
                    key={j.id}
                    onClick={() => onSelect(j.id)}
                    style={{
                      cursor: 'pointer',
                      background: active
                        ? 'var(--accent-a3)'
                        : isPaid
                          ? 'var(--green-a2)'
                          : isCanceled
                            ? 'var(--red-a2)'
                            : undefined,
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
                    <Table.Cell>
                      {j.customer?.name ??
                        j.customer_user?.display_name ??
                        j.customer_user?.email ??
                        '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {j.start_at
                        ? (() => {
                            const d = new Date(j.start_at)
                            const hours = String(d.getHours()).padStart(2, '0')
                            const minutes = String(d.getMinutes()).padStart(
                              2,
                              '0',
                            )
                            return (
                              d.toLocaleString(undefined, {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              }) + ` ${hours}:${minutes}`
                            )
                          })()
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {(() => {
                        const displayStatus = getDisplayStatus(
                          j.status,
                          companyRole,
                        )
                        return (
                          <Badge
                            color={
                              displayStatus === 'canceled'
                                ? 'red'
                                : displayStatus === 'paid'
                                  ? 'green'
                                  : displayStatus === 'in_progress'
                                    ? 'amber'
                                    : 'blue'
                            }
                            radius="full"
                            highContrast
                          >
                            {makeWordPresentable(displayStatus)}
                          </Badge>
                        )
                      })()}
                    </Table.Cell>
                    <Table.Cell
                      style={{ textAlign: 'right', verticalAlign: 'middle' }}
                    >
                      {canArchive && (
                        <Flex
                          align="center"
                          justify="end"
                          style={{ height: '100%' }}
                        >
                          <Tooltip
                            content={
                              j.archived ? 'Unarchive job' : 'Archive job'
                            }
                          >
                            <IconButton
                              size="2"
                              variant="soft"
                              color={j.archived ? 'blue' : 'gray'}
                              onClick={(e) => {
                                e.stopPropagation()
                                archiveJob.mutate({
                                  jobId: j.id,
                                  archived: !j.archived,
                                })
                              }}
                              disabled={archiveJob.isPending}
                            >
                              <Archive width={18} height={18} />
                            </IconButton>
                          </Tooltip>
                        </Flex>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
            {/* Probe row for height measurement */}
            <Table.Row
              data-row-probe
              style={{
                display: 'none',
              }}
            >
              <Table.Cell colSpan={6}>probe</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Box>

      {allData.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-{Math.min(endIndex, allData.length)} of{' '}
              {allData.length} jobs
            </Text>
            <Flex gap="2">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                variant="classic"
                size="2"
              >
                Prev
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                variant="classic"
                size="2"
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </div>
      )}
    </Box>
  )
}

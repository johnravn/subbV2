import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Select,
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
  ArrowDown,
  ArrowUp,
  CalendarXmark,
  Plus,
  Search,
  Xmark,
} from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { supabase } from '@shared/api/supabase'
import { customersForFilterQuery, jobsIndexQuery } from '../api/queries'
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
  const { userId, companyRole } = useAuthz()
  const [search, setSearch] = React.useState('')
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [customerIdFilter, setCustomerIdFilter] = React.useState<string | null>(
    null,
  )
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false)
  const [customerInputFocused, setCustomerInputFocused] = React.useState(false)
  const customerSearchRef = React.useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null)
  const [sortBy, setSortBy] = React.useState<SortBy>('start_at')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [createOpen, setCreateOpen] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)
  const pagerRef = React.useRef<HTMLDivElement>(null)

  const { data: customers } = useQuery({
    ...customersForFilterQuery(companyId ?? '__none__'),
    enabled: !!companyId,
  })

  const { data: allData = [], isFetching, refetch } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '__none__',
      search,
      selectedDate,
      customerId: customerIdFilter,
      status: statusFilter,
      sortBy,
      sortDir,
      userId,
      companyRole,
    }),
    enabled: !!companyId,
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

    const visibleRow = containerRef.current?.querySelector<HTMLTableRowElement>(
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
  }, [search, selectedDate, customerIdFilter, statusFilter, sortBy, sortDir])

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

  // Filter customers based on search query
  const filteredCustomers = React.useMemo(() => {
    if (!customers) return []
    if (!customerSearchQuery.trim()) return customers
    const query = customerSearchQuery.toLowerCase().trim()
    return customers.filter((c) => c.name.toLowerCase().includes(query))
  }, [customers, customerSearchQuery])

  // Get selected customer name
  const selectedCustomerName = React.useMemo(() => {
    if (!customerIdFilter || !customers) return ''
    const customer = customers.find((c) => c.id === customerIdFilter)
    return customer?.name || ''
  }, [customerIdFilter, customers])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false)
        setCustomerInputFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <Box ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={controlsRef}>
        <Flex direction="column" gap="2" mb="3">
        <Flex gap="2" align="center">
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

        <Flex gap="2" align="center" wrap="wrap">
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

          <div
            ref={customerSearchRef}
            style={{ position: 'relative', flex: 1 }}
          >
            <TextField.Root
              value={
                customerIdFilter &&
                selectedCustomerName &&
                !customerInputFocused
                  ? selectedCustomerName
                  : customerSearchQuery
              }
              onChange={(e) => {
                const value = e.target.value
                setCustomerSearchQuery(value)
                setShowCustomerDropdown(true)
                if (customerIdFilter && value !== selectedCustomerName) {
                  setCustomerIdFilter(null)
                }
              }}
              onFocus={() => {
                setCustomerInputFocused(true)
                setShowCustomerDropdown(true)
                if (customerIdFilter && selectedCustomerName) {
                  setCustomerSearchQuery(selectedCustomerName)
                }
              }}
              onBlur={() => {
                // Delay to allow click on dropdown items
                setTimeout(() => {
                  setCustomerInputFocused(false)
                }, 200)
              }}
              placeholder="Filter customer…"
              size="3"
              style={{ minHeight: 'var(--space-7)', flex: 1 }}
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
              {customerIdFilter && (
                <TextField.Slot side="right">
                  <IconButton
                    size="1"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCustomerIdFilter(null)
                      setCustomerSearchQuery('')
                      setShowCustomerDropdown(false)
                      setCustomerInputFocused(false)
                    }}
                  >
                    <Xmark width={12} height={12} />
                  </IconButton>
                </TextField.Slot>
              )}
            </TextField.Root>
            {showCustomerDropdown && (
              <Box
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  marginTop: 4,
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-panel-solid)',
                  maxHeight: 200,
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-4)',
                }}
              >
                {!customerSearchQuery.trim() && (
                  <Box
                    p="3"
                    style={{
                      cursor: 'pointer',
                      backgroundColor:
                        customerIdFilter === null
                          ? 'var(--accent-a3)'
                          : 'transparent',
                    }}
                    onClick={() => {
                      setCustomerIdFilter(null)
                      setCustomerSearchQuery('')
                      setShowCustomerDropdown(false)
                      setCustomerInputFocused(false)
                    }}
                    onMouseEnter={(e) => {
                      if (customerIdFilter !== null) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customerIdFilter !== null) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <Text
                      size="2"
                      weight={customerIdFilter === null ? 'medium' : 'regular'}
                    >
                      All customers
                    </Text>
                  </Box>
                )}
                {filteredCustomers.map((customer) => (
                  <Box
                    key={customer.id}
                    p="3"
                    style={{
                      cursor: 'pointer',
                      backgroundColor:
                        customerIdFilter === customer.id
                          ? 'var(--accent-a3)'
                          : 'transparent',
                    }}
                    onClick={() => {
                      setCustomerIdFilter(customer.id)
                      setCustomerSearchQuery('')
                      setShowCustomerDropdown(false)
                      setCustomerInputFocused(false)
                    }}
                    onMouseEnter={(e) => {
                      if (customerIdFilter !== customer.id) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a3)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customerIdFilter !== customer.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <Text
                      size="2"
                      weight={
                        customerIdFilter === customer.id ? 'medium' : 'regular'
                      }
                    >
                      {customer.name}
                    </Text>
                  </Box>
                ))}
                {customerSearchQuery.trim() &&
                  filteredCustomers.length === 0 && (
                    <Box p="3">
                      <Text size="2" color="gray">
                        No customers found
                      </Text>
                    </Box>
                  )}
              </Box>
            )}
          </div>

          <Select.Root
            value={statusFilter ?? 'all'}
            size="3"
            onValueChange={(val) => {
              setStatusFilter(val === 'all' ? null : val)
            }}
          >
            <Select.Trigger
              placeholder="Filter status…"
              style={{ minHeight: 'var(--space-7)', flex: 1 }}
            />
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              {(
                [
                  'draft',
                  'planned',
                  'requested',
                  'confirmed',
                  'in_progress',
                  'completed',
                  'canceled',
                  'invoiced',
                  'paid',
                ] as Array<JobStatus>
              ).map((status) => (
                <Select.Item key={status} value={status}>
                  {makeWordPresentable(status)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
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
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5}>No jobs found</Table.Cell>
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
                    ? (() => {
                        const d = new Date(j.start_at)
                        const hours = String(d.getHours()).padStart(2, '0')
                        const minutes = String(d.getMinutes()).padStart(2, '0')
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
            <Table.Cell colSpan={5}>probe</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      </Box>

      {allData.length > 0 && (
        <div ref={pagerRef}>
          <Flex align="center" justify="between" mt="3">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-
              {Math.min(endIndex, allData.length)} of {allData.length} jobs
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

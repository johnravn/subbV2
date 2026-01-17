import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { crewIndexQuery, type CrewPerson } from '../../crew/api/queries'
import { timeEntriesQuery } from '../../logging/api/timeEntries'
import TimeEntriesTable from '../../logging/components/TimeEntriesTable'
import {
  formatMonthInput,
  getRange,
  type RangeOption,
} from '../../logging/lib/timeEntryRange'

type UserFilter = 'all' | string

export default function CompanyLoggingTab() {
  const { companyId } = useCompany()
  const [range, setRange] = React.useState<RangeOption>('month')
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    formatMonthInput(new Date()),
  )
  const { from, to, label } = React.useMemo(
    () => getRange(range, selectedMonth),
    [range, selectedMonth],
  )

  const [selectedUserId, setSelectedUserId] =
    React.useState<UserFilter>('all')

  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    ...(companyId
      ? crewIndexQuery({ companyId, kind: 'all' })
      : {
          queryKey: ['company', 'none', 'crew-index', 'all'] as const,
          queryFn: async () => [],
        }),
    enabled: !!companyId,
  })

  const employeesSorted = React.useMemo(() => {
    const list = employees.filter((person) => person.role !== 'freelancer')
    list.sort((a, b) =>
      getEmployeeLabel(a).localeCompare(getEmployeeLabel(b)),
    )
    return list
  }, [employees])

  React.useEffect(() => {
    if (
      selectedUserId !== 'all' &&
      employeesSorted.length > 0 &&
      !employeesSorted.some((employee) => employee.user_id === selectedUserId)
    ) {
      setSelectedUserId('all')
    }
  }, [employeesSorted, selectedUserId])

  const effectiveUserId =
    selectedUserId === 'all' ? null : selectedUserId

  const entriesEnabled = Boolean(companyId)
  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesQuery({
      companyId: companyId ?? '',
      userId: effectiveUserId,
      from,
      to,
    }),
    enabled: entriesEnabled,
  })

  const totalHours = React.useMemo(() => {
    const total = entries.reduce((acc, entry) => {
      const start = new Date(entry.start_at).getTime()
      const end = new Date(entry.end_at).getTime()
      const durationMs = Math.max(0, end - start)
      return acc + durationMs
    }, 0)
    return total / (1000 * 60 * 60)
  }, [entries])

  return (
    <section style={{ minHeight: 0 }}>
      <Flex direction="column" gap="4">
        <Card size="3">
          <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
            <Heading size="5">Logging</Heading>
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Person
              </Text>
              <Select.Root
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(value)}
                disabled={isEmployeesLoading}
              >
                <Select.Trigger placeholder="Select employee" />
                <Select.Content>
                  <Select.Item value="all">All staff</Select.Item>
                  {employeesSorted.map((employee) => (
                    <Select.Item key={employee.user_id} value={employee.user_id}>
                      {getEmployeeLabel(employee)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
          </Flex>

          <Text size="2" color="gray" mb="3">
            Showing entries for {label}
          </Text>
          <Separator size="4" mb="3" />

          <Flex align="center" gap="3" wrap="wrap" mb="3">
            <Text size="2" color="gray">
              {entries.length} total
            </Text>
            <SegmentedControl.Root
              value={range}
              onValueChange={(value) => setRange(value as RangeOption)}
            >
              <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
              <SegmentedControl.Item value="year">This year</SegmentedControl.Item>
              <SegmentedControl.Item value="last-year">
                Last year
              </SegmentedControl.Item>
            </SegmentedControl.Root>
            {range === 'month' && (
              <TextField.Root
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ minWidth: 160 }}
              />
            )}
          </Flex>

          <Box style={{ overflowX: 'auto' }}>
            {isEmployeesLoading ? (
              <Text>Loading employees...</Text>
            ) : employeesSorted.length === 0 && selectedUserId !== 'all' ? (
              <Text color="gray">No employees found.</Text>
            ) : (
              <TimeEntriesTable entries={entries} isLoading={isLoading} />
            )}
          </Box>

          <Flex justify="end" mt="3">
            <Text size="4" weight="bold">
              Total: {totalHours.toFixed(2)} hours
            </Text>
          </Flex>
        </Card>
      </Flex>
    </section>
  )
}

function getEmployeeLabel(employee: CrewPerson) {
  return (
    employee.display_name ||
    [employee.first_name, employee.last_name].filter(Boolean).join(' ') ||
    employee.email
  )
}

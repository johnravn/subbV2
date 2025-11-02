// src/features/company/components/CompanyUsersTab.tsx
import * as React from 'react'
import {
  Box,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  Button,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { NavArrowDown } from 'iconoir-react'
import CompanyTable from './CompanyTable'
import CrewInspector from '../../crew/components/CrewInspector'

type Selection =
  | { kind: 'user'; userId: string }
  | { kind: 'none' }

export default function CompanyUsersTab() {
  const { companyId } = useCompany()
  const [selection, setSelection] = React.useState<Selection>({ kind: 'none' })

  // ⬇️ Same filters as before
  const [showEmployees, setShowEmployees] = React.useState(true)
  const [showFreelancers, setShowFreelancers] = React.useState(true)
  const [showMyPending, setShowMyPending] = React.useState(true)

  // same responsive pattern
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  if (!companyId) return <div>No company selected.</div>

  return (
    <Grid
      columns={{ initial: '1fr', lg: '2fr 1fr' }}
      gap="4"
      align="stretch"
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
        flex: isLarge ? 1 : undefined,
      }}
    >
      {/* LEFT */}
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Flex align="center" justify="between" mb="3">
          <Heading size="5">Users</Heading>
          <StatusDropdown
            showEmployees={showEmployees}
            showFreelancers={showFreelancers}
            showMyPending={showMyPending}
            onShowEmployeesChange={setShowEmployees}
            onShowFreelancersChange={setShowFreelancers}
            onShowMyPendingChange={setShowMyPending}
          />
        </Flex>
        <Separator size="4" mb="3" />

        {/* Employees/Freelancers/Invites table */}
        <Box
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            overflowY: isLarge ? 'auto' : 'visible',
          }}
        >
          <CompanyTable
            selectedUserId={
              selection.kind === 'user' ? selection.userId : null
            }
            onSelectUser={(userId) => setSelection({ kind: 'user', userId })}
            showEmployees={showEmployees}
            showFreelancers={showFreelancers}
            showMyPending={showMyPending}
          />
        </Box>
      </Card>

      {/* RIGHT */}
      <Card
        size="3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          maxHeight: isLarge ? '100%' : undefined,
          overflow: isLarge ? 'hidden' : 'visible',
          minHeight: 0,
        }}
      >
        <Heading size="5" mb="3">
          Inspector
        </Heading>
        <Separator size="4" mb="3" />
        <Box
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            overflowY: isLarge ? 'auto' : 'visible',
          }}
        >
          {selection.kind === 'user' ? (
            <CrewInspector userId={selection.userId} />
          ) : (
            <div style={{ color: 'var(--gray-11)' }}>
              Select an employee to view details.
            </div>
          )}
        </Box>
      </Card>
    </Grid>
  )
}

function StatusDropdown({
  showEmployees,
  showFreelancers,
  showMyPending,
  onShowEmployeesChange,
  onShowFreelancersChange,
  onShowMyPendingChange,
}: {
  showEmployees: boolean
  showFreelancers: boolean
  showMyPending: boolean
  onShowEmployeesChange: (v: boolean) => void
  onShowFreelancersChange: (v: boolean) => void
  onShowMyPendingChange: (v: boolean) => void
}) {
  const selectedCount = [showEmployees, showFreelancers, showMyPending].filter(
    Boolean,
  ).length

  const label =
    selectedCount === 3
      ? 'All statuses'
      : selectedCount === 0
        ? 'No statuses'
        : `${selectedCount} selected`

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="soft" size="2">
          <Text>{label}</Text>
          <NavArrowDown width={14} height={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowEmployeesChange(!showEmployees)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showEmployees}
              onCheckedChange={onShowEmployeesChange}
            />
            <Text>Employees</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowFreelancersChange(!showFreelancers)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showFreelancers}
              onCheckedChange={onShowFreelancersChange}
            />
            <Text>Freelancers</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowMyPendingChange(!showMyPending)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showMyPending}
              onCheckedChange={onShowMyPendingChange}
            />
            <Text>My pending invites</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}


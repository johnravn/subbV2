import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { NavArrowDown } from 'iconoir-react'
import CrewTable from '../components/CrewTable'
import CrewInspector from '../components/CrewInspector'

export default function CrewPage() {
  const { companyId } = useCompany()
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  )
  const [showEmployees, setShowEmployees] = React.useState(true)
  const [showFreelancers, setShowFreelancers] = React.useState(true)
  const [showMyPending, setShowMyPending] = React.useState(true)

  // same responsive pattern as InventoryPage
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
    <section style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isLarge ? '2fr 1fr' : '1fr',
          gap: 'var(--space-4)',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
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
            <Heading size="5">Crew</Heading>
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
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <CrewTable
              selectedUserId={selectedUserId}
              onSelect={setSelectedUserId}
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
            <CrewInspector userId={selectedUserId} />
          </Box>
        </Card>
      </div>
    </section>
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

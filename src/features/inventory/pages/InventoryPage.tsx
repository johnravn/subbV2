// src/features/inventory/pages/InventoryPage.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { NavArrowDown } from 'iconoir-react'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'

export default function InventoryPage() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showActive, setShowActive] = React.useState(true)
  const [showInactive, setShowInactive] = React.useState(false)
  const [showInternal, setShowInternal] = React.useState(true)
  const [showExternal, setShowExternal] = React.useState(true)
  const [showGroupOnlyItems, setShowGroupOnlyItems] = React.useState(false)
  const [showGroups, setShowGroups] = React.useState(true)
  const [showItems, setShowItems] = React.useState(true)
  const { companyId } = useCompany()

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    // Safari <14 fallback
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  if (!companyId) return <PageSkeleton columns="2fr 1fr" />

  return (
    <section
      // On large screens we want the section to fill available height so inner scroll works.
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Grid
        columns={{ initial: '1fr', lg: '2fr 1fr' }} // stack <1024px; 65/35 at >=1024px
        gap="4"
        align="stretch"
        style={{
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
            // Only force full-height layout on large screens
            height: isLarge ? '100%' : undefined,
            minHeight: 0,
          }}
        >
          <Flex align="center" justify="between" mb="3">
            <Heading size="5">Overview</Heading>
            <FiltersDropdown
              showActive={showActive}
              showInactive={showInactive}
              showInternal={showInternal}
              showExternal={showExternal}
              showGroupOnlyItems={showGroupOnlyItems}
              showGroups={showGroups}
              showItems={showItems}
              onShowActiveChange={setShowActive}
              onShowInactiveChange={setShowInactive}
              onShowInternalChange={setShowInternal}
              onShowExternalChange={setShowExternal}
              onShowGroupOnlyItemsChange={setShowGroupOnlyItems}
              onShowGroupsChange={setShowGroups}
              onShowItemsChange={setShowItems}
            />
          </Flex>

          <Separator size="4" mb="3" />

          {/* Scrollable on large screens; flows naturally on small */}
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <InventoryTable
              selectedId={selectedId}
              onSelect={setSelectedId}
              showActive={showActive}
              showInactive={showInactive}
              showInternal={showInternal}
              showExternal={showExternal}
              showGroupOnlyItems={showGroupOnlyItems}
              showGroups={showGroups}
              showItems={showItems}
              pageSizeOverride={!isLarge ? 12 : undefined}
            />
          </Box>
        </Card>

        {/* RIGHT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            // Contain/scroll on large; expand on small
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

          {/* Scrollable on large screens; flows naturally on small */}
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <InventoryInspector id={selectedId} />
          </Box>
        </Card>
      </Grid>
    </section>
  )
}

function FiltersDropdown({
  showActive,
  showInactive,
  showInternal,
  showExternal,
  showGroupOnlyItems,
  showGroups,
  showItems,
  onShowActiveChange,
  onShowInactiveChange,
  onShowInternalChange,
  onShowExternalChange,
  onShowGroupOnlyItemsChange,
  onShowGroupsChange,
  onShowItemsChange,
}: {
  showActive: boolean
  showInactive: boolean
  showInternal: boolean
  showExternal: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  onShowActiveChange: (v: boolean) => void
  onShowInactiveChange: (v: boolean) => void
  onShowInternalChange: (v: boolean) => void
  onShowExternalChange: (v: boolean) => void
  onShowGroupOnlyItemsChange: (v: boolean) => void
  onShowGroupsChange: (v: boolean) => void
  onShowItemsChange: (v: boolean) => void
}) {
  const selectedCount = [
    showActive,
    showInactive,
    showInternal,
    showExternal,
    showGroupOnlyItems,
    showGroups,
    showItems,
  ].filter(Boolean).length

  const label =
    selectedCount === 7
      ? 'All filters'
      : selectedCount === 0
        ? 'No filters'
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
        <DropdownMenu.Label>Status</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowActiveChange(!showActive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showActive}
              onCheckedChange={onShowActiveChange}
            />
            <Text>Active</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowInactiveChange(!showInactive)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
            <Text>Inactive</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Ownership</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowInternalChange(!showInternal)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showInternal}
              onCheckedChange={onShowInternalChange}
            />
            <Text>Internal</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowExternalChange(!showExternal)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showExternal}
              onCheckedChange={onShowExternalChange}
            />
            <Text>External</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Type</DropdownMenu.Label>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupOnlyItemsChange(!showGroupOnlyItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroupOnlyItems}
              onCheckedChange={onShowGroupOnlyItemsChange}
            />
            <Text>Group-only items</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowGroupsChange(!showGroups)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox
              checked={showGroups}
              onCheckedChange={onShowGroupsChange}
            />
            <Text>Groups</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault()
            onShowItemsChange(!showItems)
          }}
        >
          <Flex align="center" gap="2">
            <Checkbox checked={showItems} onCheckedChange={onShowItemsChange} />
            <Text>Items</Text>
          </Flex>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

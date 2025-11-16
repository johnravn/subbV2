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
import { useLocation } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import { NavArrowDown } from 'iconoir-react'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'

export default function InventoryPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const search = location.search as { inventoryId?: string }
  const inventoryId = search?.inventoryId

  const [selectedId, setSelectedId] = React.useState<string | null>(
    inventoryId || null,
  )

  // Update selectedId when inventoryId from URL changes
  React.useEffect(() => {
    if (inventoryId) {
      setSelectedId(inventoryId)
    }
  }, [inventoryId])
  const [showActive, setShowActive] = React.useState(true)
  const [showInactive, setShowInactive] = React.useState(false)
  const [showInternal, setShowInternal] = React.useState(true)
  const [showExternal, setShowExternal] = React.useState(true)
  const [showGroupOnlyItems, setShowGroupOnlyItems] = React.useState(false)
  const [showGroups, setShowGroups] = React.useState(true)
  const [showItems, setShowItems] = React.useState(true)

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  // Resize state: track left panel width as percentage (default 66.67% for 2fr/3fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(66.67)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      setLeftPanelWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!companyId) return <PageSkeleton columns="2fr 1fr" />

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Grid
          columns="1fr"
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
              <InventoryInspector id={selectedId} />
            </Box>
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: isLarge ? '100%' : undefined,
            minWidth: '300px', // Prevent panel from getting too small
            maxWidth: '75%', // Enforce max width
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
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

        {/* RESIZER */}
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '6px',
            height: '20%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px', // Extend into gap for easier clicking
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
              e.currentTarget.style.cursor = 'col-resize'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* RIGHT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: isLarge ? '100%' : undefined,
            maxHeight: isLarge ? '100%' : undefined,
            overflow: isLarge ? 'hidden' : 'visible',
            minWidth: '300px', // Prevent panel from getting too small
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
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
            <InventoryInspector id={selectedId} />
          </Box>
        </Card>
      </Flex>
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

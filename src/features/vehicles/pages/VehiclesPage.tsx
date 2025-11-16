import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  SegmentedControl,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import VehiclesView from '../components/VehiclesView'
import VehicleInspector from '../components/VehicleInspector'

type ViewMode = 'grid' | 'list'

export default function VehiclesPage() {
  const { companyId } = useCompany()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const [includeExternal, setIncludeExternal] = React.useState(true) // default true
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [search, setSearch] = React.useState('')

  // 50/50 split; same responsive pattern as you use elsewhere
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

  // Resize state: track left panel width as percentage (default 50% for 1fr/1fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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

  if (!companyId) return <div>No company selected.</div>

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}>
        <Grid
          columns="1fr"
          gap="4"
          align="stretch"
          style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}
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
            <Flex align="center" justify="between" mb="3" wrap="wrap" gap="3">
              <Heading size="5">Vehicles</Heading>
              <Flex align="center" gap="3" wrap="wrap">
                <Text size="2" color="gray">
                  Show external
                </Text>
                <Switch
                  checked={includeExternal}
                  onCheckedChange={(v) => setIncludeExternal(Boolean(v))}
                />

                <SegmentedControl.Root
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as ViewMode)}
                >
                  <SegmentedControl.Item value="grid">
                    Grid
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="list">
                    List
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>
            </Flex>
            <Separator size="4" mb="3" />

            {/* Controls + content scroll on large */}
            <Box
              style={{
                flex: isLarge ? 1 : undefined,
                minHeight: isLarge ? 0 : undefined,
                overflowY: isLarge ? 'auto' : 'visible',
              }}
            >
              <VehiclesView
                selectedId={selectedId}
                onSelect={setSelectedId}
                includeExternal={includeExternal}
                viewMode={viewMode}
                search={search}
                onSearch={setSearch}
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
              <VehicleInspector id={selectedId} />
            </Box>
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <section style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}>
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
            minWidth: '300px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          <Flex align="center" justify="between" mb="3" wrap="wrap" gap="3">
            <Heading size="5">Vehicles</Heading>
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                Show external
              </Text>
              <Switch
                checked={includeExternal}
                onCheckedChange={(v) => setIncludeExternal(Boolean(v))}
              />

              <SegmentedControl.Root
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
              >
                <SegmentedControl.Item value="grid">Grid</SegmentedControl.Item>
                <SegmentedControl.Item value="list">List</SegmentedControl.Item>
              </SegmentedControl.Root>
            </Flex>
          </Flex>
          <Separator size="4" mb="3" />

          {/* Controls + content scroll on large */}
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <VehiclesView
              selectedId={selectedId}
              onSelect={setSelectedId}
              includeExternal={includeExternal}
              viewMode={viewMode}
              search={search}
              onSearch={setSearch}
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
            margin: '0 -4px',
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
            minWidth: '300px',
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
            <VehicleInspector id={selectedId} />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

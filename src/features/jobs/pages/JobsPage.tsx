import * as React from 'react'
import { Box, Card, Flex, Grid, Heading, Separator } from '@radix-ui/themes'
import { useLocation } from '@tanstack/react-router'
import { useCompany } from '@shared/companies/CompanyProvider'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import JobsTable from '../components/JobsTable'
import JobInspector from '../components/JobInspector'

export default function JobsPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const search = location.search as { jobId?: string; tab?: string }
  const jobId = search?.jobId
  const tab = search?.tab

  const [selectedId, setSelectedId] = React.useState<string | null>(
    jobId || null,
  )

  // Update selectedId when jobId from URL changes
  React.useEffect(() => {
    if (jobId) {
      setSelectedId(jobId)
    }
  }, [jobId])

  // match InventoryPage behavior
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

  // Resize state: track left panel width as percentage (default 30%)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(37)
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

  if (!companyId) return <PageSkeleton columns="2fr 3fr" />

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
          {/* LEFT: Jobs table */}
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: isLarge ? '100%' : undefined,
              minHeight: 0,
            }}
          >
            <Heading size="5" mb="3">
              Jobs
            </Heading>
            <Separator size="4" mb="3" />
            <Box
              style={{
                flex: isLarge ? 1 : undefined,
                minHeight: isLarge ? 0 : undefined,
                overflowY: isLarge ? 'auto' : 'visible',
              }}
            >
              <JobsTable selectedId={selectedId} onSelect={setSelectedId} />
            </Box>
          </Card>

          {/* RIGHT: Inspector */}
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
              <JobInspector
                id={selectedId}
                onDeleted={() => setSelectedId(null)}
                initialTab={tab}
              />
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
        gap="4"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT: Jobs table */}
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
          <Heading size="5" mb="3">
            Jobs
          </Heading>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <JobsTable selectedId={selectedId} onSelect={setSelectedId} />
          </Box>
        </Card>

        {/* RESIZER */}
        <Box
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '8px',
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
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* RIGHT: Inspector */}
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
            <JobInspector
              id={selectedId}
              onDeleted={() => setSelectedId(null)}
              initialTab={tab}
            />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

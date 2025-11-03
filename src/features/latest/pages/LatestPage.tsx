// src/features/latest/pages/LatestPage.tsx
import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { Box, Card, Flex, Grid, Heading, Separator } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import LatestFeed from '../components/LatestFeed'
import LatestInspector from '../components/LatestInspector'
import ActivityFilter from '../components/ActivityFilter'
import type { ActivityType } from '../types'

export default function LatestPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const search = location.search as { activityId?: string }
  const activityId = search.activityId
  const [selectedId, setSelectedId] = React.useState<string | null>(
    activityId || null,
  )
  const [activityTypes, setActivityTypes] = React.useState<Array<ActivityType>>(
    [],
  )

  // Update selectedId when activityId from URL changes
  React.useEffect(() => {
    if (activityId) {
      setSelectedId(activityId)
    }
  }, [activityId])

  // Responsive layout
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

  // Resize state: track left panel width as percentage (default 37%)
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

      const mouseX = e.clientX - containerRect.left
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
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!companyId) return <PageSkeleton columns="2fr 3fr" />

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section>
        <Grid columns="1fr" gap="4" align="stretch">
          {/* LEFT: Feed */}
          <Card size="3" style={{ display: 'flex', flexDirection: 'column' }}>
            <Flex align="center" justify="between" mb="3">
              <Heading size="5">Latest</Heading>
              <ActivityFilter
                selectedTypes={activityTypes}
                onTypesChange={setActivityTypes}
              />
            </Flex>
            <Separator size="4" mb="3" />
            <Box>
              <LatestFeed
                selectedId={selectedId}
                onSelect={setSelectedId}
                activityTypes={
                  activityTypes.length > 0 ? activityTypes : undefined
                }
              />
            </Box>
          </Card>

          {/* RIGHT: Inspector */}
          <Card size="3" style={{ display: 'flex', flexDirection: 'column' }}>
            <Heading size="5" mb="3">
              Details
            </Heading>
            <Separator size="4" mb="3" />
            <Box>
              <LatestInspector activityId={selectedId} />
            </Box>
          </Card>
        </Grid>
      </section>
    )
  }

  // Large screen: resizable split view
  return (
    <section
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <Flex
        direction="row"
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* LEFT: Feed */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '300px', // Prevent panel from getting too small
            maxWidth: '75%', // Enforce max width
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          <Flex align="center" justify="between" mb="3">
            <Heading size="5">Latest</Heading>
            <ActivityFilter
              selectedTypes={activityTypes}
              onTypesChange={setActivityTypes}
            />
          </Flex>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <LatestFeed
              selectedId={selectedId}
              onSelect={setSelectedId}
              activityTypes={
                activityTypes.length > 0 ? activityTypes : undefined
              }
            />
          </Box>
        </Card>

        {/* RESIZER */}
        <Box
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
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '300px', // Prevent panel from getting too small
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          <Heading size="5" mb="3">
            Details
          </Heading>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <LatestInspector activityId={selectedId} />
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

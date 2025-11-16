import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Plus } from 'iconoir-react'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import MatterList from '../components/MatterList'
import MatterDetail from '../components/MatterDetail'
import CreateMatterDialog from '../components/CreateMatterDialog'

export default function MattersPage() {
  const { companyId } = useCompany()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createMatterOpen, setCreateMatterOpen] = React.useState(false)
  const [unreadFilter, setUnreadFilter] = React.useState(false)

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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
          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Box
              mb="3"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Heading size="5">Matters</Heading>
              <Flex align="center" gap="3">
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">
                    Unread only
                  </Text>
                  <Switch
                    checked={unreadFilter}
                    onCheckedChange={setUnreadFilter}
                    size="2"
                  />
                </Flex>
                <Button size="2" onClick={() => setCreateMatterOpen(true)}>
                  <Plus /> New Matter
                </Button>
              </Flex>
            </Box>
            <Separator size="4" mb="3" />
            <Box
              style={{
                overflowY: 'visible',
              }}
            >
              <MatterList
                selectedId={selectedId}
                onSelect={setSelectedId}
                unreadFilter={unreadFilter}
              />
            </Box>
          </Card>

          <Card
            size="3"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Heading size="5" mb="3">
              Detail
            </Heading>
            <Separator size="4" mb="3" />
            <Box
              style={{
                overflowY: 'visible',
              }}
            >
              {selectedId ? (
                <MatterDetail
                  matterId={selectedId}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : (
                <Box p="4">
                  <Box style={{ textAlign: 'center' }}>
                    <Heading size="4" mb="2">
                      Select a matter
                    </Heading>
                    <p style={{ color: 'var(--gray-11)' }}>
                      Choose a matter from the list to view details, responses,
                      and chat.
                    </p>
                  </Box>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        <CreateMatterDialog
          open={createMatterOpen}
          onOpenChange={setCreateMatterOpen}
        />
      </section>
    )
  }

  return (
    <section
      style={{
        height: '100%',
        minHeight: 0,
      }}
    >
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '300px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          <Box
            mb="3"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Heading size="5">Matters</Heading>
            <Flex align="center" gap="3">
              <Flex align="center" gap="2">
                <Text size="2" weight="medium">
                  Unread only
                </Text>
                <Switch
                  checked={unreadFilter}
                  onCheckedChange={setUnreadFilter}
                  size="2"
                />
              </Flex>
              <Button size="2" onClick={() => setCreateMatterOpen(true)}>
                <Plus /> New Matter
              </Button>
            </Flex>
          </Box>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: 1,
              minHeight: 0,
            }}
          >
            <MatterList
              selectedId={selectedId}
              onSelect={setSelectedId}
              unreadFilter={unreadFilter}
            />
          </Box>
        </Card>

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

        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '300px',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          <Heading size="5" mb="3">
            Detail
          </Heading>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {selectedId ? (
              <MatterDetail
                matterId={selectedId}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <Box p="4">
                <Box style={{ textAlign: 'center' }}>
                  <Heading size="4" mb="2">
                    Select a matter
                  </Heading>
                  <p style={{ color: 'var(--gray-11)' }}>
                    Choose a matter from the list to view details, responses,
                    and chat.
                  </p>
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Flex>

      <CreateMatterDialog
        open={createMatterOpen}
        onOpenChange={setCreateMatterOpen}
      />
    </section>
  )
}

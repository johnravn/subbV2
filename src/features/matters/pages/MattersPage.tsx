import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Select,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
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
  const [companyFilter, setCompanyFilter] = React.useState<string | 'all'>(
    'all',
  )

  // Fetch all companies the user is a member of for the filter
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
  })

  const { data: companies } = useQuery({
    queryKey: ['my-companies', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', user!.id)
        .maybeSingle()

      const isSuperuser = profile?.superuser ?? false

      if (isSuperuser) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name', { ascending: true })
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('company_users')
          .select('companies ( id, name )')
          .eq('user_id', user!.id)
        if (error) throw error
        return (data as Array<any>)
          .map((r) => r.companies)
          .filter(Boolean)
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
      }
    },
  })

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
          minHeight: 0,
        }}
      >
        <Grid
          columns="1fr"
          gap="4"
          align="stretch"
          style={{
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
              <Flex align="center" gap="3" wrap="wrap">
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
                {companies && companies.length > 0 && (
                  <Select.Root
                    value={companyFilter}
                    size="3"
                    onValueChange={(val) => setCompanyFilter(val)}
                  >
                    <Select.Trigger
                      placeholder="Filter company…"
                      style={{ minHeight: 'var(--space-7)' }}
                    />
                    <Select.Content>
                      <Select.Item value="all">All Companies</Select.Item>
                      {companies.map((c: any) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
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
                companyFilter={companyFilter}
                companies={companies || []}
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
            <Flex align="center" gap="3" wrap="wrap">
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
              {companies && companies.length > 0 && (
                <Select.Root
                  value={companyFilter}
                  size="3"
                  onValueChange={(val) => setCompanyFilter(val)}
                >
                  <Select.Trigger
                    placeholder="Filter company…"
                    style={{ minHeight: 'var(--space-7)' }}
                  />
                  <Select.Content>
                    <Select.Item value="all">All Companies</Select.Item>
                    {companies.map((c: any) => (
                      <Select.Item key={c.id} value={c.id}>
                        {c.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              )}
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
              companyFilter={companyFilter}
              companies={companies || []}
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

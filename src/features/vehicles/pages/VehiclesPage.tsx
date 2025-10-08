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
  TextField,
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

  if (!companyId) return <div>No company selected.</div>

  return (
    <section style={{ height: isLarge ? '100%' : undefined, minHeight: 0 }}>
      <Grid
        columns={{ initial: '1fr', lg: '1fr 1fr' }} // 50/50 on desktop
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

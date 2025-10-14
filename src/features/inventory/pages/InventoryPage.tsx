// src/features/inventory/pages/InventoryPage.tsx
import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'

export default function InventoryPage() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [activeOnly, setActiveOnly] = React.useState(true)
  const [includeExternal, setIncludeExternal] = React.useState(true)
  const [allow_individual_booking, setAllow_individual_booking] =
    React.useState(true)
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

  if (!companyId) return <div>No company selected.</div>

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
            <Flex align="center" gap="3">
              <Flex align="center" gap="1">
                <Text size="2" color="gray">
                  Active only
                </Text>
                <Switch
                  checked={activeOnly}
                  onCheckedChange={(v) => setActiveOnly(Boolean(v))}
                />
              </Flex>
              <Flex align="center" gap="1">
                <Text size="2" color="gray">
                  Hide group-only items
                </Text>
                <Switch
                  checked={allow_individual_booking}
                  onCheckedChange={(v) =>
                    setAllow_individual_booking(Boolean(v))
                  }
                />
              </Flex>
              <Flex align="center" gap="1">
                <Text size="2" color="gray">
                  Show external
                </Text>
                <Switch
                  checked={includeExternal}
                  onCheckedChange={(v) => setIncludeExternal(Boolean(v))}
                />
              </Flex>
            </Flex>
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
              activeOnly={activeOnly}
              allow_individual_booking={allow_individual_booking}
              pageSizeOverride={!isLarge ? 12 : undefined}
              includeExternal={includeExternal} // 👈 new
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

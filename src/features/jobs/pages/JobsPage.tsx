import * as React from 'react'
import { Box, Card, Grid, Heading, Separator } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import JobsTable from '../components/JobsTable'
import JobInspector from '../components/JobInspector'

export default function JobsPage() {
  const { companyId } = useCompany()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

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

  if (!companyId) return <div>No company selected.</div>

  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      {/* 1/3 table (left), 2/3 inspector (right) from 1024px and up */}
      <Grid
        columns={{ initial: '1fr', lg: '1fr 2fr' }}
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
            <JobInspector id={selectedId} />
          </Box>
        </Card>
      </Grid>
    </section>
  )
}

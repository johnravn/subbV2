import * as React from 'react'
import { Box, Button, Card, Grid, Heading, Separator } from '@radix-ui/themes'
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

  // Responsive toggle for >= 1024px (large screens)
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

  if (!companyId) return <PageSkeleton columns="2fr 3fr" />

  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Grid
        columns={{ initial: '1fr', lg: '2fr 3fr' }}
        gap="4"
        align="stretch"
        style={{
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        {/* LEFT: Matters list */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: isLarge ? '100%' : undefined,
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
            <Button size="2" onClick={() => setCreateMatterOpen(true)}>
              <Plus /> New Matter
            </Button>
          </Box>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <MatterList selectedId={selectedId} onSelect={setSelectedId} />
          </Box>
        </Card>

        {/* RIGHT: Matter detail */}
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
            Detail
          </Heading>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
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

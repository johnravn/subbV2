import * as React from 'react'
import {
  Box,
  Card,
  Flex,
  Heading,
  Separator,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import CustomerTable from '../components/CustomerTable'
import CustomerInspector from '../components/CustomerInspector'

export default function CustomerPage() {
  const { companyId } = useCompany()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  // responsive (>= 1024px)
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isLarge ? '1fr 1fr' : '1fr', // 50/50 desktop
          gap: 'var(--space-4)',
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
            <Heading size="5">Customers</Heading>
          </Flex>
          <Separator size="4" mb="3" />
          <Box
            style={{
              flex: isLarge ? 1 : undefined,
              minHeight: isLarge ? 0 : undefined,
              overflowY: isLarge ? 'auto' : 'visible',
            }}
          >
            <CustomerTable
              selectedId={selectedId}
              onSelect={setSelectedId}
              showRegular={true}
              showPartner={true}
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
            <CustomerInspector
              id={selectedId}
              onDeleted={() => setSelectedId(null)}
            />
          </Box>
        </Card>
      </div>
    </section>
  )
}

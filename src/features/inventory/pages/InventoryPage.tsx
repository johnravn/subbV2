// src/features/inventory/pages/InventoryPage.tsx
import * as React from 'react'
import {
  Box,
  Card,
  Flex,
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
  const [activeOnly, setActiveOnly] = React.useState(true) // 👈 NEW
  const [individualOnly, setIndividualOnly] = React.useState(false) // 👈 NEW
  const { companyId } = useCompany()

  if (!companyId) return <div>No company selected.</div>

  return (
    <section>
      <Flex gap="4" wrap="wrap">
        <Box style={{ flex: '1 1 700px', minWidth: 420 }}>
          <Card size="3">
            <Flex align="center" justify="between" mb="3">
              <Heading size="5">Overview</Heading>
              <Flex align="center" gap={'2'}>
                <Flex align="center" gap={'1'}>
                  <Text size="2" color="gray">
                    Active only
                  </Text>
                  <Switch
                    checked={activeOnly}
                    onCheckedChange={(v) => setActiveOnly(Boolean(v))}
                  />
                </Flex>
                <Flex align="center" gap={'1'}>
                  <Text size="2" color="gray">
                    Individual only
                  </Text>
                  <Switch
                    checked={individualOnly}
                    onCheckedChange={(v) => setIndividualOnly(Boolean(v))}
                  />
                </Flex>
              </Flex>
            </Flex>
            <Separator size="4" mb="3" />
            <InventoryTable
              selectedId={selectedId}
              onSelect={setSelectedId}
              activeOnly={activeOnly}
              // individualOnly={individualOnly} TODOTODOTODOTODO
            />
          </Card>
        </Box>

        <Box style={{ flex: '0 1 500px', minWidth: 320 }}>
          <Card size="3">
            <Heading size="5" mb="3">
              Inspector
            </Heading>
            <Separator size="4" mb="3" />
            <InventoryInspector id={selectedId} />
          </Card>
        </Box>
      </Flex>
    </section>
  )
}

// src/features/inventory/pages/InventoryPage.tsx
import * as React from 'react'
import { Box, Card, Flex, Heading, Separator } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import InventoryTable from '../components/InventoryTable'
import InventoryInspector from '../components/InventoryInspector'
import AddItemDialog from '../components/AddItemDialog'
import EditCategoriesDialog from '../components/EditCategoriesDialog'
import EditBrandsDialog from '../components/EditBrandsDialog'

export default function InventoryPage() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [addItemOpen, setAddItemOpen] = React.useState(false)
  const [editCategoriesOpen, setEditCategoriesOpen] = React.useState(false)
  const [editBrandsOpen, setEditBrandsOpen] = React.useState(false)
  const { companyId } = useCompany()

  if (!companyId) return <div>No company selected.</div>

  return (
    <section>
      <Flex gap="4" wrap="wrap">
        <Box style={{ flex: '1 1 700px', minWidth: 420 }}>
          <Card size="3">
            <Flex align="center" justify="between" mb="3">
              <Heading size="5">Inventory</Heading>
              <Flex align="center" gap={'1'}>
                <EditCategoriesDialog
                  open={editCategoriesOpen}
                  onOpenChange={setEditCategoriesOpen}
                  companyId={companyId}
                />
                <EditBrandsDialog
                  open={editBrandsOpen}
                  onOpenChange={setEditBrandsOpen}
                  companyId={companyId}
                />
                <AddItemDialog
                  open={addItemOpen}
                  onOpenChange={setAddItemOpen}
                  companyId={companyId}
                />
              </Flex>
            </Flex>
            <Separator size="4" mb="3" />
            <InventoryTable selectedId={selectedId} onSelect={setSelectedId} />
          </Card>
        </Box>

        <Box style={{ flex: '0 1 360px', minWidth: 320 }}>
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

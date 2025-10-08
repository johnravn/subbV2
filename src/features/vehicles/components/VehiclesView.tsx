import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Flex, Spinner, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { vehiclesIndexQuery } from '../api/queries'
import VehiclesGrid from './VehiclesGrid'
import VehiclesList from './VehiclesList'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  includeExternal: boolean
  viewMode: 'grid' | 'list'
  search: string
  onSearch: (v: string) => void
}

export default function VehiclesView({
  selectedId,
  onSelect,
  includeExternal,
  viewMode,
  search,
  onSearch,
}: Props) {
  const { companyId } = useCompany()
  const [addOpen, setAddOpen] = React.useState(false)

  const {
    data = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '__none__',
      includeExternal,
      search,
    }),
    enabled: !!companyId,
  })

  return (
    <>
      <Flex gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search vehicles…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="right">
            {(isLoading || isFetching) && <Spinner />}
          </TextField.Slot>
        </TextField.Root>

        <Button variant="classic" onClick={() => setAddOpen(true)}>
          Add vehicle
        </Button>
      </Flex>

      {viewMode === 'grid' ? (
        <VehiclesGrid rows={data} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <VehiclesList rows={data} selectedId={selectedId} onSelect={onSelect} />
      )}

      <AddEditVehicleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSaved={() => {
          // rely on query invalidation inside the dialog
        }}
      />
    </>
  )
}

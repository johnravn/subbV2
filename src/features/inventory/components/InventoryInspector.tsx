// src/features/inventory/components/InventoryInspector.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Flex, Separator, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { inventoryDetailQuery } from '../api/queries'
import type { InventoryDetail } from '../api/queries'

export default function InventoryInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()

  const { data, isLoading } = useQuery({
    ...inventoryDetailQuery({
      companyId: companyId ?? '__none__',
      id: id ?? '__none__',
    }),
    enabled: !!companyId && !!id,
  })

  if (!id)
    return <Text color="gray">Select an item/bundle to view details.</Text>
  if (isLoading) return <Text>Loading…</Text>
  if (!data) return <Text color="red">Not found.</Text>

  const entry = data

  return (
    <Box>
      <Text as="div" size="3" weight="bold">
        {entry.name}
      </Text>
      <Text as="div" color="gray" size="2">
        {entry.type}
        {/* kind exists only on item detail; narrow by type */}
        {entry.type === 'item' && entry.kind ? ` · ${entry.kind}` : ''}
      </Text>

      <Separator my="3" />

      {entry.type === 'item' ? (
        <Box>
          <Text as="div" size="2">
            On hand: <b>{entry.on_hand ?? 0}</b>
          </Text>
          <Text as="div" size="2">
            Price:{' '}
            {entry.current_price != null
              ? `${entry.currency ?? 'NOK'} ${Number(entry.current_price).toFixed(2)}`
              : '-'}
          </Text>
        </Box>
      ) : null}

      {entry.type === 'bundle' ? (
        <Box>
          <Text size="2" color="gray">
            Bundle contents:
          </Text>
          <ul style={{ paddingLeft: 16, marginTop: 6 }}>
            {entry.units.map((u) => (
              <li key={u.unit_id}>
                <Text size="2">
                  {u.item_name ?? '—'} — S/N {u.serial_number ?? '—'}
                </Text>
              </li>
            ))}
          </ul>
        </Box>
      ) : null}

      <Separator my="3" />
      <Flex gap="2" wrap="wrap">
        <Button size="2" variant="soft">
          Edit
        </Button>
        <Button size="2" variant="soft">
          Reserve
        </Button>
      </Flex>
    </Box>
  )
}

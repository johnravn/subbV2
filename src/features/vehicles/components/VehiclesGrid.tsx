import * as React from 'react'
import { Badge, Card, Flex, Text } from '@radix-ui/themes'
import { Car } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import type { VehicleIndexRow } from '../api/queries'

export default function VehiclesGrid({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Array<VehicleIndexRow>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (!rows.length) {
    return (
      <Text color="gray" style={{ display: 'block', marginTop: 16 }}>
        No vehicles
      </Text>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
        marginTop: 16,
      }}
    >
      {rows.map((v) => (
        <VehicleCard
          key={v.id}
          v={v}
          active={v.id === selectedId}
          onClick={() => onSelect(v.id)}
        />
      ))}
    </div>
  )
}

function VehicleCard({
  v,
  active,
  onClick,
}: {
  v: VehicleIndexRow
  active: boolean
  onClick: () => void
}) {
  const imageUrl = React.useMemo(() => {
    if (!v.image_path) return null
    // Adjust bucket if needed
    const { data } = supabase.storage
      .from('vehicle_images')
      .getPublicUrl(v.image_path)
    return data.publicUrl
  }, [v.image_path])

  const fuelColor: React.ComponentProps<typeof Badge>['color'] =
    v.fuel === 'electric' ? 'green' : v.fuel === 'diesel' ? 'orange' : 'blue'

  return (
    <Card
      size="2"
      variant="surface"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: active
          ? '2px solid var(--accent-9)'
          : '1px solid var(--gray-5)',
      }}
    >
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--gray-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={v.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Car width={48} height={48} />
        )}
      </div>

      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">
          {v.name}
        </Text>
        <Text size="1" color="gray">
          {v.registration_no ?? '—'}
        </Text>
        <Flex align="center" gap="2" wrap="wrap" mt="1">
          <Badge variant="soft" color={fuelColor}>
            {v.fuel ?? '—'}
          </Badge>
          {v.internally_owned ? (
            <Badge variant="soft" color="indigo">
              Internal
            </Badge>
          ) : (
            <Badge variant="soft" color="violet">
              {v.external_owner_name ?? 'External'}
            </Badge>
          )}
        </Flex>
      </Flex>
    </Card>
  )
}

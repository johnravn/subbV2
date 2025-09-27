import { useQuery } from '@tanstack/react-query'
import { getItems } from '@features/vehicles/api/items'

export default function VehiclesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['items'],
    queryFn: getItems,
  })

  if (isLoading) return <>Loading…</>
  if (error) return <>Error loading items</>

  return (
    <ul>
      {data!.map((item) => (
        <li key={item.id}>
          {item.name} ({item.quantity})
        </li>
      ))}
    </ul>
  )
}

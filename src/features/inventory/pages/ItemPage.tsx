import { useParams } from '@tanstack/react-router'

export default function ItemPage() {
  const { itemId } = useParams({ from: '/inventory/$itemId' })
  return (
    <section>
      <h1 className="text-xl font-semibold">Item: {itemId}</h1>
      <p>Show item detail for {itemId}…</p>
    </section>
  )
}

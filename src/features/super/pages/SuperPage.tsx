import { Text } from '@radix-ui/themes'
import MapEmbed from '@shared/maps/MapEmbed'

export default function SuperPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Super</h1>
      <p>Super and stuff</p>
      <MapEmbed query="Per spelemanns vei 3, ålgård" zoom={15} />
    </section>
  )
}

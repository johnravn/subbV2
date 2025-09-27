import { Card } from '@radix-ui/themes'
import InventoryTable from '../components/InventoryTable'

export default function InventoryPage() {
  return (
    <section>
      <Card>
        <InventoryTable />
      </Card>
    </section>
  )
}

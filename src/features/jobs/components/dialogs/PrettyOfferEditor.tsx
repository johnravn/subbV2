// src/features/jobs/components/dialogs/PrettyOfferEditor.tsx
import { Dialog, Flex, Heading } from '@radix-ui/themes'
import { Tools, WarningTriangle } from 'iconoir-react'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null
  onSaved?: (offerId: string) => void
}

export default function PrettyOfferEditor({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Flex direction="column" align="center" gap="3" p="6">
          <Tools width={40} height={40} />
          <Heading size="4">In construction</Heading>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

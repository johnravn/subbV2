// src/features/jobs/components/dialogs/ConfirmStatusChangeDialog.tsx
import * as React from 'react'
import {
  Button,
  Dialog,
  Flex,
  Text,
} from '@radix-ui/themes'
import type { CrewReqStatus } from '../../types'

export default function ConfirmStatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  newStatus,
  crewName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentStatus: CrewReqStatus
  newStatus: CrewReqStatus
  crewName: string
  onConfirm: () => void
}) {
  const statusLabels: Record<CrewReqStatus, string> = {
    planned: 'Planned',
    requested: 'Requested',
    accepted: 'Accepted',
    declined: 'Declined',
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 400 }}>
        <Dialog.Title>Confirm Status Change</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to change {crewName}'s status from{' '}
          <strong>{statusLabels[currentStatus]}</strong> to{' '}
          <strong>{statusLabels[newStatus]}</strong>?
        </Dialog.Description>

        <Flex mt="4" gap="2" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            color={newStatus === 'declined' ? 'red' : undefined}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Confirm
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}


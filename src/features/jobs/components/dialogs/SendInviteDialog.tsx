import * as React from 'react'
import { Box, Button, Dialog, Flex, TextArea } from '@radix-ui/themes'
import { Check, Sparks } from 'iconoir-react'

export default function SendInviteDialog({
  open,
  onOpenChange,
  crewName,
  jobTitle,
  roleTitle,
  onSend,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  crewName: string
  jobTitle: string
  roleTitle: string
  onSend: (message: string | null) => void
  isPending?: boolean
}) {
  const [message, setMessage] = React.useState('')
  const [useGeneric, setUseGeneric] = React.useState(true)

  React.useEffect(() => {
    if (!open) {
      setMessage('')
      setUseGeneric(true)
    }
  }, [open])

  const generateGenericMessage = () => {
    const greeting = crewName.includes('crew members')
      ? 'Hi all'
      : `Hi ${crewName}`
    return `${greeting},\n\nYou have been invited to work on "${jobTitle}" as ${roleTitle}. Please review the details and let us know if you can accept this invitation.\n\nLooking forward to working with you!`
  }

  const handleUseGeneric = () => {
    setUseGeneric(true)
    setMessage(generateGenericMessage())
  }

  const handleUseCustom = () => {
    setUseGeneric(false)
    if (!message.trim()) {
      setMessage('')
    }
  }

  const handleSend = () => {
    if (useGeneric || message.trim()) {
      onSend(useGeneric ? generateGenericMessage() : message.trim() || null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 600 }}>
        <Dialog.Title>Send Invitation</Dialog.Title>
        <Dialog.Description>
          Add a personal message{' '}
          {crewName.includes('crew members')
            ? 'to all crew members'
            : `to ${crewName}`}{' '}
          (optional)
        </Dialog.Description>

        <Box my="4">
          <Flex gap="2" mb="3">
            <Button
              variant={useGeneric ? 'soft' : 'outline'}
              onClick={handleUseGeneric}
              style={{ flex: 1 }}
            >
              <Sparks width={16} height={16} /> Use generic message
            </Button>
            <Button
              variant={!useGeneric ? 'soft' : 'outline'}
              onClick={handleUseCustom}
              style={{ flex: 1 }}
            >
              Write custom message
            </Button>
          </Flex>

          <TextArea
            placeholder={
              useGeneric
                ? 'Generic message will be generated...'
                : 'Write your personal message here...'
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={handleUseCustom}
            rows={6}
            disabled={useGeneric}
            style={{ minHeight: 120 }}
          />
        </Box>

        <Flex gap="2" justify="end">
          <Dialog.Close>
            <Button variant="soft" disabled={isPending}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button onClick={handleSend} disabled={isPending}>
            <Check width={16} height={16} />{' '}
            {isPending ? 'Sending...' : 'Send invitation'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

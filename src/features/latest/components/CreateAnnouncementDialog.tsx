// src/features/latest/components/CreateAnnouncementDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { createAnnouncement } from '../api/queries'

export default function CreateAnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [title, setTitle] = React.useState('')
  const [message, setMessage] = React.useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return createAnnouncement({
        companyId,
        title,
        message,
      })
    },
    onSuccess: async () => {
      setTitle('')
      setMessage('')
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-feed'],
        exact: false,
      })
      success(
        'Announcement posted',
        'Your announcement has been added to the feed.',
      )
      onOpenChange(false)
    },
    onError: (err: any) => {
      toastError('Failed to create announcement', err.message)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Create Announcement</Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              Title
            </Text>
            <TextField.Root
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Flex>

          <Flex direction="column" gap="1">
            <Text as="label" size="2" weight="medium">
              Message
            </Text>
            <TextArea
              placeholder="Write your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              style={{ resize: 'vertical' }}
            />
          </Flex>
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || !message.trim() || mutation.isPending}
            variant="classic"
          >
            {mutation.isPending ? 'Posting…' : 'Post Announcement'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Tabs,
  Text,
  TextArea,
} from '@radix-ui/themes'
import { Check, Download, Edit, Send, Trash, Xmark } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { useAuth } from '@app/providers/AuthProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  deleteMatter,
  markMatterAsViewed,
  matterDetailQuery,
  matterFilesQuery,
  matterMessagesQuery,
  matterRecipientsQuery,
  matterResponsesQuery,
  respondToMatter,
  sendMessage,
} from '../api/queries'

export default function MatterDetail({
  matterId,
  onDeleted,
}: {
  matterId: string
  onDeleted?: () => void
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const { user } = useAuth()
  const { companyId } = useCompany()
  const [newMessage, setNewMessage] = React.useState('')
  const [isEditingResponse, setIsEditingResponse] = React.useState(false)

  const { data: matter } = useQuery({
    ...matterDetailQuery(matterId),
  })

  const { data: recipients = [] } = useQuery({
    ...matterRecipientsQuery(matterId),
  })

  const { data: responses = [] } = useQuery({
    ...matterResponsesQuery(matterId),
  })

  const { data: messages = [] } = useQuery({
    ...matterMessagesQuery(matterId),
  })

  const { data: files } = useQuery({
    ...matterFilesQuery(matterId),
  })
  const matterFiles = files || []

  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const deleteMut = useMutation({
    mutationFn: async () => {
      await deleteMatter(matterId)
    },
    onSuccess: async () => {
      // Invalidate all matters queries to ensure the table refreshes
      await qc.invalidateQueries({ queryKey: ['matters'] })
      // Specifically invalidate the index query if we have companyId
      if (companyId) {
        await qc.invalidateQueries({
          queryKey: ['matters', 'index', companyId],
        })
      }
      success('Matter deleted', 'The matter has been deleted.')
      setDeleteOpen(false)
      onDeleted?.()
    },
    onError: (e: any) => {
      toastError('Failed to delete matter', e?.message || 'Please try again.')
    },
  })

  // Calculate recipient summary (must be at component level, not in JSX)
  const recipientSummary = React.useMemo(() => {
    const totalRecipients = recipients.length
    const respondedCount = recipients.filter((r) => !!r.response).length
    const viewedCount = recipients.filter((r) => r.viewed_at).length
    const pendingCount = totalRecipients - respondedCount
    const allResponded =
      respondedCount === totalRecipients && totalRecipients > 0

    return {
      totalRecipients,
      respondedCount,
      viewedCount,
      pendingCount,
      allResponded,
    }
  }, [recipients])

  // Mark as viewed when component mounts
  React.useEffect(() => {
    if (matter) {
      markMatterAsViewed(matterId)
        .then(() => {
          // Invalidate unread count and matters list when viewing a matter
          qc.invalidateQueries({ queryKey: ['matters', 'unread-count'] })
          qc.invalidateQueries({ queryKey: ['matters', 'index'] })
        })
        .catch(console.error)
    }
  }, [matterId, matter, qc])

  const respond = useMutation({
    mutationFn: async (response: string) => {
      await respondToMatter(matterId, response)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matters', 'detail', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'responses', matterId] })
      qc.invalidateQueries({ queryKey: ['matters', 'recipients', matterId] })
      success('Success', 'Response recorded')
      setIsEditingResponse(false)
    },
    onError: (e: any) => {
      toastError('Failed', e?.message || 'Could not record response')
    },
  })

  const send = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim()) {
        throw new Error('Message cannot be empty')
      }
      await sendMessage(matterId, newMessage)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matters', 'messages', matterId] })
      setNewMessage('')
    },
    onError: (e: any) => {
      toastError('Failed', e?.message || 'Could not send message')
    },
  })

  if (!matter) {
    return (
      <Box p="4">
        <Text color="gray">Loading matter...</Text>
      </Box>
    )
  }

  const getTypeBadge = () => {
    const variants: Record<string, { color: string; label: string }> = {
      crew_invite: { color: 'blue', label: 'Crew Invitation' },
      vote: { color: 'purple', label: 'Vote' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat' },
    }
    const v = variants[matter.matter_type] ?? variants.announcement
    return (
      <Badge radius="full" color={v.color as any} size="2">
        {v.label}
      </Badge>
    )
  }

  const isCreator = user?.id === matter.created_by_user_id

  return (
    <Box>
      <Box mb="4">
        <Flex align="center" gap="2" mb="2" justify="between">
          <Flex align="center" gap="2">
            {getTypeBadge()}
            <Heading size="5">{matter.title}</Heading>
          </Flex>
          {isCreator && (
            <Button
              size="2"
              variant="soft"
              color="red"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash width={16} height={16} /> Delete
            </Button>
          )}
        </Flex>
        {matter.created_by && (
          <Text size="2" color="gray">
            Created by{' '}
            {matter.created_by.display_name || matter.created_by.email} on{' '}
            {new Date(matter.created_at).toLocaleDateString()}
          </Text>
        )}
        {matter.job && (
          <Text size="2" color="gray" style={{ display: 'block' }}>
            Related to job: {matter.job.title}
          </Text>
        )}
      </Box>

      {matter.content && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Text>{matter.content}</Text>
        </Box>
      )}

      {matterFiles.length > 0 && (
        <Box mb="4">
          <Separator size="4" mb="3" />
          <Heading size="4" mb="2">
            Attachments
          </Heading>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matterFiles.map((file) => (
              <Flex
                key={file.id}
                align="center"
                justify="between"
                p="2"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 6,
                  background: 'var(--gray-a2)',
                }}
              >
                <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
                  <Text size="2" truncate>
                    {file.filename}
                  </Text>
                  {file.size_bytes && (
                    <Text size="1" color="gray">
                      ({(file.size_bytes / 1024).toFixed(1)} KB)
                    </Text>
                  )}
                </Flex>
                <Button
                  size="1"
                  variant="soft"
                  onClick={async () => {
                    const { data } = await supabase.storage
                      .from('matter_files')
                      .download(file.path)

                    if (data && file.filename) {
                      const url = window.URL.createObjectURL(data)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = file.filename
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    }
                  }}
                >
                  <Download width={14} height={14} /> Download
                </Button>
              </Flex>
            ))}
          </Box>
        </Box>
      )}

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>Delete Matter</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete this matter? This action cannot be
            undone.
          </Dialog.Description>
          <Flex mt="4" gap="2" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Yes, delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Tabs.Root
        defaultValue={
          matter.matter_type === 'vote'
            ? 'responses'
            : matter.matter_type === 'announcement'
              ? user?.id === matter.created_by_user_id
                ? 'recipients'
                : undefined
              : 'chat'
        }
      >
        <Tabs.List>
          {matter.matter_type === 'vote' && (
            <Tabs.Trigger value="responses">
              Responses ({responses.length})
            </Tabs.Trigger>
          )}
          {matter.matter_type !== 'announcement' && (
            <Tabs.Trigger value="chat">Chat ({messages.length})</Tabs.Trigger>
          )}
          {(matter.matter_type !== 'announcement' ||
            user?.id === matter.created_by_user_id) && (
            <Tabs.Trigger value="recipients">Recipients</Tabs.Trigger>
          )}
        </Tabs.List>

        <Box mt="3">
          {(matter.matter_type !== 'announcement' ||
            user?.id === matter.created_by_user_id) && (
            <Tabs.Content value="recipients">
              {/* Summary message */}
              <Box
                mb="4"
                p="3"
                style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
              >
                {recipientSummary.allResponded ? (
                  <Text size="3" weight="medium" color="green">
                    ✓ All recipients have responded
                  </Text>
                ) : (
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="medium">
                      {recipientSummary.pendingCount} of{' '}
                      {recipientSummary.totalRecipients} recipient
                      {recipientSummary.pendingCount !== 1 ? 's' : ''}{' '}
                      {recipientSummary.pendingCount === 1 ? 'has' : 'have'} not
                      responded
                    </Text>
                    <Text size="2" color="gray">
                      {recipientSummary.viewedCount} of{' '}
                      {recipientSummary.totalRecipients} viewed
                    </Text>
                  </Flex>
                )}
              </Box>

              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Viewed</Table.ColumnHeaderCell>
                    {matter.matter_type === 'vote' && (
                      <Table.ColumnHeaderCell>Responded</Table.ColumnHeaderCell>
                    )}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {recipients.map((r) => {
                    const isViewed = !!r.viewed_at

                    // Determine viewed badge color
                    const viewedColor = isViewed ? 'green' : 'orange'

                    return (
                      <Table.Row key={r.id}>
                        <Table.Cell>
                          {r.user?.display_name || r.user?.email || 'Unknown'}
                        </Table.Cell>
                        <Table.Cell>
                          {isViewed ? (
                            <Badge radius="full" size="1" color={viewedColor}>
                              Viewed
                            </Badge>
                          ) : (
                            <Badge radius="full" size="1" color="orange">
                              Pending
                            </Badge>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {matter.matter_type === 'vote' && (
                            <>
                              {r.response ? (
                                <Badge
                                  radius="full"
                                  size="1"
                                  color={
                                    r.response.response.toLowerCase() ===
                                    'approved'
                                      ? 'green'
                                      : r.response.response.toLowerCase() ===
                                          'rejected'
                                        ? 'red'
                                        : 'blue'
                                  }
                                >
                                  {r.response.response.toLowerCase() ===
                                  'approved'
                                    ? 'Approved'
                                    : r.response.response.toLowerCase() ===
                                        'rejected'
                                      ? 'Rejected'
                                      : r.response.response}
                                </Badge>
                              ) : (
                                <Badge radius="full" size="1" color="orange">
                                  Pending
                                </Badge>
                              )}
                            </>
                          )}
                          {matter.matter_type !== 'vote' && (
                            <Text size="2" color="gray">
                              —
                            </Text>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Tabs.Content>
          )}

          {matter.matter_type === 'vote' && (
            <Tabs.Content value="responses">
              {/* Vote summary counters */}
              {responses.length > 0 && (
                <Box
                  mb="4"
                  p="3"
                  style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
                >
                  <Flex align="center" gap="4">
                    <Flex align="center" gap="2">
                      <Badge radius="full" color="green">
                        <Check width={14} height={14} />
                      </Badge>
                      <Text weight="medium">
                        {
                          responses.filter(
                            (r) => r.response.toLowerCase() === 'approved',
                          ).length
                        }{' '}
                        For
                      </Text>
                    </Flex>
                    <Flex align="center" gap="2">
                      <Badge radius="full" color="red">
                        <Xmark width={14} height={14} />
                      </Badge>
                      <Text weight="medium">
                        {
                          responses.filter(
                            (r) => r.response.toLowerCase() === 'rejected',
                          ).length
                        }{' '}
                        Against
                      </Text>
                    </Flex>
                  </Flex>
                </Box>
              )}

              <Box mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Heading size="4">Your Response</Heading>
                  {matter.my_response && !isEditingResponse && (
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => {
                        setIsEditingResponse(true)
                      }}
                    >
                      <Edit width={14} height={14} /> Edit
                    </Button>
                  )}
                </Flex>
                {matter.my_response && !isEditingResponse ? (
                  <Box
                    p="3"
                    style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
                  >
                    <Flex align="center" gap="2" mb="2">
                      {matter.my_response.response.toLowerCase() ===
                        'approved' && (
                        <Badge radius="full" color="green">
                          <Check width={12} height={12} /> Approved
                        </Badge>
                      )}
                      {matter.my_response.response.toLowerCase() ===
                        'rejected' && (
                        <Badge radius="full" color="red">
                          <Xmark width={12} height={12} /> Rejected
                        </Badge>
                      )}
                    </Flex>
                    <Text
                      size="1"
                      color="gray"
                      style={{ display: 'block', marginTop: 8 }}
                    >
                      Last updated:{' '}
                      {new Date(matter.my_response.updated_at).toLocaleString()}
                    </Text>
                  </Box>
                ) : (
                  <Box>
                    <Flex gap="2">
                      <Button
                        variant="soft"
                        color="green"
                        onClick={() => respond.mutate('approved')}
                        disabled={respond.isPending}
                      >
                        <Check /> Approve
                      </Button>
                      <Button
                        variant="soft"
                        color="red"
                        onClick={() => respond.mutate('rejected')}
                        disabled={respond.isPending}
                      >
                        <Xmark /> Reject
                      </Button>
                    </Flex>
                  </Box>
                )}
              </Box>

              <Separator size="4" mb="3" />

              <Heading size="4" mb="3">
                All Responses ({responses.length})
              </Heading>
              {responses.length === 0 ? (
                <Text color="gray">No responses yet</Text>
              ) : (
                <Box
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {responses.map((r) => {
                    const isApproved = r.response.toLowerCase() === 'approved'
                    const isRejected = r.response.toLowerCase() === 'rejected'
                    const showName =
                      !matter.is_anonymous ||
                      r.user_id === matter.created_by_user_id

                    return (
                      <Box
                        key={r.id}
                        p="3"
                        style={{
                          border: '1px solid var(--gray-a6)',
                          borderRadius: 8,
                          background: 'var(--gray-a2)',
                        }}
                      >
                        <Flex align="center" gap="2" mb="2">
                          {isApproved && (
                            <Badge radius="full" color="green">
                              <Check width={12} height={12} /> Approved
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge radius="full" color="red">
                              <Xmark width={12} height={12} /> Rejected
                            </Badge>
                          )}
                          <Text weight="medium">
                            {showName
                              ? r.user?.display_name ||
                                r.user?.email ||
                                'Unknown'
                              : 'Anonymous'}
                          </Text>
                          <Text size="1" color="gray">
                            {new Date(r.created_at).toLocaleString()}
                          </Text>
                        </Flex>
                        {!isApproved && !isRejected && (
                          <Text>{r.response}</Text>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Tabs.Content>
          )}

          <Tabs.Content value="chat">
            <Box
              mb="4"
              style={{
                maxHeight: 400,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 12,
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                background: 'var(--gray-a1)',
              }}
            >
              {messages.length === 0 ? (
                <Text color="gray" style={{ textAlign: 'center' }}>
                  No messages yet. Start the conversation!
                </Text>
              ) : (
                messages.map((msg) => {
                  const isMyMessage = msg.user_id === user?.id
                  return (
                    <Box
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                        width: '100%',
                      }}
                    >
                      <Box
                        p="2"
                        style={{
                          background: isMyMessage
                            ? 'var(--blue-a3)'
                            : 'var(--gray-a2)',
                          borderRadius: 6,
                          maxWidth: '80%',
                        }}
                      >
                        {!isMyMessage && (
                          <Text
                            size="1"
                            weight="medium"
                            color="gray"
                            style={{ display: 'block', marginBottom: 4 }}
                          >
                            {msg.user?.display_name ||
                              msg.user?.email ||
                              'Unknown'}
                          </Text>
                        )}
                        <Text>{msg.content}</Text>
                        <Text
                          size="1"
                          color="gray"
                          style={{ display: 'block', marginTop: 4 }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </Text>
                      </Box>
                    </Box>
                  )
                })
              )}
            </Box>

            <Flex gap="2">
              <TextArea
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    send.mutate()
                  }
                }}
                rows={2}
                style={{ flex: 1 }}
              />
              <Button
                onClick={() => send.mutate()}
                disabled={!newMessage.trim() || send.isPending}
              >
                <Send width={16} height={16} /> Send
              </Button>
            </Flex>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}

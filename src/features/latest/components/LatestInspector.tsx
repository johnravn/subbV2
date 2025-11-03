// src/features/latest/components/LatestInspector.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Flex,
  Heading,
  Separator,
  Tabs,
  Text,
  TextArea,
} from '@radix-ui/themes'
import { Heart, HeartSolid } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { formatDistanceToNow } from 'date-fns'
import {
  createActivityComment,
  deleteActivityComment,
  latestInspectorQuery,
  toggleActivityLike,
} from '../api/queries'
import type { ActivityFeedItem } from '../types'

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

function formatActivityDescription(activity: ActivityFeedItem): string {
  const metadata = activity.metadata

  switch (activity.activity_type) {
    case 'inventory_item_created':
      return `Added item "${metadata.item_name || 'Unknown'}" to inventory`
    case 'inventory_item_deleted':
      return `Removed item "${metadata.item_name || 'Unknown'}" from inventory`
    case 'inventory_group_created':
      return `Created inventory group "${metadata.group_name || 'Unknown'}"`
    case 'inventory_group_deleted':
      return `Removed inventory group "${metadata.group_name || 'Unknown'}"`
    case 'vehicle_added':
      return `Added vehicle "${metadata.vehicle_name || metadata.license_plate || 'Unknown'}"`
    case 'vehicle_removed':
      return `Removed vehicle "${metadata.vehicle_name || metadata.license_plate || 'Unknown'}"`
    case 'customer_added':
      return `Added customer "${metadata.customer_name || 'Unknown'}"`
    case 'customer_removed':
      return `Removed customer "${metadata.customer_name || 'Unknown'}"`
    case 'crew_added':
      return `Added crew member "${metadata.user_name || metadata.email || 'Unknown'}"`
    case 'crew_removed':
      return `Removed crew member "${metadata.user_name || metadata.email || 'Unknown'}"`
    case 'job_created':
      return `Created job "${metadata.job_title || activity.title || 'Unknown'}"`
    case 'job_deleted':
      return `Deleted job "${metadata.job_title || activity.title || 'Unknown'}"`
    case 'announcement':
      return activity.title || 'Announcement'
    default:
      return activity.title || activity.description || 'Activity'
  }
}

export default function LatestInspector({
  activityId,
}: {
  activityId: string | null
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [commentText, setCommentText] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'details' | 'comments'>(
    'details',
  )

  // Get current user ID for comment deletion (always call this hook)
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })
  const currentUserId = authUser?.id

  const enabled = Boolean(companyId && activityId)

  const { data, isLoading, isError, error } = useQuery({
    ...latestInspectorQuery({
      companyId: companyId ?? '',
      activityId: activityId ?? '',
    }),
    enabled,
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !activityId) throw new Error('Missing ids')
      return toggleActivityLike({ companyId, activityId })
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-inspector', activityId],
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
    },
  })

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!companyId || !activityId) throw new Error('Missing ids')
      return createActivityComment({ companyId, activityId, content })
    },
    onSuccess: async () => {
      setCommentText('')
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-inspector', activityId],
      })
      success('Comment added', 'Your comment was posted successfully.')
    },
    onError: (err: any) => {
      toastError('Failed to add comment', err.message)
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: deleteActivityComment,
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'latest-inspector', activityId],
      })
      success('Comment deleted', 'The comment was removed successfully.')
    },
  })

  if (!activityId) {
    return (
      <Text color="gray" size="2">
        Select an activity to view details
      </Text>
    )
  }

  if (isLoading) {
    return <InspectorSkeleton />
  }

  if (isError) {
    return (
      <Text color="red" size="2">
        Failed to load activity.{' '}
        <Text as="span" style={{ fontFamily: 'monospace' }}>
          {(error as any)?.message || 'Unknown error'}
        </Text>
      </Text>
    )
  }

  if (!data) {
    return (
      <Text color="gray" size="2">
        Activity not found
      </Text>
    )
  }

  const { activity, comments } = data

  // Calculate avatar URL without using hooks
  const authorAvatarUrl = activity.created_by.avatar_url
    ? supabase.storage
        .from('avatars')
        .getPublicUrl(activity.created_by.avatar_url).data.publicUrl
    : null

  const authorDisplayName =
    activity.created_by.display_name || activity.created_by.email
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
  })

  return (
    <Box>
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
      >
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="comments">
            Comments ({comments.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="details">
            {/* Header with author info */}
            <Flex align="center" gap="3" mb="4">
              <Avatar
                size="3"
                radius="full"
                src={authorAvatarUrl ?? undefined}
                fallback={getInitials(
                  activity.created_by.display_name,
                  activity.created_by.email,
                )}
              />
              <Box style={{ flex: 1 }}>
                <Text size="3" weight="medium">
                  {authorDisplayName}
                </Text>
                <Text size="1" color="gray">
                  {timeAgo}
                </Text>
              </Box>
            </Flex>

            <Separator size="4" mb="4" />

            {/* Activity content */}
            <Box mb="4">
              <Heading size="4" mb="2">
                {formatActivityDescription(activity)}
              </Heading>

              {activity.description && (
                <Box
                  p="3"
                  style={{
                    backgroundColor: 'var(--gray-2)',
                    borderRadius: 'var(--radius-2)',
                  }}
                  mt="3"
                >
                  <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                    {activity.description}
                  </Text>
                </Box>
              )}
            </Box>

            <Separator size="4" mb="4" />

            {/* Like button */}
            <Flex align="center" justify="between">
              <Button
                variant={activity.user_liked ? 'solid' : 'soft'}
                color={activity.user_liked ? 'red' : 'gray'}
                size="2"
                onClick={() => likeMutation.mutate()}
                disabled={likeMutation.isPending}
              >
                {activity.user_liked ? (
                  <HeartSolid width={16} height={16} />
                ) : (
                  <Heart width={16} height={16} />
                )}
                <Text ml="1">
                  {activity.like_count > 0 ? activity.like_count : 'Like'}
                </Text>
              </Button>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="comments">
            {/* Comment form */}
            <Box mb="4">
              <TextArea
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
                mb="2"
              />
              <Flex justify="end">
                <Button
                  size="2"
                  onClick={() => {
                    if (commentText.trim()) {
                      commentMutation.mutate(commentText.trim())
                    }
                  }}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  Post
                </Button>
              </Flex>
            </Box>

            <Separator size="4" mb="4" />

            {/* Comments list */}
            {comments.length === 0 ? (
              <Box py="6">
                <Text color="gray" size="2" align="center">
                  No comments yet
                </Text>
              </Box>
            ) : (
              <Box>
                {comments.map((comment, idx) => {
                  // Calculate avatar URL without using hooks
                  const commentAuthorAvatarUrl = comment.created_by.avatar_url
                    ? supabase.storage
                        .from('avatars')
                        .getPublicUrl(comment.created_by.avatar_url).data
                        .publicUrl
                    : null

                  const commentAuthorDisplayName =
                    comment.created_by.display_name || comment.created_by.email
                  const commentTimeAgo = formatDistanceToNow(
                    new Date(comment.created_at),
                    { addSuffix: true },
                  )

                  const isOwner = comment.created_by.user_id === currentUserId

                  return (
                    <React.Fragment key={comment.id}>
                      <Flex gap="3" align="start" mb="3">
                        <Avatar
                          size="2"
                          radius="full"
                          src={commentAuthorAvatarUrl ?? undefined}
                          fallback={getInitials(
                            comment.created_by.display_name,
                            comment.created_by.email,
                          )}
                        />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Flex align="center" gap="2" mb="1">
                            <Text size="2" weight="medium">
                              {commentAuthorDisplayName}
                            </Text>
                            <Text size="1" color="gray">
                              {commentTimeAgo}
                            </Text>
                            {isOwner && (
                              <Button
                                size="1"
                                variant="ghost"
                                color="red"
                                onClick={() => {
                                  deleteCommentMutation.mutate({
                                    commentId: comment.id,
                                  })
                                }}
                                disabled={deleteCommentMutation.isPending}
                              >
                                Delete
                              </Button>
                            )}
                          </Flex>
                          <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                            {comment.content}
                          </Text>
                        </Box>
                      </Flex>
                      {idx < comments.length - 1 && <Separator my="2" />}
                    </React.Fragment>
                  )
                })}
              </Box>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}

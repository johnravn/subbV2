// src/features/latest/components/LatestFeed.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Flex, Separator, Spinner, Text } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { formatDistanceToNow } from 'date-fns'
import { latestFeedQuery } from '../api/queries'
import type { ActivityFeedItem, ActivityType } from '../types'

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
      return activity.title || activity.description || 'Announcement'
    default:
      return activity.title || activity.description || 'Activity'
  }
}

function getActivityIcon(activityType: ActivityType): string {
  switch (activityType) {
    case 'inventory_item_created':
    case 'inventory_item_deleted':
    case 'inventory_group_created':
    case 'inventory_group_deleted':
      return '📦'
    case 'vehicle_added':
    case 'vehicle_removed':
      return '🚗'
    case 'customer_added':
    case 'customer_removed':
      return '👤'
    case 'crew_added':
    case 'crew_removed':
      return '👷'
    case 'job_created':
    case 'job_deleted':
      return '📋'
    case 'announcement':
      return '📢'
    default:
      return '📌'
  }
}

export default function LatestFeed({
  selectedId,
  onSelect,
  activityTypes,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  activityTypes?: Array<ActivityType>
}) {
  const { companyId } = useCompany()

  const { data, isLoading, isError } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      activityTypes,
      limit: 100,
    }),
    enabled: !!companyId,
  })

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <Text color="red" size="2">
        Failed to load feed
      </Text>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <Box py="6">
        <Text color="gray" size="2" align="center">
          No activity yet
        </Text>
      </Box>
    )
  }

  return (
    <Box>
      {data.items.map((activity, idx) => {
        // Calculate avatar URL without using hooks
        const avatarUrl = activity.created_by.avatar_url
          ? supabase.storage
              .from('avatars')
              .getPublicUrl(activity.created_by.avatar_url).data.publicUrl
          : null

        const displayName =
          activity.created_by.display_name || activity.created_by.email
        const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
          addSuffix: true,
        })

        return (
          <React.Fragment key={activity.id}>
            <Box
              style={{
                cursor: 'pointer',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-3)',
                backgroundColor:
                  selectedId === activity.id
                    ? 'var(--accent-3)'
                    : 'transparent',
              }}
              onClick={() => onSelect(activity.id)}
              onMouseEnter={(e) => {
                if (selectedId !== activity.id) {
                  e.currentTarget.style.backgroundColor = 'var(--gray-2)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== activity.id) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <Flex gap="3" align="start">
                <Flex
                  align="center"
                  justify="center"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-2)',
                    backgroundColor: 'var(--accent-3)',
                    flexShrink: 0,
                  }}
                >
                  <Text size="4">
                    {getActivityIcon(activity.activity_type)}
                  </Text>
                </Flex>

                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap="2" mb="1">
                    <Avatar
                      size="1"
                      radius="full"
                      src={avatarUrl ?? undefined}
                      fallback={getInitials(
                        activity.created_by.display_name,
                        activity.created_by.email,
                      )}
                    />
                    <Text size="2" weight="medium">
                      {displayName}
                    </Text>
                    <Text size="1" color="gray">
                      {timeAgo}
                    </Text>
                  </Flex>

                  <Text size="2" style={{ lineHeight: 1.5 }}>
                    {formatActivityDescription(activity)}
                  </Text>

                  {activity.description &&
                    activity.activity_type === 'announcement' && (
                      <Box
                        mt="2"
                        p="2"
                        style={{
                          backgroundColor: 'var(--gray-2)',
                          borderRadius: 'var(--radius-2)',
                        }}
                      >
                        <Text size="2">{activity.description}</Text>
                      </Box>
                    )}

                  <Flex align="center" gap="3" mt="2">
                    {activity.like_count > 0 && (
                      <Text size="1" color="gray">
                        ❤️ {activity.like_count}
                      </Text>
                    )}
                    {activity.comment_count > 0 && (
                      <Text size="1" color="gray">
                        💬 {activity.comment_count}
                      </Text>
                    )}
                  </Flex>
                </Box>
              </Flex>
            </Box>

            {idx < data.items.length - 1 && <Separator my="2" />}
          </React.Fragment>
        )
      })}
    </Box>
  )
}

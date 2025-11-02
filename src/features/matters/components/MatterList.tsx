import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Search } from 'iconoir-react'
import { mattersIndexQuery } from '../api/queries'
import type { Matter, MatterType } from '../types'

export default function MatterList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { companyId } = useCompany()
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<MatterType | 'all'>('all')

  const { data: allMatters = [], isLoading, isFetching } = useQuery({
    ...mattersIndexQuery(companyId || ''),
    enabled: !!companyId,
  })

  // Filter matters client-side
  const matters = React.useMemo(() => {
    let filtered = allMatters

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.trim().toLowerCase()
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(searchLower) ||
          m.content?.toLowerCase().includes(searchLower) ||
          m.job?.title.toLowerCase().includes(searchLower) ||
          m.created_by?.display_name?.toLowerCase().includes(searchLower) ||
          m.created_by?.email.toLowerCase().includes(searchLower),
      )
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((m) => m.matter_type === typeFilter)
    }

    return filtered
  }, [allMatters, search, typeFilter])

  const getTypeBadge = (type: Matter['matter_type']) => {
    const variants: Record<string, { color: string; label: string }> = {
      crew_invite: { color: 'blue', label: 'Invite' },
      vote: { color: 'purple', label: 'Vote' },
      announcement: { color: 'gray', label: 'Announcement' },
      chat: { color: 'green', label: 'Chat' },
    }
    const v = variants[type] ?? variants.announcement
    return (
      <Badge radius="full" color={v.color as any}>
        {v.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <Box p="4">
        <Text color="gray">Loading matters...</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Flex gap="2" align="center" wrap="wrap" mb="3">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search matters…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner size="2" />}
          </TextField.Slot>
        </TextField.Root>

        <Select.Root
          value={typeFilter}
          size="3"
          onValueChange={(val) => setTypeFilter(val as MatterType | 'all')}
        >
          <Select.Trigger
            placeholder="Filter type…"
            style={{ minHeight: 'var(--space-7)' }}
          />
          <Select.Content>
            <Select.Item value="all">All Types</Select.Item>
            <Select.Item value="vote">Vote</Select.Item>
            <Select.Item value="announcement">Announcement</Select.Item>
            <Select.Item value="chat">Chat</Select.Item>
            <Select.Item value="crew_invite">Crew Invite</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {matters.length === 0 ? (
        <Box p="4">
          <Text color="gray">
            {allMatters.length === 0
              ? 'No matters yet'
              : 'No matters match your filters'}
          </Text>
        </Box>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {matters.map((matter) => {
              const isSelected = matter.id === selectedId
              return (
                <Table.Row
                  key={matter.id}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--blue-a2)' : undefined,
                  }}
                  onClick={() => onSelect(matter.id)}
                >
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      {getTypeBadge(matter.matter_type)}
                      {matter.is_unread && (
                        <Box
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--blue-9)',
                          }}
                        />
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Flex align="center" gap="2">
                        <Text
                          weight={
                            isSelected
                              ? 'bold'
                              : matter.is_unread
                                ? 'bold'
                                : 'medium'
                          }
                        >
                          {matter.title}
                        </Text>
                        {matter.is_unread && (
                          <Badge radius="full" size="1" color="blue">
                            New
                          </Badge>
                        )}
                      </Flex>
                      {matter.job && (
                        <Text size="1" color="gray" style={{ display: 'block' }}>
                          Job: {matter.job.title}
                        </Text>
                      )}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {new Date(matter.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Box>
  )
}

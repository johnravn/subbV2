// src/features/super/components/UsersTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flex, Spinner, Table, Text, TextField } from '@radix-ui/themes'
import { prettyPhone } from '@shared/phone/phone'
import { usersIndexQuery } from '../api/queries'
import type { UserIndexRow } from '../api/queries'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (user: UserIndexRow) => void
  onDelete: (user: UserIndexRow) => void
}

export default function UsersTable({ selectedId, onSelect }: Props) {
  const [search, setSearch] = React.useState('')

  const { data: users = [], isLoading } = useQuery({
    ...usersIndexQuery(),
  })

  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return users
    const query = search.toLowerCase()
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(query) ||
        u.display_name?.toLowerCase().includes(query) ||
        u.first_name?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query),
    )
  }, [users, search])

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py="8">
        <Spinner size="3" />
      </Flex>
    )
  }

  return (
    <div>
      <Flex gap="2" mb="4" align="center">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          size="3"
          style={{ flex: '1 1 260px' }}
        />
      </Flex>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Phone</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filteredUsers.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">
                  {search ? 'No users found' : 'No users'}
                </Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            filteredUsers.map((user) => (
              <Table.Row
                key={user.user_id}
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    selectedId === user.user_id
                      ? 'var(--accent-a3)'
                      : undefined,
                }}
                onClick={() => onSelect(user.user_id)}
              >
                <Table.Cell>
                  <Text weight="medium">{user.email}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {user.display_name ||
                      [user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(' ') ||
                      '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {prettyPhone(user.phone)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  )
}

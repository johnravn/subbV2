// src/features/costumers/components/CustomerInspector.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Separator,
  Spinner,
  Table,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { prettyPhone } from '@shared/phone/phone'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { addContact, customerDetailQuery, deleteContact } from '../api/queries'
import EditCustomerDialog from './dialogs/EditCustomerDialog'
import AddContactDialog from './dialogs/AddContactDialog'
import EditContactDialog from './dialogs/EditContactDialog'
import type { ContactRow } from '../api/queries'

export default function CustomerInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)

  // NEW: dialog state for contacts
  const [addOpen, setAddOpen] = React.useState(false)
  const [editContactOpen, setEditContactOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<ContactRow | null>(null)

  const { success } = useToast()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  )

  const enabled = Boolean(companyId && id)
  const { data, isLoading, isError, error } = useQuery({
    ...customerDetailQuery({
      companyId: companyId ?? '',
      id: id ?? '',
    }),
    enabled,
  })

  const deleteContactMut = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'customer-detail', id],
      })
      success('Contact deleted', 'The contact was removed successfully.')
      setConfirmOpen(false)
      setPendingDeleteId(null)
    },
  })

  if (!id) return <Text color="gray">Select a customer.</Text>
  if (!enabled) return <Text color="gray">Preparing…</Text>
  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  const c = data

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {c.name}
          </Text>
          <Text as="div" size="2" color="gray">
            {c.address || '—'}
          </Text>
        </div>
        <Flex gap="2" align="center">
          {c.is_partner ? (
            <Badge variant="soft" color="green">
              Partner
            </Badge>
          ) : (
            <Badge variant="soft">Customer</Badge>
          )}
          <EditCustomerDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            initial={{
              id: c.id,
              name: c.name,
              address: c.address ?? '',
              email: c.email ?? '',
              phone: c.phone ?? '',
              vat_number: c.vat_number ?? '',
              is_partner: c.is_partner,
            }}
            onSaved={() => {
              qc.invalidateQueries({
                queryKey: ['company', companyId, 'customer-detail', id],
              })
              qc.invalidateQueries({
                queryKey: ['company', companyId, 'customers-index'],
              })
            }}
          />
          <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Meta */}
      <Flex direction="column" gap="2" mb="3">
        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Email
          </Text>
          <Text as="div" size="2">
            <a href={`mailto:${c.email}`} style={{ color: 'inherit' }}>
              {c.email}
            </a>
          </Text>
        </div>
        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Phone
          </Text>
          <Text as="div" size="2">
            {c.phone ? (
              <a href={`tel:${c.phone}`} style={{ color: 'inherit' }}>
                {prettyPhone(c.phone)}
              </a>
            ) : (
              '—'
            )}
          </Text>
        </div>
        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            VAT
          </Text>
          <Text as="div" size="2">
            {c.vat_number}
          </Text>
        </div>
      </Flex>

      {/* Contacts */}
      <Flex align="baseline" justify="between" mb="2">
        <Text as="div" size="2" color="gray">
          Contacts
        </Text>
        <Button size="2" variant="classic" onClick={() => setAddOpen(true)}>
          Add contact
        </Button>
      </Flex>

      <Box
        style={{
          border: '1px solid var(--gray-a6)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Phone</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: 160 }} />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {c.contacts.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>No contacts yet.</Table.Cell>
              </Table.Row>
            ) : (
              c.contacts.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.name}</Table.Cell>
                  <Table.Cell>
                    <a href={`mailto:${p.email}`} style={{ color: 'inherit' }}>
                      {p.email}
                    </a>
                  </Table.Cell>
                  <Table.Cell>
                    {p.phone ? (
                      <a href={`tel:${p.phone}`} style={{ color: 'inherit' }}>
                        {prettyPhone(p.phone)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </Table.Cell>
                  <Table.Cell>{p.title || '—'}</Table.Cell>
                  <Table.Cell>
                    <Flex gap="2" justify="end">
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => {
                          setEditTarget(p)
                          setEditContactOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="1"
                        color="red"
                        variant="soft"
                        onClick={() => {
                          setPendingDeleteId(p.id)
                          setConfirmOpen(true)
                        }}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Dialogs */}
      <AddContactDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        customerId={c.id}
        onSaved={() =>
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'customer-detail', id],
          })
        }
      />

      <EditContactDialog
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        contact={editTarget}
        onSaved={() =>
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'customer-detail', id],
          })
        }
      />

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete contact?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will permanently remove this contact from <b>{c.name}</b>. This
            action cannot be undone.
          </AlertDialog.Description>

          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft" disabled={deleteContactMut.isPending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                variant="solid"
                disabled={deleteContactMut.isPending || !pendingDeleteId}
                onClick={() => {
                  if (pendingDeleteId) {
                    deleteContactMut.mutate({ id: pendingDeleteId })
                  }
                }}
              >
                {deleteContactMut.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </div>
  )
}

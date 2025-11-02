// src/features/super/pages/SuperPage.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Tabs,
} from '@radix-ui/themes'
import { Plus } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import CompaniesTable from '../components/CompaniesTable'
import CompanyDialog from '../components/CompanyDialog'
import CompanyInspector from '../components/CompanyInspector'
import UsersTable from '../components/UsersTable'
import UserDialog from '../components/UserDialog'
import UserInspector from '../components/UserInspector'
import type { CompanyIndexRow } from '@features/company/api/queries'
import type { UserIndexRow } from '../api/queries'

export default function SuperPage() {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingCompany, setEditingCompany] =
    React.useState<CompanyIndexRow | null>(null)
  const [deletingCompany, setDeletingCompany] =
    React.useState<CompanyIndexRow | null>(null)

  // User-specific state
  const [userDialogOpen, setUserDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserIndexRow | null>(
    null,
  )

  // Track active tab to clear selection when switching
  const [activeTab, setActiveTab] = React.useState<string>('companies')

  // match JobsPage behavior for responsive layout
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  const handleCreate = () => {
    setEditingCompany(null)
    setDialogOpen(true)
  }

  const handleEdit = (company: CompanyIndexRow) => {
    setEditingCompany(company)
    setDialogOpen(true)
  }

  const handleDelete = (company: CompanyIndexRow) => {
    setDeletingCompany(company)
  }

  const handleEditUser = (user: UserIndexRow) => {
    setEditingUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteUser = (user: UserIndexRow) => {
    setEditingUser(user)
    setUserDialogOpen(true)
  }

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      setDeletingCompany(null)
      if (selectedId === deletingCompany?.id) {
        setSelectedId(null)
      }
      success('Success!', 'Company was deleted')
    },
    onError: (e: any) => {
      toastError('Failed to delete company', e?.message ?? 'Please try again.')
    },
  })

  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue="companies"
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab)
          setSelectedId(null) // Clear selection when switching tabs
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="companies">Companies</Tabs.Trigger>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
        </Tabs.List>

        <Box
          pt="4"
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs.Content
            value="companies"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 1/3 table (left), 2/3 inspector (right) from 1024px and up */}
            <Grid
              columns={{ initial: '1fr', lg: '2fr 3fr' }}
              gap="4"
              align="stretch"
              style={{
                height: isLarge ? '100%' : undefined,
                minHeight: 0,
                flex: isLarge ? 1 : undefined,
              }}
            >
              {/* LEFT: Companies table */}
              <Card
                size="3"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                }}
              >
                <Flex align="center" justify="between" mb="3">
                  <Heading size="5">Companies</Heading>
                  <Button onClick={handleCreate}>
                    <Plus width={16} height={16} />
                    Create
                  </Button>
                </Flex>
                <Separator size="4" mb="3" />
                <Box
                  style={{
                    flex: isLarge ? 1 : undefined,
                    minHeight: isLarge ? 0 : undefined,
                    overflowY: isLarge ? 'auto' : 'visible',
                  }}
                >
                  <CompaniesTable
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </Box>
              </Card>

              {/* RIGHT: Inspector */}
              <Card
                size="3"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: isLarge ? '100%' : undefined,
                  maxHeight: isLarge ? '100%' : undefined,
                  overflow: isLarge ? 'hidden' : 'visible',
                  minHeight: 0,
                }}
              >
                <Heading size="5" mb="3">
                  Inspector
                </Heading>
                <Separator size="4" mb="3" />
                <Box
                  style={{
                    flex: isLarge ? 1 : undefined,
                    minHeight: isLarge ? 0 : undefined,
                    overflowY: isLarge ? 'auto' : 'visible',
                  }}
                >
                  <CompanyInspector
                    id={selectedId}
                    onDeleted={() => setSelectedId(null)}
                    onEdit={() => {
                      if (selectedId) {
                        // Find the company from the query cache or fetch it
                        const companies = qc.getQueryData<
                          Array<CompanyIndexRow>
                        >(['companies', 'index'])
                        const company = companies?.find(
                          (c) => c.id === selectedId,
                        )
                        if (company) {
                          setEditingCompany(company)
                          setDialogOpen(true)
                        }
                      }
                    }}
                    onDelete={() => {
                      if (selectedId) {
                        const companies = qc.getQueryData<
                          Array<CompanyIndexRow>
                        >(['companies', 'index'])
                        const company = companies?.find(
                          (c) => c.id === selectedId,
                        )
                        if (company) {
                          setDeletingCompany(company)
                        }
                      }
                    }}
                  />
                </Box>
              </Card>
            </Grid>
          </Tabs.Content>

          <Tabs.Content
            value="users"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 50/50 split for users tab */}
            <Grid
              columns={{ initial: '1fr', lg: '1fr 1fr' }}
              gap="4"
              align="stretch"
              style={{
                height: isLarge ? '100%' : undefined,
                minHeight: 0,
                flex: isLarge ? 1 : undefined,
              }}
            >
              {/* LEFT: Users table */}
              <Card
                size="3"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                }}
              >
                <Flex align="center" justify="between" mb="3">
                  <Heading size="5">Users</Heading>
                </Flex>
                <Separator size="4" mb="3" />
                <Box
                  style={{
                    flex: isLarge ? 1 : undefined,
                    minHeight: isLarge ? 0 : undefined,
                    overflowY: isLarge ? 'auto' : 'visible',
                  }}
                >
                  <UsersTable
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onEdit={handleEditUser}
                    onDelete={handleDeleteUser}
                  />
                </Box>
              </Card>

              {/* RIGHT: Inspector */}
              <Card
                size="3"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: isLarge ? '100%' : undefined,
                  maxHeight: isLarge ? '100%' : undefined,
                  overflow: isLarge ? 'hidden' : 'visible',
                  minHeight: 0,
                }}
              >
                <Heading size="5" mb="3">
                  Inspector
                </Heading>
                <Separator size="4" mb="3" />
                <Box
                  style={{
                    flex: isLarge ? 1 : undefined,
                    minHeight: isLarge ? 0 : undefined,
                    overflowY: isLarge ? 'auto' : 'visible',
                  }}
                >
                  <UserInspector
                    id={selectedId}
                    onDeleted={() => setSelectedId(null)}
                    onEdit={() => {
                      if (selectedId) {
                        const users = qc.getQueryData<Array<UserIndexRow>>([
                          'users',
                          'index',
                        ])
                        const user = users?.find(
                          (u) => u.user_id === selectedId,
                        )
                        if (user) {
                          setEditingUser(user)
                          setUserDialogOpen(true)
                        }
                      }
                    }}
                    onDelete={() => {
                      if (selectedId) {
                        const users = qc.getQueryData<Array<UserIndexRow>>([
                          'users',
                          'index',
                        ])
                        const user = users?.find(
                          (u) => u.user_id === selectedId,
                        )
                        if (user) {
                          setEditingUser(user)
                          setUserDialogOpen(true)
                        }
                      }
                    }}
                  />
                </Box>
              </Card>
            </Grid>
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {/* Create/Edit Dialog */}
      <CompanyDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingCompany(null)
          }
        }}
        mode={editingCompany ? 'edit' : 'create'}
        initialData={
          editingCompany
            ? {
                id: editingCompany.id,
                name: editingCompany.name,
                general_email: editingCompany.general_email,
                address: editingCompany.address,
                vat_number: editingCompany.vat_number,
                contact_person_id: editingCompany.contact_person_id,
              }
            : undefined
        }
        onSaved={() => {
          setDialogOpen(false)
          setEditingCompany(null)
          qc.invalidateQueries({ queryKey: ['companies'] })
          qc.invalidateQueries({ queryKey: ['company'] })
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root
        open={!!deletingCompany}
        onOpenChange={(open) => {
          if (!open) setDeletingCompany(null)
        }}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete Company?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will permanently delete the company{' '}
            <b>{deletingCompany?.name}</b>. This action cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                onClick={() => {
                  if (deletingCompany) {
                    deleteMutation.mutate(deletingCompany.id)
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      {/* User Dialog */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open)
          if (!open) {
            setEditingUser(null)
          }
        }}
        initialData={
          editingUser
            ? {
                user_id: editingUser.user_id,
                email: editingUser.email,
                display_name: editingUser.display_name,
                first_name: editingUser.first_name,
                last_name: editingUser.last_name,
                phone: editingUser.phone,
                superuser: editingUser.superuser,
              }
            : undefined
        }
        onSaved={() => {
          setUserDialogOpen(false)
          setEditingUser(null)
          qc.invalidateQueries({ queryKey: ['users'] })
        }}
      />
    </section>
  )
}

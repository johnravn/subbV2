// src/features/company/components/CompanySetupTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Separator,
  Spinner,
  Switch,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { Check, Edit, Trash, Xmark } from 'iconoir-react'

type ItemCategory = {
  id: string
  company_id: string
  name: string
}

function CategoriesDialogContent({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState({ name: '' })
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState<string>('')

  const categoriesQueryKey = ['company', companyId, 'item-categories'] as const

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: categoriesQueryKey,
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<ItemCategory>> => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, company_id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 5_000,
  })

  const createMutation = useMutation({
    mutationFn: async (f: { name: string }) => {
      if (!companyId) throw new Error('No company selected')
      const { error } = await supabase.from('item_categories').insert({
        company_id: companyId,
        name: f.name.trim(),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setForm({ name: '' })
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      const { error } = await supabase
        .from('item_categories')
        .update({ name: payload.name.trim() })
        .eq('id', payload.id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditingId(null)
      setEditingName('')
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Edit Categories</Dialog.Title>

        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            padding: 8,
            marginTop: 12,
          }}
        >
          {isLoading ? (
            <Flex align="center" justify="center" p="4">
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            </Flex>
          ) : isError ? (
            <Text color="red">
              {(error as any)?.message ?? 'Failed to load'}
            </Text>
          ) : (categories?.length ?? 0) === 0 ? (
            <Text color="gray">No categories yet.</Text>
          ) : (
            categories!.map((c, idx) => (
              <React.Fragment key={c.id}>
                {idx > 0 && <Separator my="2" />}
                <Flex align="center" gap="2" py="1">
                  {editingId === c.id ? (
                    <>
                      <TextField.Root
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Save"
                        disabled={
                          updateMutation.isPending ||
                          editingName.trim().length === 0
                        }
                        onClick={() =>
                          updateMutation.mutate({ id: c.id, name: editingName })
                        }
                      >
                        <Check />
                      </IconButton>
                      <IconButton
                        size="2"
                        variant="ghost"
                        title="Cancel"
                        onClick={() => {
                          setEditingId(null)
                          setEditingName('')
                        }}
                      >
                        <Xmark />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Text style={{ flex: 1 }}>{c.name}</Text>
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Edit name"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditingName(c.name)
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="2"
                        color="red"
                        variant="soft"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(c.id)}
                      >
                        <Trash />
                      </IconButton>
                    </>
                  )}
                </Flex>
              </React.Fragment>
            ))
          )}
        </div>

        <Flex direction="column" gap="3" mt="3">
          <div>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              New category name
            </Text>
            <TextField.Root
              placeholder="e.g. Audio"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
            />
          </div>

          {(createMutation.isError ||
            updateMutation.isError ||
            deleteMutation.isError) && (
            <Text color="red">
              {(createMutation.error as any)?.message ||
                (updateMutation.error as any)?.message ||
                (deleteMutation.error as any)?.message ||
                'Something went wrong'}
            </Text>
          )}
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
          <Button
            onClick={() => createMutation.mutate({ name: form.name })}
            disabled={!form.name.trim() || createMutation.isPending}
            variant="classic"
          >
            {createMutation.isPending ? 'Saving…' : 'Create'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export default function CompanySetupTab() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [editCategoriesOpen, setEditCategoriesOpen] = React.useState(false)

  // Fetch company_expansions for latest_feed_open_to_freelancers setting
  const { data: expansions, isLoading: expansionsLoading } = useQuery({
    queryKey: ['company', companyId, 'expansions'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('id, latest_feed_open_to_freelancers')
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const updateFeedAccessMutation = useMutation({
    mutationFn: async (openToFreelancers: boolean) => {
      if (!companyId) throw new Error('No company selected')

      // Upsert: create if doesn't exist, update if exists
      if (expansions?.id) {
        const { error } = await supabase
          .from('company_expansions')
          .update({ latest_feed_open_to_freelancers: openToFreelancers })
          .eq('id', expansions.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('company_expansions').insert({
          company_id: companyId,
          latest_feed_open_to_freelancers: openToFreelancers,
        })
        if (error) throw error
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansions'],
      })
    },
  })

  if (!companyId) return <div>No company selected.</div>

  return (
    <>
      <CategoriesDialogContent
        open={editCategoriesOpen}
        onOpenChange={setEditCategoriesOpen}
        companyId={companyId}
      />

      <Card size="4" style={{ minHeight: 0, overflow: 'auto' }}>
        <Box p="4">
          {/* Inventory Setup Section */}
          <Heading size="4" mb="4">
            Inventory setup
          </Heading>

          <Flex direction="column" gap="3" mb="6">
            <Button
              size="3"
              variant="outline"
              onClick={() => setEditCategoriesOpen(true)}
            >
              <Edit /> Manage Categories
            </Button>
          </Flex>

          <Separator size="4" mb="6" />

          {/* Latest Feed Settings */}
          <Heading size="4" mb="4">
            Latest Feed Settings
          </Heading>

          <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="4">
              <Flex direction="column">
                <Text size="3" weight="medium" mb="1">
                  Allow freelancers to view Latest feed
                </Text>
                <Text size="2" color="gray">
                  When enabled, freelancers in your company can view the Latest
                  feed. They will have read-only access and can like and
                  comment.
                </Text>
              </Flex>
              {expansionsLoading ? (
                <Spinner size="2" />
              ) : (
                <Switch
                  checked={
                    updateFeedAccessMutation.isPending
                      ? !expansions?.latest_feed_open_to_freelancers
                      : (expansions?.latest_feed_open_to_freelancers ?? false)
                  }
                  onCheckedChange={(checked) => {
                    updateFeedAccessMutation.mutate(checked)
                  }}
                  disabled={updateFeedAccessMutation.isPending}
                />
              )}
            </Flex>
          </Flex>
        </Box>
      </Card>
    </>
  )
}

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Select,
  Separator,
  Spinner,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { NewTab, Plus, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'

type Option = { id: string; name: string }
type PickerItem = {
  id: string
  name: string
  current_price: number | null
}
type Part = {
  item_id: string
  item_name: string
  quantity: number
  unit_price: number | null
}
type FormState = {
  name: string
  categoryId: string | null
  description: string
  active: boolean
  price: number | null
  parts: Array<Part>
  unique: boolean
}

export default function AddGroupDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const [form, setForm] = React.useState<FormState>({
    name: '',
    categoryId: null,
    description: '',
    active: true,
    price: null,
    parts: [],
    unique: false,
  })
  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  /* -------- Categories -------- */
  const {
    data: categories = [],
    isLoading: catLoading,
    error: catErr,
  } = useQuery({
    queryKey: ['company', companyId, 'item_categories'],
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<Option>> => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<Option>
    },
    staleTime: 60_000,
  })

  /* -------- Item search (picker) -------- */
  const [search, setSearch] = React.useState('')
  const {
    data: pickerItems = [],
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    error: itemsErr,
  } = useQuery({
    queryKey: ['company', companyId, 'picker-items', search],
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<PickerItem>> => {
      let q = supabase
        .from('items')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('active', true) // 👈 only active
        .or('deleted.is.null,deleted.eq.false')
        .limit(20)

      if (search) q = q.ilike('name', `%${search}%`)

      const { data, error } = await q
      if (error) throw error

      const ids = data.map((r) => r.id)
      let prices: Record<string, number | null> = {}
      if (ids.length) {
        const { data: cp, error: cpErr } = await supabase
          .from('item_current_price')
          .select('item_id, current_price')
          .in('item_id', ids)
        if (cpErr) throw cpErr
        prices = cp.reduce((acc: Record<string, number | null>, r) => {
          acc[r.item_id] = r.current_price
          return acc
        }, {})
      }

      return data.map((r) => ({
        id: r.id,
        name: r.name,
        current_price: prices[r.id] ?? null,
      }))
    },
    staleTime: 15_000,
  })

  const addPart = (it: PickerItem) => {
    set('parts', [
      ...form.parts.filter((p) => p.item_id !== it.id),
      {
        item_id: it.id,
        item_name: it.name,
        quantity: form.unique ? 1 : 1,
        unit_price: it.current_price ?? null,
      },
    ])
  }
  const updatePartQty = (item_id: string, qty: number) => {
    set(
      'parts',
      form.parts.map((p) =>
        p.item_id === item_id ? { ...p, quantity: Math.max(1, qty) } : p,
      ),
    )
  }
  const removePart = (item_id: string) => {
    set(
      'parts',
      form.parts.filter((p) => p.item_id !== item_id),
    )
  }

  const totalPartsValue = React.useMemo(
    () =>
      form.parts.reduce((sum, p) => {
        const up = Number(p.unit_price ?? 0)
        return sum + up * p.quantity
      }, 0),
    [form.parts],
  )

  /* -------- Create mutation -------- */
  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      if (!f.name.trim()) throw new Error('Name is required')

      const { error: rpcErr } = await supabase.rpc(
        'create_group_with_price_and_parts',
        {
          p_company_id: companyId,
          p_name: f.name.trim(),
          p_category_id: f.categoryId,
          p_description: f.description || null,
          p_active: f.active,
          p_price: f.price,
          p_parts: f.parts.map((p) => ({
            item_id: p.item_id,
            quantity: p.quantity,
          })),
          p_unique: f.unique,
        },
      )
      if (!rpcErr) return

      // Fallback
      const { data: g, error: gErr } = await supabase
        .from('item_groups')
        .insert({
          company_id: companyId,
          name: f.name.trim(),
          category_id: f.categoryId,
          description: f.description || null,
          active: f.active,
          unique: f.unique,
        })
        .select('id')
        .single()
      if (gErr) throw gErr
      const groupId = g.id as string

      if (f.parts.length) {
        const { error: giErr } = await supabase.from('group_items').insert(
          f.parts.map((p) => ({
            group_id: groupId,
            item_id: p.item_id,
            quantity: p.quantity,
          })),
        )
        if (giErr) {
          await supabase.from('item_groups').delete().eq('id', groupId)
          throw giErr
        }
      }
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id ?? null

      //   Optional: group_price_history insert if you enabled it
      if (f.price != null && !Number.isNaN(Number(f.price))) {
        const { error: gpErr } = await supabase
          .from('group_price_history')
          .insert({
            company_id: companyId,
            group_id: groupId,
            amount: f.price,
            set_by: userId,
          })
        if (gpErr) {
          await supabase.from('item_groups').delete().eq('id', groupId)
          throw gpErr
        }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'items'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'groups'],
          exact: false,
        }),
      ])
      onOpenChange(false)
      success('Group created', 'Your group was added successfully.')
    },
    onError: (e: any) => {
      toastError('Failed to create group', e?.message ?? 'Please try again.')
    },
  })

  const loading = catLoading
  const fmt = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>
        {/* "classic" | "solid" | "soft" | "surface" | "outline" | "ghost" */}
        {/* <Button size="2" highContrast variant="solid"> */}
        <Button size="2" variant="classic">
          <NewTab /> Add group
        </Button>
      </Dialog.Trigger>

      {/* Fixed height dialog + two columns */}
      <Dialog.Content
        maxWidth="900px"
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>Add group to inventory</Dialog.Title>

        {/* Grid container fills the dialog and scrolls per column */}
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
            flex: 1,
            minHeight: 0, // critical so children can overflow within fixed height
          }}
        >
          {/* LEFT COLUMN: all fields + picker */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
              minHeight: 0,
              paddingRight: 4,
            }}
          >
            <Field label="Name">
              <TextField.Root
                placeholder="e.g. Stage box 8ch"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Flex gap="3" wrap="wrap">
              <Field label="Category">
                <Select.Root
                  value={form.categoryId ?? undefined}
                  onValueChange={(v) => set('categoryId', v)}
                  size="3"
                  disabled={loading}
                >
                  <Select.Trigger
                    placeholder={loading ? 'Loading…' : 'Select category'}
                    style={{ minHeight: 'var(--space-7)' }}
                  />
                  <Select.Content>
                    <Select.Group>
                      {categories.map((c) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Active">
                <Select.Root
                  value={form.active ? 'true' : 'false'}
                  onValueChange={(v) => set('active', v === 'true')}
                  size="3"
                >
                  <Select.Trigger style={{ minHeight: 'var(--space-7)' }} />
                  <Select.Content>
                    <Select.Item value="true">Active</Select.Item>
                    <Select.Item value="false">Inactive</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Unique group">
                <Select.Root
                  value={form.unique ? 'true' : 'false'}
                  size="3"
                  onValueChange={(v) => set('unique', v === 'true')}
                >
                  <Select.Trigger style={{ minHeight: 'var(--space-7)' }} />
                  <Select.Content>
                    <Select.Item value="false">Bundle (generic)</Select.Item>
                    <Select.Item value="true">Unique (fixed set)</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="Price (optional)">
                <TextField.Root
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 999.00"
                  value={form.price == null ? '' : String(form.price)}
                  onChange={(e) =>
                    set(
                      'price',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                />
              </Field>
            </Flex>

            <Field label="Description">
              <TextArea
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Short description…"
              />
            </Field>

            <Separator my="2" />

            <Text size="2" color="gray">
              Add items
            </Text>
            <Flex gap="2" align="center" wrap="wrap">
              <TextField.Root
                placeholder="Search items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="3"
                style={{ flex: '1 1 260px' }}
              />
              {itemsFetching && <Spinner />}
            </Flex>

            <BoxedList
              loading={itemsLoading}
              emptyText={
                search ? 'No items found.' : 'Start typing to search items.'
              }
            >
              {pickerItems.map((it) => (
                <Flex key={it.id} align="center" justify="between" py="1">
                  <Text size="1">{it.name}</Text>
                  <Flex align="center" gap="1">
                    <Text size="1" color="gray">
                      {it.current_price != null
                        ? fmt.format(Number(it.current_price))
                        : '—'}
                    </Text>
                    <Button
                      variant="classic"
                      size="1"
                      onClick={() => addPart(it)}
                    >
                      Add
                    </Button>
                  </Flex>
                </Flex>
              ))}
            </BoxedList>
          </div>

          {/* RIGHT COLUMN: selected parts with its own scroll */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <Text size="2" color="gray" style={{ marginBottom: 6 }}>
              Selected items
            </Text>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {form.parts.length === 0 ? (
                <Text size="2" color="gray">
                  No items selected.
                </Text>
              ) : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Unit</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {form.parts.map((p) => (
                      <Table.Row key={p.item_id}>
                        <Table.Cell>{p.item_name}</Table.Cell>
                        <Table.Cell style={{ width: 100 }}>
                          <TextField.Root
                            type="number"
                            inputMode="numeric"
                            min="1"
                            // disabled={form.unique} // 👈 disable when unique
                            value={String(p.quantity)}
                            onChange={(e) =>
                              updatePartQty(
                                p.item_id,
                                Math.max(1, Number(e.target.value || 1)),
                              )
                            }
                          />
                        </Table.Cell>
                        <Table.Cell>
                          {p.unit_price != null
                            ? fmt.format(Number(p.unit_price))
                            : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          {p.unit_price != null
                            ? fmt.format(Number(p.unit_price) * p.quantity)
                            : '—'}
                        </Table.Cell>
                        <Table.Cell align="right">
                          <IconButton
                            size="2"
                            color="red"
                            variant="soft"
                            onClick={() => removePart(p.item_id)}
                            title="Remove"
                          >
                            <Trash />
                          </IconButton>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    <Table.Row>
                      <Table.Cell />
                      <Table.Cell />
                      <Table.Cell style={{ fontWeight: 600 }}>
                        Parts total
                      </Table.Cell>
                      <Table.Cell style={{ fontWeight: 600 }}>
                        {fmt.format(totalPartsValue)}
                      </Table.Cell>
                      <Table.Cell />
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              )}
            </div>
          </div>
        </div>

        {/* Actions row sticks to bottom of dialog */}
        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving…' : 'Create'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

/* ---------- helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ flex: '1 1', minWidth: 160 }}>
      <Text
        as="label"
        size="2"
        color="gray"
        style={{ display: 'block', marginBottom: 6 }}
      >
        {label}
      </Text>
      {children}
    </div>
  )
}

function BoxedList({
  loading,
  emptyText,
  children,
}: {
  loading: boolean
  emptyText: string
  height?: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        overflowY: 'auto',
        border: '1px solid var(--gray-a6)',
        borderRadius: 8,
        padding: 8,
      }}
    >
      {loading ? (
        <Flex align="center" justify="center" p="4">
          <Spinner />
        </Flex>
      ) : React.Children.count(children) === 0 ? (
        <Text color="gray">{emptyText}</Text>
      ) : (
        children
      )}
    </div>
  )
}

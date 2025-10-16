// src/features/inventory/components/AddGroupDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
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
import { NewTab, Search, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { partnerCustomersQuery } from '../api/partners'

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
  internally_owned: boolean
  external_owner_id: string | null
}

type EditInitialData = {
  id: string
  name: string
  categoryName: string | null
  description: string | null
  active: boolean
  unique: boolean
  price: number | null
  parts: Array<{
    item_id: string
    item_name: string
    quantity: number
    item_current_price: number | null
  }>
  internally_owned: boolean
  external_owner_id: string | null
}

export default function AddGroupDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
  mode?: 'create' | 'edit'
  initialData?: EditInitialData
  onSaved?: () => void
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
    internally_owned: true,
    external_owner_id: null,
  })
  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  // keep original price to detect changes in edit mode
  const originalPriceRef = React.useRef<number | null>(null)

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
        .eq('active', true) // only active
        .or('deleted.is.null,deleted.eq.false') // exclude deleted
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

  const { data: partners = [] } = useQuery({
    ...(companyId
      ? partnerCustomersQuery({ companyId })
      : {
          queryKey: ['company', '__none__', 'partner-customers'],
          queryFn: async () => [],
        }),
    enabled: !!companyId && open,
  })

  /* -------- Prefill in EDIT mode (prevent infinite loop) -------- */
  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    const catId =
      categories.find((c) => c.name === initialData.categoryName)?.id ?? null

    originalPriceRef.current = initialData.price ?? null

    const newParts = initialData.parts.map((p) => ({
      item_id: p.item_id,
      item_name: p.item_name,
      quantity: p.quantity,
      unit_price: p.item_current_price,
    }))

    setForm((prev) => {
      if (
        prev.name === initialData.name &&
        prev.categoryId === catId &&
        prev.description === (initialData.description ?? '') &&
        prev.active === initialData.active &&
        prev.unique === initialData.unique &&
        prev.price === (initialData.price ?? null) &&
        JSON.stringify(prev.parts) === JSON.stringify(newParts) &&
        prev.internally_owned === initialData.internally_owned &&
        prev.external_owner_id === (initialData.external_owner_id ?? null)
      ) {
        return prev
      }
      return {
        name: initialData.name,
        categoryId: catId,
        description: initialData.description ?? '',
        active: initialData.active,
        unique: initialData.unique,
        price: initialData.price ?? null,
        parts: newParts,
        internally_owned: initialData.internally_owned,
        external_owner_id: initialData.external_owner_id,
      }
    })
  }, [open, mode, initialData, categories])

  /* -------- Parts handlers -------- */
  const addPart = (it: PickerItem) => {
    set('parts', [
      ...form.parts.filter((p) => p.item_id !== it.id),
      {
        item_id: it.id,
        item_name: it.name,
        quantity: 1, // allow any qty even when unique
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
          p_internally_owned: f.internally_owned,
          p_external_owner_id: f.internally_owned ? null : f.external_owner_id,
        },
      )
      if (!rpcErr) return

      // Fallback (rare)
      const { data: g, error: gErr } = await supabase
        .from('item_groups')
        .insert({
          company_id: companyId,
          name: f.name.trim(),
          category_id: f.categoryId,
          description: f.description || null,
          active: f.active,
          unique: f.unique,
          internally_owned: f.internally_owned,
          external_owner_id: f.internally_owned ? null : f.external_owner_id,
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

      if (f.price != null && !Number.isNaN(Number(f.price))) {
        const { error: gpErr } = await supabase
          .from('group_price_history')
          .insert({
            company_id: companyId,
            group_id: groupId,
            amount: f.price,
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
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create group', e?.message ?? 'Please try again.')
    },
  })

  /* -------- Edit mutation -------- */
  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      if (!initialData?.id) throw new Error('Missing group id')

      // 1) Update the group row
      const { error: upErr } = await supabase
        .from('item_groups')
        .update({
          name: f.name.trim(),
          category_id: f.categoryId,
          description: f.description || null,
          active: f.active,
          unique: f.unique,
          internally_owned: f.internally_owned,
          external_owner_id: f.internally_owned ? null : f.external_owner_id,
        })
        .eq('company_id', companyId)
        .eq('id', initialData.id)
      if (upErr) throw upErr

      // 2) Replace parts: delete all then insert current set
      const { error: delErr } = await supabase
        .from('group_items')
        .delete()
        .eq('group_id', initialData.id)
      if (delErr) throw delErr

      if (f.parts.length) {
        const { error: insErr } = await supabase.from('group_items').insert(
          f.parts.map((p) => ({
            group_id: initialData.id,
            item_id: p.item_id,
            quantity: p.quantity,
          })),
        )
        if (insErr) throw insErr
      }

      // 3) Price history when changed
      const newPrice = f.price
      const changed = (newPrice ?? null) !== (originalPriceRef.current ?? null)

      if (changed && newPrice != null) {
        const { error: phErr } = await supabase
          .from('group_price_history')
          .insert({
            company_id: companyId,
            group_id: initialData.id,
            amount: newPrice,
          })
        if (phErr) throw phErr
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-detail'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'groups'],
          exact: false,
        }),
      ])
      onOpenChange(false)
      success('Saved', 'Group was updated.')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to update group', e?.message ?? 'Please try again.')
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

  // Confirmation for edit mode
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const saving =
    mode === 'create' ? createMutation.isPending : editMutation.isPending

  const title = mode === 'edit' ? 'Edit group' : 'Add group to inventory'
  const actionLabel =
    mode === 'edit'
      ? saving
        ? 'Saving…'
        : 'Save'
      : saving
        ? 'Saving…'
        : 'Create'

  const handleSave = () => {
    if (mode === 'edit') {
      setConfirmOpen(true)
    } else {
      createMutation.mutate(form)
    }
  }
  const confirmAndSave = () => {
    setConfirmOpen(false)
    editMutation.mutate(form)
  }

  const canSaveOwner =
    form.internally_owned ||
    (!!form.external_owner_id && form.external_owner_id !== '')

  const disabled = saving || !form.name.trim() || !canSaveOwner

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {/* Only show trigger in CREATE mode */}
        {mode === 'create' && (
          <Dialog.Trigger>
            <Button size="2" variant="classic">
              <NewTab /> Add group
            </Button>
          </Dialog.Trigger>
        )}

        {/* Fixed height dialog + two columns */}
        <Dialog.Content
          maxWidth="990px"
          style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
        >
          <Dialog.Title>{title}</Dialog.Title>

          {/* Grid container fills the dialog and scrolls per column */}
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 16,
              flex: 1,
              minHeight: 0,
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

                <Field label="Type">
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

                <Field
                  label={
                    mode === 'edit'
                      ? 'Price (creates history if changed)'
                      : 'Price (optional)'
                  }
                >
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
              {/* …existing Flex with Category / Active / Type / Price … */}

              <Field label="Description">
                <TextArea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Short description…"
                />
              </Field>

              {/* NEW: wrap owner selectors in a Flex row */}
              <Flex gap="3" wrap="wrap">
                <Field label="Owner">
                  <Select.Root
                    value={form.internally_owned ? 'internal' : 'external'}
                    onValueChange={(v: string) => {
                      const internal = v === 'internal'
                      set('internally_owned', internal)
                      if (internal) set('external_owner_id', null)
                    }}
                    size="3"
                  >
                    <Select.Trigger style={{ minHeight: 'var(--space-7)' }} />
                    <Select.Content>
                      <Select.Item value="internal">Internal</Select.Item>
                      <Select.Item value="external">External</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Field>

                {!form.internally_owned && (
                  <Field label="External owner">
                    <Select.Root
                      value={form.external_owner_id ?? ''}
                      onValueChange={(v: string) =>
                        set('external_owner_id', v || null)
                      }
                      size="3"
                    >
                      <Select.Trigger
                        placeholder="Select partner…"
                        style={{ minHeight: 'var(--space-7)' }}
                      />
                      <Select.Content>
                        <Select.Group>
                          {partners.map((p) => (
                            <Select.Item key={p.id} value={p.id}>
                              {p.name}
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </Field>
                )}
              </Flex>

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
                <TextField.Slot side="left">
                  <Search />
                </TextField.Slot>
                <TextField.Slot side="right">
                  {itemsFetching && <Spinner />}
                </TextField.Slot>
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
            <Button onClick={handleSave} disabled={disabled} variant="classic">
              {actionLabel}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Confirm on edit */}
      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Save changes?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            You’re about to update this group. If you changed the price, a new
            price history entry will be added. Continue?
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="classic" onClick={confirmAndSave}>
                Yes, save
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
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
        minHeight: '190px',
      }}
    >
      {loading ? (
        <Flex align="center" justify="center" p="4">
          <Flex align="center" gap="1">
            <Text>Thinking</Text>
            <Spinner size="2" />
          </Flex>
        </Flex>
      ) : React.Children.count(children) === 0 ? (
        <Text color="gray">{emptyText}</Text>
      ) : (
        children
      )}
    </div>
  )
}

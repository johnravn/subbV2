// src/features/inventory/components/AddInventoryDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Select,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { Plus } from 'iconoir-react'

type FormState = {
  name: string
  categoryId?: string | null
  brandId?: string | null
  model?: string
  allow_individual_booking: boolean
  total_quantity: number
  active: boolean
  notes?: string
  price?: number | null
}

type Option = { id: string; name: string }

export default function AddItemDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const { success } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = React.useState<FormState>({
    name: '',
    categoryId: null,
    brandId: null,
    model: '',
    allow_individual_booking: true,
    total_quantity: 0,
    active: true,
    notes: '',
    price: undefined,
  })

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  // ---- Load categories / brands for this company ----
  const {
    data: categories,
    isLoading: catLoading,
    error: catErr,
  } = useQuery({
    queryKey: ['company', companyId, 'item_categories'],
    enabled: !!companyId && open,
    queryFn: async () => {
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

  const {
    data: brands,
    isLoading: brandLoading,
    error: brandErr,
  } = useQuery({
    queryKey: ['company', companyId, 'item_brands'],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_brands')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<Option>
    },
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      const { error } = await supabase.rpc('create_item_with_price', {
        p_company_id: companyId,
        p_name: f.name,
        p_category_id: f.categoryId ?? null,
        p_brand_id: f.brandId ?? null,
        p_model: f.model || null,
        p_allow_individual_booking: f.allow_individual_booking,
        p_total_quantity: f.total_quantity || 0,
        p_active: f.active,
        p_notes: f.notes || null,
        p_price: f.price ?? null,
        p_effective_from: null,
      })
      if (error) throw error
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
      ])
      onOpenChange(false)
      success('Success!', 'Item/group was added to inventory')
    },
  })

  const loading = catLoading || brandLoading

  return (
    <>
      {/* Toast (uses your shared component) */}

      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Trigger>
          <Button size="2">
            <Plus /> Add item
          </Button>
        </Dialog.Trigger>

        <Dialog.Content maxWidth="640px">
          <Dialog.Title>Add item to inventory</Dialog.Title>

          <Flex direction="column" gap="3" mt="1">
            {/* Name */}
            <Field label="Name">
              <TextField.Root
                placeholder="e.g. XLR 3m"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Flex gap="3" wrap="wrap">
              {/* Category */}
              <Field label="Category">
                <Select.Root
                  value={form.categoryId ?? undefined}
                  onValueChange={(v) => set('categoryId', v)}
                  disabled={loading}
                >
                  <Select.Trigger
                    placeholder={loading ? 'Loading…' : 'Select category'}
                  />
                  <Select.Content>
                    <Select.Group>
                      {(categories ?? []).map((c: Option) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field>

              {/* Brand */}
              <Field label="Brand">
                <Select.Root
                  value={form.brandId ?? undefined}
                  onValueChange={(v) => set('brandId', v === 'none' ? null : v)}
                  disabled={loading}
                >
                  <Select.Trigger placeholder="Select brand" />
                  <Select.Content>
                    <Select.Group>
                      <Select.Item value="none">(None)</Select.Item>
                      {(brands ?? []).map((b: Option) => (
                        <Select.Item key={b.id} value={b.id}>
                          {b.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field>

              {/* Model */}
              <Field label="Model">
                <TextField.Root
                  value={form.model ?? ''}
                  onChange={(e) => set('model', e.target.value)}
                />
              </Field>
            </Flex>

            <Flex gap="3" wrap="wrap">
              <Field label="Allow individual booking">
                <Switch
                  checked={form.allow_individual_booking}
                  onCheckedChange={(v) =>
                    set('allow_individual_booking', Boolean(v))
                  }
                />
              </Field>

              <Field label="Active">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => set('active', Boolean(v))}
                />
              </Field>

              <Field label="Total quantity">
                <TextField.Root
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={String(form.total_quantity)}
                  onChange={(e) =>
                    set(
                      'total_quantity',
                      Math.max(0, Number(e.target.value || 0)),
                    )
                  }
                />
              </Field>
            </Flex>

            {/* Price */}
            <Flex gap="3" wrap="wrap">
              <Field label="Price">
                <TextField.Root
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 199.00"
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

            <Field label="Notes">
              <TextArea
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Optional notes…"
              />
            </Field>

            {(catErr || brandErr || createMutation.isError) && (
              <Text color="red">
                {catErr?.message ||
                  brandErr?.message ||
                  (createMutation.error as any)?.message ||
                  'Failed'}
              </Text>
            )}
          </Flex>

          <Flex gap="2" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving…' : 'Create'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

/** Small helper for tidy label + control layout */
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

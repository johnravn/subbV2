// src/features/inventory/components/AddInventoryDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
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

type EditInitialData = {
  id: string
  name: string
  categoryName: string | null
  brandName: string | null
  model?: string
  allow_individual_booking: boolean
  total_quantity: number
  active: boolean
  notes?: string | null
  price: number | null
}

export default function AddItemDialog({
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
  const { success, error: toastError } = useToast()
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
  // keep a stable ref of original price for change detection
  const originalPriceRef = React.useRef<number | null>(null)

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  // ---- Load categories / brands for this company ----
  const {
    data: categories = [],
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
    data: brands = [],
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

  // Prefill on EDIT (only once per dialog open)
  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    // try to map category/brand names to IDs once options are loaded
    const catId =
      categories.find((c) => c.name === initialData.categoryName)?.id ?? null
    const brandId =
      brands.find((b) => b.name === initialData.brandName)?.id ?? null

    originalPriceRef.current = initialData.price ?? null

    setForm((prev) => {
      // Only update if values are different (prevents infinite loop)
      if (
        prev.name === initialData.name &&
        prev.categoryId === catId &&
        prev.brandId === brandId &&
        prev.model === (initialData.model ?? '') &&
        prev.allow_individual_booking ===
          initialData.allow_individual_booking &&
        prev.total_quantity === initialData.total_quantity &&
        prev.active === initialData.active &&
        prev.notes === (initialData.notes ?? '') &&
        prev.price === initialData.price
      ) {
        return prev
      }
      return {
        name: initialData.name,
        categoryId: catId,
        brandId,
        model: initialData.model ?? '',
        allow_individual_booking: initialData.allow_individual_booking,
        total_quantity: initialData.total_quantity,
        active: initialData.active,
        notes: initialData.notes ?? '',
        price: initialData.price,
      }
    })
    // Only run this effect when dialog is opened in edit mode, or when categories/brands are loaded
  }, [open, mode, initialData, categories, brands])

  /* ---------------- CREATE ---------------- */
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
      success('Success!', 'Item was added to inventory')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create item', e?.message ?? 'Please try again.')
    },
  })

  /* ---------------- EDIT ---------------- */
  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      if (!initialData?.id) throw new Error('Missing item id')

      // 1) Update the item row
      const { error: upErr } = await supabase
        .from('items')
        .update({
          name: f.name,
          category_id: f.categoryId ?? null,
          brand_id: f.brandId ?? null,
          model: f.model || null,
          allow_individual_booking: f.allow_individual_booking,
          total_quantity: f.total_quantity || 0,
          active: f.active,
          notes: f.notes || null,
        })
        .eq('company_id', companyId)
        .eq('id', initialData.id)

      if (upErr) throw upErr

      // 2) Price history (only append if changed and provided)
      const newPrice =
        f.price === undefined ? originalPriceRef.current : f.price // if field untouched, treat as unchanged
      const changed = newPrice !== originalPriceRef.current

      if (changed && newPrice != null) {
        const { error: phErr } = await supabase
          .from('item_price_history')
          .insert({
            company_id: companyId,
            item_id: initialData.id,
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
          queryKey: ['company', companyId, 'items'],
          exact: false,
        }),
      ])
      onOpenChange(false)
      success('Saved', 'Item was updated.')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to update item', e?.message ?? 'Please try again.')
    },
  })

  const loading = catLoading || brandLoading
  const saving =
    mode === 'create' ? createMutation.isPending : editMutation.isPending

  // Confirmation alert for EDIT mode
  const [confirmOpen, setConfirmOpen] = React.useState(false)
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

  const title = mode === 'edit' ? 'Edit item' : 'Add item to inventory'
  const actionLabel =
    mode === 'edit'
      ? saving
        ? 'Saving…'
        : 'Save'
      : saving
        ? 'Saving…'
        : 'Create'

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {/* Only render trigger in CREATE mode; in EDIT the parent opens it */}
        {mode === 'create' && (
          <Dialog.Trigger>
            <Button size="2" variant="classic">
              <Plus /> Add item
            </Button>
          </Dialog.Trigger>
        )}

        <Dialog.Content maxWidth="640px">
          <Dialog.Title>{title}</Dialog.Title>

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
                      {categories.map((c: Option) => (
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
                      {brands.map((b: Option) => (
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
              <Field
                label={
                  mode === 'edit'
                    ? 'Price (creates history if changed)'
                    : 'Price'
                }
              >
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

            {(catErr ||
              brandErr ||
              createMutation.isError ||
              editMutation.isError) && (
              <Text color="red">
                {catErr?.message ||
                  brandErr?.message ||
                  createMutation.error?.message ||
                  editMutation.error?.message ||
                  'Failed'}
              </Text>
            )}
          </Flex>

          <Flex gap="2" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={handleSave}
              disabled={!form.name || saving}
              variant="classic"
            >
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
            You’re about to update this item. If you changed the price, a new
            price history entry will be added. Are you sure you want to
            continue?
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

// // src/features/inventory/components/AddInventoryDialog.tsx
// import * as React from 'react'
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
// import {
//   Button,
//   Dialog,
//   Flex,
//   Select,
//   Switch,
//   Text,
//   TextArea,
//   TextField,
//   AlertDialog,
// } from '@radix-ui/themes'
// import { useToast } from '@shared/ui/toast/ToastProvider'
// import { supabase } from '@shared/api/supabase'
// import { Plus } from 'iconoir-react'

// type FormState = {
//   name: string
//   categoryId?: string | null
//   brandId?: string | null
//   model?: string
//   allow_individual_booking: boolean
//   total_quantity: number
//   active: boolean
//   notes?: string
//   price?: number | null
// }

// type Option = { id: string; name: string }

// export default function AddItemDialog({
//   open,
//   onOpenChange,
//   companyId,
//   mode = 'create',
//   initialData,
//   onSaved,
// }: {
//   open: boolean
//   onOpenChange: (v: boolean) => void
//   companyId: string
//   mode?: 'create' | 'edit'
//   initialData?: Partial<FormState> & { id?: string }
//   onSaved?: () => void
// }) {
//   const { success } = useToast()
//   const qc = useQueryClient()

//   const [form, setForm] = React.useState<FormState>({
//     name: '',
//     categoryId: null,
//     brandId: null,
//     model: '',
//     allow_individual_booking: true,
//     total_quantity: 0,
//     active: true,
//     notes: '',
//     price: undefined,
//   })

//   // When dialog opens in edit mode, prefill
//   React.useEffect(() => {
//     if (open && mode === 'edit' && initialData) {
//       setForm((s) => ({
//         ...s,
//         ...initialData,
//       }))
//     }
//   }, [open, mode, initialData])

//   const set = <TKey extends keyof FormState>(
//     key: TKey,
//     value: FormState[TKey],
//   ) => setForm((s) => ({ ...s, [key]: value }))

//   // ---- Load categories / brands ----
//   const { data: categories } = useQuery({
//     queryKey: ['company', companyId, 'item_categories'],
//     enabled: !!companyId && open,
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('item_categories')
//         .select('id, name')
//         .eq('company_id', companyId)
//         .order('name', { ascending: true })
//       if (error) throw error
//       return data as Array<Option>
//     },
//     staleTime: 60_000,
//   })

//   const { data: brands } = useQuery({
//     queryKey: ['company', companyId, 'item_brands'],
//     enabled: !!companyId && open,
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('item_brands')
//         .select('id, name')
//         .eq('company_id', companyId)
//         .order('name', { ascending: true })
//       if (error) throw error
//       return data as Array<Option>
//     },
//     staleTime: 60_000,
//   })

//   const mutation = useMutation({
//     mutationFn: async (f: FormState) => {
//       if (!companyId) throw new Error('No company selected')

//       if (mode === 'create') {
//         const { error } = await supabase.rpc('create_item_with_price', {
//           p_company_id: companyId,
//           p_name: f.name,
//           p_category_id: f.categoryId ?? null,
//           p_brand_id: f.brandId ?? null,
//           p_model: f.model || null,
//           p_allow_individual_booking: f.allow_individual_booking,
//           p_total_quantity: f.total_quantity || 0,
//           p_active: f.active,
//           p_notes: f.notes || null,
//           p_price: f.price ?? null,
//           p_effective_from: null,
//         })
//         if (error) throw error
//       } else if (mode === 'edit' && initialData?.id) {
//         // 1) update fields
//         const { error: uErr } = await supabase
//           .from('items')
//           .update({
//             name: f.name,
//             category_id: f.categoryId,
//             brand_id: f.brandId,
//             model: f.model,
//             allow_individual_booking: f.allow_individual_booking,
//             total_quantity: f.total_quantity,
//             active: f.active,
//             notes: f.notes,
//           })
//           .eq('id', initialData.id)
//           .eq('company_id', companyId)
//         if (uErr) throw uErr

//         // 2) check if price changed → insert price history
//         if (typeof f.price === 'number' && f.price !== initialData.price) {
//           const { error: phErr } = await supabase
//             .from('item_price_history')
//             .insert({
//               company_id: companyId,
//               item_id: initialData.id,
//               amount: f.price,
//               effective_from: new Date().toISOString(),
//               set_by: (await supabase.auth.getUser()).data.user?.id,
//             })
//           if (phErr) throw phErr
//         }
//       }
//     },
//     onSuccess: async () => {
//       await Promise.all([
//         qc.invalidateQueries({
//           queryKey: ['company', companyId, 'inventory-index'],
//           exact: false,
//         }),
//         qc.invalidateQueries({
//           queryKey: ['company', companyId, 'inventory-detail'],
//           exact: false,
//         }),
//       ])
//       onOpenChange(false)
//       onSaved?.()
//       success('Success!', mode === 'edit' ? 'Item updated' : 'Item created')
//     },
//   })

//   const handleSave = () => {
//     mutation.mutate(form)
//   }

//   return (
//     <Dialog.Root open={open} onOpenChange={onOpenChange}>
//       {mode === 'create' && (
//         <Dialog.Trigger>
//           <Button size="2" variant="classic">
//             <Plus /> Add item
//           </Button>
//         </Dialog.Trigger>
//       )}

//       <Dialog.Content maxWidth="640px">
//         <Dialog.Title>
//           {mode === 'edit' ? 'Edit item' : 'Add item to inventory'}
//         </Dialog.Title>

//         {/* … all your fields stay unchanged … */}

//         <Flex gap="2" mt="4" justify="end">
//           <Dialog.Close>
//             <Button variant="soft">Cancel</Button>
//           </Dialog.Close>

//           {/* Confirm before saving */}
//           <AlertDialog.Root>
//             <AlertDialog.Trigger asChild>
//               <Button
//                 disabled={!form.name || mutation.isPending}
//                 variant="classic"
//               >
//                 {mutation.isPending
//                   ? 'Saving…'
//                   : mode === 'edit'
//                     ? 'Save'
//                     : 'Create'}
//               </Button>
//             </AlertDialog.Trigger>
//             <AlertDialog.Content maxWidth="400px">
//               <AlertDialog.Title>Confirm save</AlertDialog.Title>
//               <AlertDialog.Description>
//                 Are you sure you want to{' '}
//                 {mode === 'edit'
//                   ? 'save changes to this item?'
//                   : 'create this item?'}
//               </AlertDialog.Description>
//               <Flex gap="3" mt="4" justify="end">
//                 <AlertDialog.Cancel>
//                   <Button variant="soft">Cancel</Button>
//                 </AlertDialog.Cancel>
//                 <AlertDialog.Action>
//                   <Button onClick={handleSave} variant="classic">
//                     Yes, confirm
//                   </Button>
//                 </AlertDialog.Action>
//               </Flex>
//             </AlertDialog.Content>
//           </AlertDialog.Root>
//         </Flex>
//       </Dialog.Content>
//     </Dialog.Root>
//   )
// }

// /** Small helper for tidy label + control layout */
// function Field({
//   label,
//   children,
// }: {
//   label: string
//   children: React.ReactNode
// }) {
//   return (
//     <div style={{ flex: '1 1', minWidth: 160 }}>
//       <Text
//         as="label"
//         size="2"
//         color="gray"
//         style={{ display: 'block', marginBottom: 6 }}
//       >
//         {label}
//       </Text>
//       {children}
//     </div>
//   )
// }

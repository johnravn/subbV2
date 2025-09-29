// src/features/inventory/components/AddInventoryDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Select, Text, TextField } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'

type FormState = {
  mode: 'item-bulk' | 'item-unique' | 'bundle'
  name: string
  unit?: string
  onHand?: number
}

export default function AddInventoryDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<FormState>({
    mode: 'item-bulk',
    name: '',
    unit: 'pcs',
    onHand: 0,
  })

  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (f.mode === 'bundle') {
        const { error } = await supabase
          .from('bundles')
          .insert({ company_id: companyId, name: f.name }) // 👈 include company
        if (error) throw error
        return
      }

      const kind = f.mode === 'item-bulk' ? 'bulk' : 'unique'
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .insert({ company_id: companyId, name: f.name, kind, unit: f.unit }) // 👈 include company
        .select()
        .single()
      if (itemErr) throw itemErr

      if (kind === 'bulk' && (f.onHand ?? 0) > 0) {
        const { error: stockErr } = await supabase
          .from('inventory_stock')
          .insert({
            company_id: companyId,
            item_id: item.id,
            on_hand: f.onHand,
          }) // 👈 include company
        if (stockErr) throw stockErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-index'] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>
        <Button size="2">Add</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add to inventory</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Create an item (bulk or unique) or a bundle.
        </Dialog.Description>

        <Flex direction="column" gap="3" mt="3">
          <div>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Type
            </Text>
            <Select.Root
              value={form.mode}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, mode: v as FormState['mode'] }))
              }
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="item-bulk">Item (bulk)</Select.Item>
                <Select.Item value="item-unique">Item (unique)</Select.Item>
                <Select.Item value="bundle">Bundle</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          <div>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Name
            </Text>
            <TextField.Root
              placeholder="e.g. XLR 3m"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>

          {form.mode !== 'bundle' && (
            <Flex gap="3" wrap="wrap">
              <div style={{ flex: '1 1 120px' }}>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Unit
                </Text>
                <TextField.Root
                  placeholder="pcs / m"
                  value={form.unit ?? ''}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, unit: e.target.value }))
                  }
                />
              </div>

              {form.mode === 'item-bulk' && (
                <div style={{ flex: '1 1 120px' }}>
                  <Text
                    as="label"
                    size="2"
                    color="gray"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    On hand (initial)
                  </Text>
                  <TextField.Root
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={String(form.onHand ?? 0)}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        onHand: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>
              )}
            </Flex>
          )}

          {createMutation.isError && (
            <Text color="red">
              {(createMutation.error as any)?.message ?? 'Failed'}
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
  )
}

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { upsertCustomer } from '../../api/queries'

export default function AddCustomerDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded?: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    vat_number: '',
    address: '',
    is_partner: false,
  })
  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return upsertCustomer({
        company_id: companyId,
        ...form,
      })
    },
    onSuccess: () => {
      onOpenChange(false)
      onAdded?.()
      success('Success', 'Customer added')
      // (table invalidation is done by parent)
    },
  })

  const canSave = form.name.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add customer</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Field label="Name">
            <TextField.Root
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Email">
            <TextField.Root
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <PhoneInputField
              id="signup-phone"
              value={form.phone}
              onChange={(val) => set('phone', val ?? '')} // <-- fix
              defaultCountry="NO"
              placeholder="Enter phone number"
            />
          </Field>
          <Field label="VAT number">
            <TextField.Root
              value={form.vat_number}
              onChange={(e) => set('vat_number', e.target.value)}
            />
          </Field>
          <Field label="Address">
            <TextArea
              rows={2}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Partner
            </Text>
            <Switch
              checked={form.is_partner}
              onCheckedChange={(v) => set('is_partner', !!v)}
            />
          </Flex>
        </Flex>

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending}
          >
            {mut.isPending ? 'Saving…' : 'Create'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

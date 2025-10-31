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
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { upsertCustomer } from '../../api/queries'

type Initial = {
  id: string
  name: string
  email: string
  phone: string
  vat_number: string
  address: string
  is_partner: boolean
}

export default function EditCustomerDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Initial
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  // Format VAT number on initial load
  const formatVATForInput = (vat: string | null | undefined): string => {
    if (!vat) return ''
    const formatted = fmtVAT(vat)
    return formatted === '—' ? '' : formatted
  }
  const [form, setForm] = React.useState<Initial>({
    ...initial,
    vat_number: formatVATForInput(initial.vat_number),
  })
  React.useEffect(() => {
    setForm({
      ...initial,
      vat_number: formatVATForInput(initial.vat_number),
    })
  }, [initial.id])
  const set = (k: keyof Initial, v: any) => setForm((s) => ({ ...s, [k]: v }))
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return upsertCustomer({
        id: form.id,
        company_id: companyId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        // Strip spaces before saving to DB
        vat_number: form.vat_number
          ? form.vat_number.replace(/[\s-]/g, '') || null
          : null,
        address: form.address || null,
        is_partner: !!form.is_partner,
      })
    },
    onSuccess: async () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Customer data saved')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit customer</Dialog.Title>
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
              onChange={(e) => {
                const input = e.target.value.replace(/[\s-]/g, '')
                // Only allow digits, max 9 digits
                if (input === '' || /^\d{0,9}$/.test(input)) {
                  // Format as "xxx xxx xxx" as user types
                  const formatted =
                    input.length <= 3
                      ? input
                      : input.length <= 6
                        ? `${input.slice(0, 3)} ${input.slice(3)}`
                        : `${input.slice(0, 3)} ${input.slice(3, 6)} ${input.slice(6)}`
                  set('vat_number', formatted)
                }
              }}
              placeholder="123 456 789"
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
            disabled={!form.name.trim() || mut.isPending}
          >
            {mut.isPending ? 'Saving…' : 'Save'}
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

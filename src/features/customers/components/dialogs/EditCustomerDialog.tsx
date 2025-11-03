import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Switch, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { upsertCustomer } from '../../api/queries'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'

type Initial = {
  id: string
  name: string
  email: string
  phone: string
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

  // Parse address from comma-separated string
  const parseAddress = React.useCallback((addr: string | null) => {
    if (!addr)
      return { address_line: '', zip_code: '', city: '', country: 'Norway' }
    const parts = addr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return {
      address_line: parts[0] || '',
      zip_code: parts[1] || '',
      city: parts[2] || '',
      country: parts[3] || 'Norway',
    }
  }, [])

  const [form, setForm] = React.useState({
    ...initial,
    ...parseAddress(initial.address),
  })

  React.useEffect(() => {
    if (!open) return
    setForm({
      ...initial,
      ...parseAddress(initial.address),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.id])

  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))
  const setAddr = (
    k: 'address_line' | 'zip_code' | 'city' | 'country',
    v: any,
  ) => setForm((s) => ({ ...s, [k]: v }))
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')

      // Build address string from components for the customer.address field
      const addressParts = [
        form.address_line,
        form.zip_code,
        form.city,
        form.country,
      ]
        .filter(Boolean)
        .join(', ')
      const addressString = addressParts || null

      return upsertCustomer({
        id: form.id,
        company_id: companyId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: addressString,
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
          <Field label="Address line">
            <TextField.Root
              value={form.address_line}
              onChange={(e) => setAddr('address_line', e.target.value)}
              placeholder="Street and number"
            />
          </Field>
          <FieldRow>
            <Flex gap={'2'} width={'100%'}>
              <Field label="ZIP">
                <NorwayZipCodeField
                  value={form.zip_code}
                  onChange={(val) => setAddr('zip_code', val)}
                  autoCompleteCity={(city) => setAddr('city', city)}
                />
              </Field>
              <Field label="City" style={{ flex: 1 }}>
                <TextField.Root
                  value={form.city}
                  onChange={(e) => setAddr('city', e.target.value)}
                  placeholder="e.g., Oslo"
                />
              </Field>
            </Flex>
          </FieldRow>
          <Field label="Country">
            <TextField.Root
              value={form.country}
              onChange={(e) => setAddr('country', e.target.value)}
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
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      {children}
    </Flex>
  )
}

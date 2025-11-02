import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import MapEmbed from '@shared/maps/MapEmbed'
import { supabase } from '@shared/api/supabase'
import { updateCompany } from '../../api/queries'
import type { CompanyDetail } from '../../api/queries'

type AddressForm = {
  address_line: string
  zip_code: string
  city: string
  country: string
}

type Initial = {
  id: string
  name: string
  vat_number: string
  general_email: string
  contact_person_id: string | null
}

export default function EditCompanyDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: CompanyDetail
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const formatVATForInput = (vat: string | null | undefined): string => {
    if (!vat) return ''
    const formatted = fmtVAT(vat)
    return formatted === '—' ? '' : formatted
  }

  // Parse address string into components
  const parseAddress = (addr: string | null): AddressForm => {
    if (!addr) {
      return {
        address_line: '',
        zip_code: '',
        city: '',
        country: 'Norway',
      }
    }
    // Try to parse a comma-separated address
    const parts = addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 4) {
      return {
        address_line: parts[0] || '',
        zip_code: parts[1] || '',
        city: parts[2] || '',
        country: parts[3] || 'Norway',
      }
    }
    // If not comma-separated, try common patterns or just put it all in address_line
    if (parts.length === 1) {
      return {
        address_line: parts[0] || '',
        zip_code: '',
        city: '',
        country: 'Norway',
      }
    }
    // Default: put in address_line
    return {
      address_line: addr,
      zip_code: '',
      city: '',
      country: 'Norway',
    }
  }

  const [form, setForm] = React.useState<Initial>({
    id: initial.id,
    name: initial.name,
    vat_number: formatVATForInput(initial.vat_number),
    general_email: initial.general_email ?? '',
    contact_person_id: initial.contact_person_id ?? null,
  })

  const [address, setAddress] = React.useState<AddressForm>(
    parseAddress(initial.address ?? null),
  )

  React.useEffect(() => {
    setForm({
      id: initial.id,
      name: initial.name,
      vat_number: formatVATForInput(initial.vat_number),
      general_email: initial.general_email ?? '',
      contact_person_id: initial.contact_person_id ?? null,
    })
    setAddress(parseAddress(initial.address ?? null))
  }, [initial.id])

  const set = (k: keyof Initial, v: any) => setForm((s) => ({ ...s, [k]: v }))
  const setAddrVal = <TKey extends keyof AddressForm>(
    key: TKey,
    value: AddressForm[TKey],
  ) => setAddress((s) => ({ ...s, [key]: value }))
  const { success, error } = useToast()

  // Build a single-line address for the map preview and saving
  const mapQuery = [
    address.address_line,
    address.zip_code,
    address.city,
    address.country,
  ]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ')

  // Combine address fields into single string for saving
  const combinedAddress = mapQuery || null

  // Load company users for contact person selection (only employees and owners)
  const { data: companyUsers = [] } = useQuery({
    queryKey: ['company', companyId, 'contact-person-candidates'],
    enabled: open && !!companyId,
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID')
      const { data, error: queryError } = await supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, phone, role')
        .eq('company_id', companyId)
        .in('role', ['employee', 'owner'])
        .order('display_name', { ascending: true })

      if (queryError) throw queryError
      return data as Array<{
        user_id: string
        display_name: string | null
        email: string
        phone: string | null
        role: string
      }>
    },
  })

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return updateCompany({
        companyId,
        id: form.id,
        name: form.name.trim(),
        address: combinedAddress,
        vat_number: form.vat_number
          ? form.vat_number.replace(/[\s-]/g, '') || null
          : null,
        general_email: form.general_email.trim() || null,
        contact_person_id: form.contact_person_id || null,
      })
    },
    onSuccess: () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Company data saved')
    },
    onError: (e: any) => {
      error('Failed to save', e?.message ?? 'Please try again.')
    },
  })

  const selectedContactPerson = companyUsers.find(
    (u) => u.user_id === form.contact_person_id,
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="520px"
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        <Dialog.Title>Edit company</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Field label="Company name">
            <TextField.Root
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </Field>

          <Separator size="4" />

          <Text as="div" size="2" weight="bold" mb="2">
            Address
          </Text>

          <Field label="Address line">
            <TextField.Root
              value={address.address_line}
              onChange={(e) => setAddrVal('address_line', e.target.value)}
              placeholder="Street and number"
            />
          </Field>

          <Grid columns="2" gap="3">
            <Field label="ZIP code">
              <TextField.Root
                value={address.zip_code}
                onChange={(e) => setAddrVal('zip_code', e.target.value)}
                placeholder="e.g., 0361"
              />
            </Field>
            <Field label="City">
              <TextField.Root
                value={address.city}
                onChange={(e) => setAddrVal('city', e.target.value)}
                placeholder="e.g., Oslo"
              />
            </Field>
          </Grid>

          <Field label="Country">
            <TextField.Root
              value={address.country}
              onChange={(e) => setAddrVal('country', e.target.value)}
              placeholder="e.g., Norway"
            />
          </Field>

          {/* Live map preview (only if we have something to show) */}
          {mapQuery && (
            <Box mt="2" style={{ maxWidth: 400 }}>
              <Text as="div" size="1" color="gray" mb="2">
                Map preview
              </Text>
              <MapEmbed query={mapQuery} zoom={15} />
            </Box>
          )}

          <Separator size="4" />

          <Field label="VAT number">
            <TextField.Root
              value={form.vat_number}
              onChange={(e) => {
                const input = e.target.value.replace(/[\s-]/g, '')
                if (input === '' || /^\d{0,9}$/.test(input)) {
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

          <Field label="General email">
            <TextField.Root
              type="email"
              value={form.general_email}
              onChange={(e) => set('general_email', e.target.value)}
              placeholder="company@example.com"
            />
          </Field>

          <Field label="Contact person">
            <Text as="div" size="1" color="gray" mb="2">
              The person to contact from this company (for system owner)
            </Text>
            <Select.Root
              value={form.contact_person_id || undefined}
              onValueChange={(val) => set('contact_person_id', val || null)}
            >
              <Select.Trigger placeholder="Select contact person" />
              <Select.Content>
                {companyUsers.map((u) => {
                  const extraParts = []
                  if (u.phone) {
                    extraParts.push(prettyPhone(u.phone))
                  }
                  if (u.email && u.display_name) {
                    extraParts.push(u.email)
                  }
                  const extra =
                    extraParts.length > 0 ? ` (${extraParts.join(', ')})` : ''

                  return (
                    <Select.Item key={u.user_id} value={u.user_id}>
                      {u.display_name || u.email}
                      {extra}
                    </Select.Item>
                  )
                })}
              </Select.Content>
            </Select.Root>
            {selectedContactPerson && (
              <Flex
                direction="column"
                gap="1"
                mt="2"
                style={{
                  padding: 8,
                  background: 'var(--gray-a2)',
                  borderRadius: 4,
                }}
              >
                <Text size="2" weight="medium">
                  {selectedContactPerson.display_name || 'No name'}
                </Text>
                {selectedContactPerson.email && (
                  <Text size="1" color="gray">
                    Email:{' '}
                    <a
                      href={`mailto:${selectedContactPerson.email}`}
                      style={{ color: 'inherit' }}
                    >
                      {selectedContactPerson.email}
                    </a>
                  </Text>
                )}
                {selectedContactPerson.phone && (
                  <Text size="1" color="gray">
                    Phone:{' '}
                    <a
                      href={`tel:${selectedContactPerson.phone}`}
                      style={{ color: 'inherit' }}
                    >
                      {prettyPhone(selectedContactPerson.phone)}
                    </a>
                  </Text>
                )}
              </Flex>
            )}
          </Field>
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

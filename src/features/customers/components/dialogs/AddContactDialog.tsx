import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { addContact } from '../../api/queries'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  customerId: string
  onSaved?: () => void
}

export default function AddContactDialog({
  open,
  onOpenChange,
  customerId,
  onSaved,
}: Props) {
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
  })
  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))

  const canSave = form.name.trim().length > 0
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () =>
      addContact({
        customer_id: customerId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        title: form.title.trim() || null,
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      onOpenChange(false)
      setForm({ name: '', email: '', phone: '', title: '', notes: '' })
      success('Success', 'Contact added to customer')
      onSaved?.()
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Add contact</Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Field label="Name *">
            <TextField.Root
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Contact full name"
              autoFocus
            />
          </Field>
          <Flex gap="3" wrap="wrap">
            <Field label="Email">
              <TextField.Root
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="email@example.com"
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
          </Flex>
          <Field label="Title / Role">
            <TextField.Root
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g., Project Manager, CFO"
            />
          </Field>
          <Field label="Notes">
            <TextArea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Additional information about this contact"
            />
          </Field>
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
    <div style={{ flex: '1 1', minWidth: 50 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

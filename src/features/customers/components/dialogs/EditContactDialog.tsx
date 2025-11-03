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
import { updateContact } from '../../api/queries'
import type { ContactRow } from '../../api/queries'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  contact: ContactRow | null
  onSaved?: () => void
}

export default function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: Props) {
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
  })
  React.useEffect(() => {
    if (!open || !contact) return
    setForm({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      title: contact.title ?? '',
      notes: contact.notes ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id])

  const set = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))

  const canSave = form.name.trim().length > 0
  const { success, error } = useToast()

  const mut = useMutation({
    mutationFn: async () =>
      updateContact({
        id: contact!.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        title: form.title.trim() || null,
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      onOpenChange(false)
      onSaved?.()
      success('Success', 'Contact info saved')
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit contact</Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Field label="Name *">
            <TextField.Root
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </Field>
          <Flex gap="3" wrap="wrap">
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
          </Flex>
          <Field label="Title / Role">
            <TextField.Root
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <TextArea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
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
    <div style={{ flex: '1 1', minWidth: 220 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

// src/features/jobs/components/dialogs/AddContactDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  RadioGroup,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import type { UUID } from '../../types'

export default function AddContactDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const [mode, setMode] = React.useState<'existing' | 'new'>('existing')
  const [contactId, setContactId] = React.useState<UUID | ''>('')
  const [role, setRole] = React.useState('')
  const [notes, setNotes] = React.useState('')

  // new contact fields
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [companyText, setCompanyText] = React.useState('')

  const { data: contacts = [] } = useQuery({
    queryKey: ['company', companyId, 'contacts'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{ id: UUID; name: string; email: string | null }>
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      let cid: UUID
      if (mode === 'existing') {
        if (!contactId) throw new Error('Pick a contact')
        cid = contactId
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            name: name.trim(),
            email: email || null,
            phone: phone || null,
            title: title || null,
            company_text: companyText || null,
          })
          .select('id')
          .single()
        if (error) throw error
        cid = data.id
      }
      const { error: linkErr } = await supabase.from('job_contacts').insert({
        job_id: jobId,
        contact_id: cid,
        role: role || null,
        notes: notes || null,
      })
      if (linkErr) throw linkErr
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      onOpenChange(false)
      setContactId('')
      setRole('')
      setNotes('')
      setName('')
      setEmail('')
      setPhone('')
      setTitle('')
      setCompanyText('')
    },
  })

  const disabled =
    save.isPending || (mode === 'existing' ? !contactId : !name.trim())

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Add contact</Dialog.Title>

        <RadioGroup.Root
          value={mode}
          onValueChange={(v) => setMode(v as any)}
          style={{ display: 'flex', gap: 12, margin: '8px 0 12px' }}
        >
          <RadioGroup.Item value="existing" /> <Text>Existing</Text>
          <RadioGroup.Item value="new" /> <Text>New</Text>
        </RadioGroup.Root>

        {mode === 'existing' ? (
          <Field label="Contact">
            <Select.Root
              value={contactId}
              onValueChange={(v) => setContactId(v)}
            >
              <Select.Trigger placeholder="Select…" />
              <Select.Content>
                {contacts.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.name} {c.email ? `· ${c.email}` : ''}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field>
        ) : (
          <>
            <Field label="Name">
              <TextField.Root
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <TextField.Root
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <TextField.Root
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Title">
              <TextField.Root
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Company text">
              <TextArea
                rows={2}
                value={companyText}
                onChange={(e) => setCompanyText(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Role on job">
          <TextField.Root
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Venue contact"
          />
        </Field>
        <Field label="Notes">
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={disabled}
          >
            {save.isPending ? 'Saving…' : 'Add'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export function EditContactDialog({
  open,
  onOpenChange,
  jobId,
  link,
  contact,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  link: { contact_id: UUID; role: string | null; notes: string | null }
  contact: {
    id: UUID
    name: string
    email: string | null
    phone: string | null
    title: string | null
    company_text: string | null
  }
}) {
  const qc = useQueryClient()
  const [role, setRole] = React.useState(link.role ?? '')
  const [notes, setNotes] = React.useState(link.notes ?? '')
  const [name, setName] = React.useState(contact.name)
  const [email, setEmail] = React.useState(contact.email ?? '')
  const [phone, setPhone] = React.useState(contact.phone ?? '')
  const [title, setTitle] = React.useState(contact.title ?? '')
  const [companyText, setCompanyText] = React.useState(
    contact.company_text ?? '',
  )

  React.useEffect(() => {
    if (!open) return
    setRole(link.role ?? '')
    setNotes(link.notes ?? '')
    setName(contact.name)
    setEmail(contact.email ?? '')
    setPhone(contact.phone ?? '')
    setTitle(contact.title ?? '')
    setCompanyText(contact.company_text ?? '')
  }, [open, link, contact])

  const save = useMutation({
    mutationFn: async () => {
      const [{ error: upLink }, { error: upContact }] = await Promise.all([
        supabase
          .from('job_contacts')
          .update({ role: role || null, notes: notes || null })
          .eq('job_id', jobId)
          .eq('contact_id', link.contact_id),
        supabase
          .from('contacts')
          .update({
            name: name.trim(),
            email: email || null,
            phone: phone || null,
            title: title || null,
            company_text: companyText || null,
          })
          .eq('id', contact.id),
      ])
      if (upLink) throw upLink
      if (upContact) throw upContact
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Edit contact</Dialog.Title>
        <Field label="Role on job">
          <TextField.Root
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Separator my="2" />
        <Text size="2" color="gray">
          Contact details
        </Text>
        <Field label="Name">
          <TextField.Root
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <TextField.Root
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <TextField.Root
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Title">
          <TextField.Root
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Company text">
          <TextArea
            rows={2}
            value={companyText}
            onChange={(e) => setCompanyText(e.target.value)}
          />
        </Field>
        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
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
    <div style={{ marginTop: 10 }}>
      <div style={{ color: 'var(--gray-11)', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

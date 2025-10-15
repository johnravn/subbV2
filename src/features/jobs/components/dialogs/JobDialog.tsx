// src/features/jobs/components/dialogs/JobDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import type { JobDetail, JobStatus, UUID } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  mode?: 'create' | 'edit'
  initialData?: JobDetail
  onSaved?: (id: UUID) => void
}

export default function JobDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  onSaved,
}: Props) {
  const qc = useQueryClient()

  const [title, setTitle] = React.useState(initialData?.title ?? '')
  const [description, setDescription] = React.useState(
    initialData?.description ?? '',
  )
  const [status, setStatus] = React.useState<JobStatus>(
    initialData?.status ?? 'planned',
  )
  const [startAt, setStartAt] = React.useState(initialData?.start_at ?? '')
  const [endAt, setEndAt] = React.useState(initialData?.end_at ?? '')
  const [loadInAt, setLoadInAt] = React.useState(initialData?.load_in_at ?? '')
  const [loadOutAt, setLoadOutAt] = React.useState(
    initialData?.load_out_at ?? '',
  )
  const [projectLead, setProjectLead] = React.useState<UUID | ''>(
    initialData?.project_lead_user_id ?? '',
  )
  const [customerId, setCustomerId] = React.useState<UUID | ''>(
    initialData?.customer_id ?? '',
  )
  const [addressId, setAddressId] = React.useState<UUID | ''>(
    initialData?.job_address_id ?? '',
  )

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    setTitle(initialData.title)
    setDescription(initialData.description ?? '')
    setStatus(initialData.status)
    setStartAt(initialData.start_at ?? '')
    setEndAt(initialData.end_at ?? '')
    setLoadInAt(initialData.load_in_at ?? '')
    setLoadOutAt(initialData.load_out_at ?? '')
    setProjectLead(initialData.project_lead_user_id ?? '')
    setCustomerId(initialData.customer_id ?? '')
    setAddressId(initialData.job_address_id ?? '')
  }, [open, mode, initialData])

  const { data: leads = [] } = useQuery({
    queryKey: ['company', companyId, 'project-leads'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
      if (error) throw error
      return data as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['company', companyId, 'customers'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{ id: UUID; name: string }>
    },
  })

  const { data: addresses = [] } = useQuery({
    queryKey: ['company', companyId, 'addresses'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('id, name, address_line, zip_code, city, country')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Array<{
        id: UUID
        name: string | null
        address_line: string
        zip_code: string
        city: string
        country: string
      }>
    },
  })

  const upsert = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        const { data, error } = await supabase
          .from('jobs')
          .insert({
            company_id: companyId,
            title: title.trim(),
            description: description || null,
            status,
            start_at: startAt || null,
            end_at: endAt || null,
            load_in_at: loadInAt || null,
            load_out_at: loadOutAt || null,
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            job_address_id: addressId || null,
          })
          .select('id')
          .single()
        if (error) throw error
        return data.id as UUID
      } else {
        if (!initialData) throw new Error('Missing initial data')
        const { error } = await supabase
          .from('jobs')
          .update({
            title: title.trim(),
            description: description || null,
            status,
            start_at: startAt || null,
            end_at: endAt || null,
            load_in_at: loadInAt || null,
            load_out_at: loadOutAt || null,
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            job_address_id: addressId || null,
          })
          .eq('id', initialData.id)
        if (error) throw error
        return initialData.id
      }
    },
    onSuccess: async (id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-index'], exact: false }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', id], exact: false }),
      ])
      onOpenChange(false)
      onSaved?.(id)
    },
  })

  const disabled = upsert.isPending || !title.trim()

  const addrLabel = (a: any) =>
    [a.name, a.address_line, a.zip_code, a.city].filter(Boolean).join(' · ')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="820px"
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>{mode === 'edit' ? 'Edit job' : 'New job'}</Dialog.Title>
        <Separator my="2" />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Title">
              <TextField.Root
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field label="Status">
              <Select.Root
                value={status}
                onValueChange={(v) => setStatus(v as JobStatus)}
              >
                <Select.Trigger />
                <Select.Content>
                  {(
                    [
                      'draft',
                      'planned',
                      'requested',
                      'confirmed',
                      'in_progress',
                      'completed',
                      'canceled',
                    ] as Array<JobStatus>
                  ).map((s) => (
                    <Select.Item key={s} value={s}>
                      {s}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>

            <Field label="Project lead">
              <Select.Root
                value={projectLead}
                onValueChange={(v) => setProjectLead(v)}
              >
                <Select.Trigger placeholder="None" />
                <Select.Content>
                  {leads.map((u) => (
                    <Select.Item key={u.user_id} value={u.user_id}>
                      {u.display_name ?? u.email}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>

            <Field label="Customer">
              <Select.Root
                value={customerId}
                onValueChange={(v) => setCustomerId(v)}
              >
                <Select.Trigger placeholder="None" />
                <Select.Content>
                  {customers.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {c.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>

            <Field label="Address">
              <Select.Root
                value={addressId}
                onValueChange={(v) => setAddressId(v)}
              >
                <Select.Trigger placeholder="None" />
                <Select.Content>
                  {addresses.map((a) => (
                    <Select.Item key={a.id} value={a.id}>
                      {addrLabel(a)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Start">
              <TextField.Root
                type="datetime-local"
                value={toLocalInput(startAt)}
                onChange={(e) => setStartAt(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="End">
              <TextField.Root
                type="datetime-local"
                value={toLocalInput(endAt)}
                onChange={(e) => setEndAt(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="Load-in">
              <TextField.Root
                type="datetime-local"
                value={toLocalInput(loadInAt)}
                onChange={(e) => setLoadInAt(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="Load-out">
              <TextField.Root
                type="datetime-local"
                value={toLocalInput(loadOutAt)}
                onChange={(e) => setLoadOutAt(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="Notes">
              <TextArea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => upsert.mutate()}
            disabled={disabled}
          >
            {upsert.isPending ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
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
    <div style={{ minWidth: 160 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}
function fromLocalInput(local: string) {
  if (!local) return ''
  // treat as local and convert to ISO
  const d = new Date(local)
  return d.toISOString()
}

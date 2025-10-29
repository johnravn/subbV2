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
import { upsertTimePeriod } from '@features/jobs/api/queries'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { useToast } from '@shared/ui/toast/ToastProvider'
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

  const { success, info, error } = useToast()

  const [title, setTitle] = React.useState(initialData?.title ?? '')
  const [description, setDescription] = React.useState(
    initialData?.description ?? '',
  )
  const [status, setStatus] = React.useState<JobStatus>(
    initialData?.status ?? 'planned',
  )
  const [startAt, setStartAt] = React.useState(initialData?.start_at ?? '')
  const [endAt, setEndAt] = React.useState(initialData?.end_at ?? '')
  const [projectLead, setProjectLead] = React.useState<UUID | ''>(
    initialData?.project_lead_user_id ?? '',
  )
  const [customerId, setCustomerId] = React.useState<UUID | ''>(
    initialData?.customer_id ?? '',
  )
  const [contactId, setContactId] = React.useState<UUID | ''>(
    initialData?.customer_contact_id ?? '',
  )

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    setTitle(initialData.title)
    setDescription(initialData.description ?? '')
    setStatus(initialData.status)
    setStartAt(initialData.start_at ?? '')
    setEndAt(initialData.end_at ?? '')
    setProjectLead(initialData.project_lead_user_id ?? '')
    setCustomerId(initialData.customer_id ?? '')
    setContactId(initialData.customer_contact_id ?? '')
  }, [open, mode, initialData])

  React.useEffect(() => {
    setContactId('') // clear previous selection if customer changes
  }, [customerId])

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

  const { data: contacts = [], isFetching: contactsLoading } = useQuery({
    queryKey: ['company', companyId, 'customer', customerId, 'contacts'],
    enabled: open && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<{
        id: UUID
        name: string
        email: string | null
        phone: string | null
      }>
    },
  })

  const contactLabel = (c: {
    name: string
    email: string | null
    phone: string | null
  }) => [c.name, c.email, c.phone].filter(Boolean).join(' · ')

  // ...unchanged imports
  // const { success, info, error } = useToast()  // you already have this

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
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            customer_contact_id: contactId || null,
          })
          .select('id')
          .single()
        if (error) throw error

        if (startAt && endAt) {
          try {
            await upsertTimePeriod({
              job_id: data.id,
              company_id: companyId,
              title: 'Job duration',
              status: jobStatusToTimePeriodStatus(status),
              start_at: startAt,
              end_at: endAt,
            })
          } catch (e: any) {
            // Don’t fail the whole job create if time period fails — just inform the user.
            // You already have `useToast()` in this component.
            console.warn('Failed to create Job duration time period', e)
          }
        }

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
            project_lead_user_id: projectLead || null,
            customer_id: customerId || null,
            customer_contact_id: contactId || null,
          })
          .eq('id', initialData.id)
        if (error) throw error
        // Keep the "Job duration" reservation in sync with the job when editing
        if (startAt && endAt) {
          // Find existing "Job duration" reservation for this job (if any)
          const { data: existing, error: exErr } = await supabase
            .from('time_periods')
            .select('id')
            .eq('job_id', initialData.id)
            .eq('title', 'Job duration')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (exErr) throw exErr

          // Upsert with new window + mapped status
          await upsertTimePeriod({
            id: existing?.id, // update if found, else create
            job_id: initialData.id,
            company_id: companyId,
            title: 'Job duration',
            status: jobStatusToTimePeriodStatus(status),
            start_at: startAt,
            end_at: endAt,
          })
        } else {
          // If job no longer has a time window, softly hide any existing "Job duration"
          await supabase
            .from('time_periods')
            .update({ deleted: true })
            .eq('job_id', initialData.id)
            .eq('title', 'Job duration')
        }

        return initialData.id
      }
    },
    onSuccess: async (id) => {
      const action = mode === 'create' ? 'created' : 'updated'
      // fire toast first so the user sees it even if the dialog closes quickly
      success(`Job ${action}`, `“${title.trim()}” was ${action} successfully.`)

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-index'], exact: false }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', id], exact: false }),
        qc.invalidateQueries({
          queryKey: ['jobs', id, 'time_periods'],
          exact: false,
        }),
      ])

      onOpenChange(false)
      onSaved?.(id)
    },
    onError: (e: any) => {
      error('Failed to save job', e?.message ?? 'Please try again.')
      // (Optional) keep the dialog open so they can fix inputs
      // You already keep it open by default on error since onOpenChange(false) is only in onSuccess
    },
  })

  const disabled = upsert.isPending || !title.trim()

  const addrLabel = (a: any) =>
    [a.name, a.address_line, a.zip_code, a.city].filter(Boolean).join(' · ')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="820px"
        style={{ display: 'flex', flexDirection: 'column' }}
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

            <Flex wrap={'wrap'}>
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
                        'invoiced',
                        'paid',
                      ] as Array<JobStatus>
                    ).map((s) => (
                      <Select.Item key={s} value={s}>
                        {makeWordPresentable(s)}
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
            </Flex>

            <Flex wrap={'wrap'}>
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

              <Field label="Main contact">
                <Select.Root
                  value={contactId}
                  onValueChange={(v) => setContactId(v)}
                  disabled={
                    !customerId || contactsLoading || contacts.length === 0
                  }
                >
                  <Select.Trigger
                    placeholder={
                      !customerId
                        ? 'Select a customer first'
                        : contactsLoading
                          ? 'Loading…'
                          : contacts.length === 0
                            ? 'No contacts found'
                            : 'None'
                    }
                  />
                  <Select.Content>
                    {contacts.map((c) => (
                      <Select.Item key={c.id} value={c.id}>
                        {contactLabel(c)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
            </Flex>
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
            onClick={() => {
              if (!title.trim()) {
                return error('Missing title', 'Please enter a job title.')
              }
              upsert.mutate()
            }}
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

function jobStatusToTimePeriodStatus(
  s: string,
):
  | 'tentative'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled' {
  switch (s) {
    case 'requested':
      return 'requested'
    case 'confirmed':
      return 'confirmed'
    case 'in_progress':
      return 'in_progress'
    case 'completed':
      return 'completed'
    case 'canceled':
      return 'canceled'
    default:
      return 'tentative' // draft/planned/invoiced/paid → tentative
  }
}

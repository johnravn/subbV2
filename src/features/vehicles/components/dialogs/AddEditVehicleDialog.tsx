import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Progress,
  Select,
  Separator,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Camera } from 'iconoir-react'
import { partnerCustomersQuery, upsertVehicle } from '../../api/queries'
import type { FuelType } from '../../api/queries'

type Mode = 'create' | 'edit'
type Initial = {
  id: string
  name: string
  registration_no: string
  fuel: FuelType | null
  internally_owned: boolean
  external_owner_id: string | null
  image_path: string | null
  notes: string
}

export default function AddEditVehicleDialog({
  open,
  onOpenChange,
  mode = 'create',
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode?: Mode
  initial?: Initial
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const { success, info, error } = useToast()
  const qc = useQueryClient()

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [form, setForm] = React.useState({
    name: '',
    registration_no: '',
    fuel: null as FuelType | null,
    internally_owned: true,
    external_owner_id: null as string | null,
    image_path: null as string | null,
    notes: '',
  })
  const set = <TKey extends keyof typeof form>(
    k: TKey,
    v: (typeof form)[TKey],
  ) => setForm((s) => ({ ...s, [k]: v }))

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initial) return
    setForm({
      name: initial.name,
      registration_no: initial.registration_no,
      fuel: initial.fuel,
      internally_owned: initial.internally_owned,
      external_owner_id: initial.external_owner_id ?? null,
      image_path: initial.image_path ?? null,
      notes: initial.notes,
    })
  }, [open, mode, initial?.id])

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId: companyId ?? '__none__' }),
    enabled: !!companyId && open,
  })

  const [uploading, setUploading] = React.useState(false)

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `${Date.now()}.${ext}`
      const path = `${companyId}/${fileName}`

      const { error: upErr } = await supabase.storage
        .from('vehicle_images') // ⬅️ make sure this bucket exists
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (upErr) throw upErr

      set('image_path', path)
      info('Photo uploaded', 'Remember to Save to apply.')
      return path
    } finally {
      setUploading(false)
    }
  }

  const imageUrl = React.useMemo(() => {
    if (!form.image_path) return null
    const { data } = supabase.storage
      .from('vehicle_images')
      .getPublicUrl(form.image_path)
    return data.publicUrl
  }, [form.image_path])

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      // If internal, clear external_owner_id
      const payload = {
        company_id: companyId,
        id: initial?.id,
        name: form.name.trim(),
        registration_no: form.registration_no.trim() || null,
        fuel: form.fuel,
        internally_owned: form.internally_owned,
        external_owner_id: form.internally_owned
          ? null
          : form.external_owner_id,
        image_path: form.image_path,
        notes: form.notes.trim() || null,
      }
      return upsertVehicle(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicles-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicle-detail'],
          exact: false,
        }),
      ])
      success(
        mode === 'edit' ? 'Saved' : 'Vehicle created',
        mode === 'edit' ? 'Vehicle updated.' : 'Vehicle added.',
      )
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: any) => error('Failed', e?.message ?? 'Please try again.'),
  })

  const canSave = form.name.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="680px">
        <Dialog.Title>
          {mode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}
        </Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          <Flex gap="3" wrap="wrap">
            <Field label="Name *">
              <TextField.Root
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Reg number">
              <TextField.Root
                value={form.registration_no}
                onChange={(e) => set('registration_no', e.target.value)}
              />
            </Field>
          </Flex>

          <Flex gap="3" wrap="wrap">
            <Field label="Fuel">
              <Select.Root
                value={form.fuel ?? ''}
                onValueChange={(v) =>
                  set('fuel', (v || null) as FuelType | null)
                }
                size="3"
              >
                <Select.Trigger
                  placeholder="Select fuel"
                  style={{ minHeight: 'var(--space-7)' }}
                />
                <Select.Content>
                  <Select.Item value="electric">electric</Select.Item>
                  <Select.Item value="diesel">diesel</Select.Item>
                  <Select.Item value="petrol">petrol</Select.Item>
                </Select.Content>
              </Select.Root>
            </Field>

            <Field label="Internally owned">
              <Flex align="center" gap="2" style={{ height: 'var(--space-7)' }}>
                <Switch
                  checked={form.internally_owned}
                  onCheckedChange={(v) => set('internally_owned', !!v)}
                />
                <Text size="2" color="gray">
                  {form.internally_owned ? 'Yes' : 'No'}
                </Text>
              </Flex>
            </Field>

            <Field label="External owner (partner)">
              <Select.Root
                value={form.external_owner_id as string}
                onValueChange={(v) => set('external_owner_id', v || null)}
                size="3"
                disabled={form.internally_owned}
              >
                <Select.Trigger
                  placeholder={
                    form.internally_owned
                      ? 'Internal (disabled)'
                      : 'Select partner'
                  }
                  style={{ minHeight: 'var(--space-7)' }}
                />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Your company</Select.Label>
                    <Select.Item value=" ">Internal (your company)</Select.Item>
                  </Select.Group>
                  <Separator my="1" />
                  <Select.Group>
                    <Select.Label>Partners</Select.Label>
                    {partners.map((p) => (
                      <Select.Item key={p.id} value={p.id}>
                        {p.name}
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field>
          </Flex>

          <Field label="Image">
            {/* Hidden input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  await uploadImage(file)
                } catch (e: any) {
                  error('Upload failed', e?.message ?? 'Try another image.')
                } finally {
                  // allow selecting the same file again later
                  e.currentTarget.value = ''
                }
              }}
            />

            {/* Preview */}
            <div
              style={{
                width: 320,
                height: 180,
                borderRadius: 8,
                border: '1px solid var(--gray-a6)',
                background: '(--gray-a11)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Vehicle"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Text
                  size="2"
                  color="gray"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {/* Use your <Car /> icon if you have it instead of Camera */}
                  <Camera width={18} height={18} />
                  No image
                </Text>
              )}
            </div>

            {/* Actions */}
            <Flex gap="2" align="center" wrap="wrap">
              <Button
                size="2"
                variant="soft"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Flex gap="2" align="center">
                  <Camera width={16} height={16} />
                  {uploading
                    ? 'Uploading…'
                    : imageUrl
                      ? 'Change photo'
                      : 'Add photo'}
                </Flex>
              </Button>

              {form.image_path && (
                <Button
                  size="2"
                  variant="ghost"
                  color="red"
                  onClick={() => set('image_path', null)}
                  disabled={uploading}
                >
                  Remove photo
                </Button>
              )}
            </Flex>

            {uploading && (
              <div style={{ width: 220, marginTop: 8 }}>
                <Progress /> {/* indeterminate */}
              </div>
            )}
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
            <Button variant="soft" disabled={mut.isPending || uploading}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending || uploading}
          >
            {mut.isPending ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
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

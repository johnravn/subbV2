// src/pages/ProfilePage.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Progress,
  Avatar as RadixAvatar,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Camera } from 'iconoir-react'
import { PhoneInputField } from '@shared/phone/PhoneInputField'

type ProfileRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  phone: string | null
  avatar_url: string | null // storage path, e.g. "userId/1696272000.png"
  bio: string | null
  preferences: any | null // JSONB with optional fields
}

// Shape for the optional fields that live in preferences
type OptionalFields = {
  address?: string | null
  date_of_birth?: string | null // ISO date string "YYYY-MM-DD"
  drivers_license?: string | null // free text (e.g., "B, BE")
  licenses?: Array<string> | null
  certificates?: Array<string> | null
  notes?: string | null
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
  // put this near the top of the component
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)

  // 1) get current user
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })

  // 2) load profile
  const { data, isLoading, isError, error } = useQuery<ProfileRow | null>({
    queryKey: ['profile', authUser?.id ?? '__none__'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'user_id,email,first_name,last_name,display_name,phone,avatar_url,bio,preferences',
        )
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (error) throw error
      return data as ProfileRow
    },
  })

  // 3) local form state
  const [form, setForm] = React.useState({
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    // optional fields in preferences
    address: '',
    date_of_birth: '',
    drivers_license: '',
    licensesCsv: '',
    certificatesCsv: '',
    notes: '',
    avatarPath: '' as string | null, // storage path saved in avatar_url
  })

  // hydrate form from query data
  React.useEffect(() => {
    if (!data) return
    const prefs: OptionalFields = data.preferences ?? {}
    const licensesCsv = (prefs.licenses ?? []).join(', ')
    const certificatesCsv = (prefs.certificates ?? []).join(', ')
    setForm({
      display_name: data.display_name ?? '',
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      bio: data.bio ?? '',
      address: prefs.address ?? '',
      date_of_birth: prefs.date_of_birth ?? '',
      drivers_license: prefs.drivers_license ?? '',
      licensesCsv,
      certificatesCsv,
      notes: prefs.notes ?? '',
      avatarPath: data.avatar_url ?? null,
    })
  }, [data])

  // 4) avatar upload
  const uploadAvatar = async (file: File) => {
    if (!authUser?.id) throw new Error('Not authenticated')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const fileName = `${Date.now()}.${ext}`
    const path = `${authUser.id}/${fileName}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
    if (upErr) throw upErr

    // store the path (not the full public URL) in profiles.avatar_url
    return path
  }

  const mut = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!authUser?.id) throw new Error('Not authenticated')

      // CSV -> arrays
      const licenses = f.licensesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const certificates = f.certificatesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const preferences = {
        address: f.address || null,
        date_of_birth: f.date_of_birth || null, // "YYYY-MM-DD"
        drivers_license: f.drivers_license || null,
        licenses: licenses.length ? licenses : null,
        certificates: certificates.length ? certificates : null,
        notes: f.notes || null,
      }

      const { data: updated, error: rpcErr } = await supabase.rpc(
        'update_my_profile',
        {
          p_display_name: f.display_name || null,
          p_first_name: f.first_name || null,
          p_last_name: f.last_name || null,
          p_phone: f.phone || null,
          p_bio: f.bio || null,
          p_avatar_path: f.avatarPath || null, // storage path from upload
          p_preferences: preferences as any, // jsonb
        },
      )

      if (rpcErr) throw rpcErr
      return updated as ProfileRow
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
      success('Saved', 'Your profile has been updated.')
    },
    onError: (e: any) => {
      toastError('Save failed', e?.message ?? 'Please try again.')
    },
  })

  // helper to get public URL for the avatar
  const avatarUrl = React.useMemo(() => {
    if (!form.avatarPath) return null
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(form.avatarPath)
    return urlData.publicUrl
  }, [form.avatarPath])

  function set<TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  if (isLoading) {
    return (
      <Box p="4">
        <Text>Loading…</Text>
      </Box>
    )
  }
  if (isError || !data) {
    return (
      <Box p="4">
        <Text color="red">
          Failed to load profile. {error ? String((error as any).message) : ''}
        </Text>
      </Box>
    )
  }

  return (
    <Box p="4" style={{ width: '100%' }}>
      <Grid columns={{ initial: '1' }} mt="5" width="100%">
        <Card size="4">
          <Flex direction="column" gap="4">
            <Flex align="center" justify="between" wrap="wrap" gap="3">
              <Flex align="center" gap="3">
                <Avatar
                  src={avatarUrl ?? undefined}
                  initials={initials(form.display_name || data.email)}
                />
                <Box>
                  <Heading size="4">{form.display_name || data.email}</Heading>
                  <Text as="div" color="gray" size="2">
                    {data.email}
                  </Text>
                </Box>
              </Flex>

              <Flex
                direction="column"
                align="end"
                gap="2"
                style={{ minWidth: 180 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploading(true)
                    try {
                      const path = await uploadAvatar(file)
                      set('avatarPath', path)
                      info('Photo uploaded', 'Remember to hit Save to apply.')
                    } catch (e: any) {
                      toastError(
                        'Upload failed',
                        e?.message ?? 'Try another image.',
                      )
                    } finally {
                      setUploading(false)
                      e.currentTarget.value = ''
                    }
                  }}
                />

                <Button
                  size="2"
                  variant="soft"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Flex gap="2" align="center">
                    <Camera width={16} height={16} />
                    {uploading ? 'Uploading…' : 'Change photo'}
                  </Flex>
                </Button>

                {uploading && (
                  <Box style={{ width: 200 }}>
                    {/* Indeterminate progress: omit value to show animated bar */}
                    <Progress />
                  </Box>
                )}
              </Flex>
            </Flex>

            <Separator />

            {/* Name & contact */}
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              <Field label="Display name">
                <TextField.Root
                  value={form.display_name}
                  onChange={(e) => set('display_name', e.target.value)}
                  placeholder="Shown in the app"
                />
              </Field>
              <Field label="Phone">
                <PhoneInputField
                  value={form.phone || undefined}
                  onChange={(v) => set('phone', v ?? '')}
                  defaultCountry="NO"
                />
              </Field>
              <Field label="First name">
                <TextField.Root
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                />
              </Field>
              <Field label="Last name">
                <TextField.Root
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                />
              </Field>
            </Grid>

            <Field label="Bio">
              <TextArea
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Short description about you…"
                rows={3}
              />
            </Field>

            <Separator />

            {/* Optional details (preferences JSON) */}
            <Heading size="3">Optional details</Heading>
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              <Field label="Address">
                <TextField.Root
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Street, number, ZIP, city"
                />
              </Field>
              <Field label="Date of birth">
                <TextField.Root
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                />
              </Field>
              <Field label="Driver’s license">
                <TextField.Root
                  value={form.drivers_license}
                  onChange={(e) => set('drivers_license', e.target.value)}
                  placeholder="e.g., B, BE"
                />
              </Field>
              <Field label="Other licenses (comma separated)">
                <TextField.Root
                  value={form.licensesCsv}
                  onChange={(e) => set('licensesCsv', e.target.value)}
                  placeholder="e.g., Lift, Forklift"
                />
              </Field>
              <Field label="Certificates (comma separated)">
                <TextField.Root
                  value={form.certificatesCsv}
                  onChange={(e) => set('certificatesCsv', e.target.value)}
                  placeholder="e.g., HSE, First aid"
                />
              </Field>
              <Field label="Other notes">
                <TextArea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                />
              </Field>
            </Grid>

            <Flex justify="end" mt="2" gap="3">
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={() => {
                  // reset from server data
                  qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
                }}
                disabled={mut.isPending}
              >
                Reset
              </Button>
              <Button
                size="2"
                onClick={() => mut.mutate(form)}
                disabled={mut.isPending}
              >
                {mut.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Grid>
    </Box>
  )
}

/* ---------- Small helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Text as="div" size="2" color="gray" mb="1">
        {label}
      </Text>
      {children}
    </Box>
  )
}

function Avatar({ src, initials }: { src?: string; initials: string }) {
  return (
    <RadixAvatar
      size="5"
      radius="full"
      fallback={initials}
      src={src}
      style={{ border: '1px solid var(--gray-5)' }}
    />
  )
}

function initials(displayOrEmail: string) {
  const base = displayOrEmail.trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  if (base.includes('@')) return base[0].toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

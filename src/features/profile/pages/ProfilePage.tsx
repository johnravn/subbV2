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
import MapEmbed from '@shared/maps/MapEmbed' // <- ensure this path fits your project

type ProfileRow = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  preferences: any | null
  primary_address_id: string | null
  // Nested via FK select (see query below)
  addresses?: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

type OptionalFields = {
  date_of_birth?: string | null
  drivers_license?: string | null
  licenses?: Array<string> | null
  certificates?: Array<string> | null
  notes?: string | null
}

type AddressForm = {
  id: string | null
  name: string
  address_line: string
  zip_code: string
  city: string
  country: string
}

const FIELD_MAX = 420

export default function ProfilePage() {
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()
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

  // 2) load profile (+ joined primary address)
  const { data, isLoading, isError, error } = useQuery<ProfileRow | null>({
    queryKey: ['profile', authUser?.id ?? '__none__'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          first_name,
          last_name,
          display_name,
          phone,
          avatar_url,
          bio,
          preferences,
          primary_address_id,
          addresses:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ProfileRow
    },
  })

  // 3) local form state
  const [form, setForm] = React.useState({
    // personal
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatarPath: '' as string | null,
    // optional (preferences)
    date_of_birth: '',
    drivers_license: '',
    licensesCsv: '',
    certificatesCsv: '',
    notes: '',
  })

  const [addr, setAddr] = React.useState<AddressForm>({
    id: null,
    name: '',
    address_line: '',
    zip_code: '',
    city: '',
    country: 'Norway',
  })

  // hydrate from query data
  React.useEffect(() => {
    if (!data) return

    // optional fields moved out of address (address now normalized)
    const prefs: OptionalFields = data.preferences ?? {}
    const licensesCsv = (prefs.licenses ?? []).join(', ')
    const certificatesCsv = (prefs.certificates ?? []).join(', ')

    setForm((s) => ({
      ...s,
      display_name: data.display_name ?? '',
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      bio: data.bio ?? '',
      avatarPath: data.avatar_url ?? null,
      date_of_birth: prefs.date_of_birth ?? '',
      drivers_license: prefs.drivers_license ?? '',
      licensesCsv,
      certificatesCsv,
      notes: prefs.notes ?? '',
    }))

    const a = data.addresses
    setAddr({
      id: a?.id ?? null,
      name: a?.name ?? '',
      address_line: a?.address_line ?? '',
      zip_code: a?.zip_code ?? '',
      city: a?.city ?? '',
      country: a?.country ?? 'Norway',
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
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) throw upErr
    return path // storage path
  }

  // 5) save
  const mut = useMutation({
    mutationFn: async () => {
      if (!authUser?.id) throw new Error('Not authenticated')

      // CSV -> arrays
      const licenses = form.licensesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const certificates = form.certificatesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const addressName: string = data?.display_name + '´s home'

      // 5a) Upsert address (normalized)
      // If we have an id, update; else insert a new row
      let addressId = addr.id
      const cleanAddress = {
        name: addressName,
        address_line: addr.address_line,
        zip_code: addr.zip_code,
        city: addr.city,
        country: addr.country,
      }

      if (addressId) {
        const { error: updErr } = await supabase
          .from('addresses')
          .update(cleanAddress)
          .eq('id', addressId)
        if (updErr) throw updErr
      } else if (
        addr.address_line &&
        addr.city &&
        addr.zip_code &&
        addr.country
      ) {
        const { data: inserted, error: insErr } = await supabase
          .from('addresses')
          .insert([{ ...cleanAddress }])
          .select('id')
          .single()
        if (insErr) throw insErr
        addressId = inserted.id
        setAddr((s) => ({ ...s, id: inserted.id }))
      }

      // 5b) Set primary_address_id on profile (separate simple update)
      if (addressId) {
        const { error: linkErr } = await supabase
          .from('profiles')
          .update({ primary_address_id: addressId })
          .eq('user_id', authUser.id)
        if (linkErr) throw linkErr
      }

      // 5c) Update profile core + preferences (note: address removed from preferences)
      const preferences = {
        date_of_birth: form.date_of_birth || null,
        drivers_license: form.drivers_license || null,
        licenses: licenses.length ? licenses : null,
        certificates: certificates.length ? certificates : null,
        notes: form.notes || null,
      }

      const { error: rpcErr } = await supabase.rpc('update_my_profile', {
        p_display_name: form.display_name || null,
        p_first_name: form.first_name || null,
        p_last_name: form.last_name || null,
        p_phone: form.phone || null,
        p_bio: form.bio || null,
        p_avatar_path: form.avatarPath || null,
        p_preferences: preferences as any,
      })
      if (rpcErr) throw rpcErr
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

  const set = <TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const setAddrVal = <TKey extends keyof AddressForm>(
    key: TKey,
    value: AddressForm[TKey],
  ) => setAddr((s) => ({ ...s, [key]: value }))

  // Build a single-line address for the map preview
  const mapQuery = [addr.address_line, addr.zip_code, addr.city, addr.country]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(', ')

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
    <Card size="4" style={{ minHeight: 0, overflow: 'auto' }}>
      {/* Header */}
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

        <Flex direction="column" align="end" gap="2" style={{ minWidth: 180 }}>
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
                toastError('Upload failed', e?.message ?? 'Try another image.')
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
              <Progress />
            </Box>
          )}
        </Flex>
      </Flex>

      <Separator />

      {/* Three columns: personal (left), address (middle), optional (right) */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Flex direction="column" gap="4" p="4">
          <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
            {/* LEFT: Personal information */}
            <Column title="Personal information">
              <Field label="Display name" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={form.display_name}
                  onChange={(e) => set('display_name', e.target.value)}
                  placeholder="Shown in the app"
                />
              </Field>
              <Field label="Phone" maxWidth={FIELD_MAX}>
                <PhoneInputField
                  value={form.phone || undefined}
                  onChange={(v) => set('phone', v ?? '')}
                  defaultCountry="NO"
                />
              </Field>
              <FieldRow>
                <Field label="First name" maxWidth={FIELD_MAX}>
                  <TextField.Root
                    value={form.first_name}
                    onChange={(e) => set('first_name', e.target.value)}
                  />
                </Field>
                <Field label="Last name" maxWidth={FIELD_MAX}>
                  <TextField.Root
                    value={form.last_name}
                    onChange={(e) => set('last_name', e.target.value)}
                  />
                </Field>
              </FieldRow>
              <Field label="Bio" maxWidth={680}>
                <TextArea
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  placeholder="Short description about you…"
                  rows={5}
                />
              </Field>
            </Column>

            {/* MIDDLE: Address (normalized) */}
            <Column title="Address">
              {/* <Field label="Label (home, office…)" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={addr.name}
                  onChange={(e) => setAddrVal('name', e.target.value)}
                  placeholder="e.g., Home"
                />
              </Field> */}
              <Field label="Address line" maxWidth={520}>
                <TextField.Root
                  value={addr.address_line}
                  onChange={(e) => setAddrVal('address_line', e.target.value)}
                  placeholder="Street and number"
                />
              </Field>
              <FieldRow>
                <Flex gap={'2'} width={'100%'}>
                  <Field label="ZIP" maxWidth={100}>
                    <TextField.Root
                      value={addr.zip_code}
                      onChange={(e) => setAddrVal('zip_code', e.target.value)}
                      placeholder="e.g., 0361"
                    />
                  </Field>
                  <Field label="City" maxWidth={FIELD_MAX}>
                    <TextField.Root
                      value={addr.city}
                      onChange={(e) => setAddrVal('city', e.target.value)}
                      placeholder="e.g., Oslo"
                    />
                  </Field>
                </Flex>
              </FieldRow>
              <Field label="Country" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={addr.country}
                  onChange={(e) => setAddrVal('country', e.target.value)}
                />
              </Field>

              {/* Live map preview (only if we have something to show) */}
              {mapQuery && (
                <Box mt="2" style={{ maxWidth: 520 }}>
                  <MapEmbed query={mapQuery} zoom={15} />
                </Box>
              )}
            </Column>

            {/* RIGHT: Optional info */}
            <Column title="Optional details">
              <Field label="Date of birth" maxWidth={FIELD_MAX}>
                <TextField.Root
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                />
              </Field>
              <Field label="Driver’s license" maxWidth={FIELD_MAX}>
                <TextField.Root
                  value={form.drivers_license}
                  onChange={(e) => set('drivers_license', e.target.value)}
                  placeholder="e.g., B, BE"
                />
              </Field>
              <Field label="Other licenses (comma separated)" maxWidth={520}>
                <TextField.Root
                  value={form.licensesCsv}
                  onChange={(e) => set('licensesCsv', e.target.value)}
                  placeholder="e.g., Lift, Forklift"
                />
              </Field>
              <Field label="Certificates (comma separated)" maxWidth={520}>
                <TextField.Root
                  value={form.certificatesCsv}
                  onChange={(e) => set('certificatesCsv', e.target.value)}
                  placeholder="e.g., HSE, First aid"
                />
              </Field>
              <Field label="Other notes" maxWidth={520}>
                <TextArea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={5}
                />
              </Field>
            </Column>
          </Grid>
        </Flex>
      </div>

      {/* <Separator /> */}

      {/* Footer actions */}
      <Flex justify="end" gap="3" p="3">
        <Button
          size="2"
          variant="soft"
          color="gray"
          onClick={() =>
            qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
          }
          disabled={mut.isPending}
        >
          Reset
        </Button>
        <Button size="2" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Flex>
    </Card>
  )
}

/* ---------- Small helpers ---------- */

function Column({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Heading size="3" mb="2">
        {title}
      </Heading>
      <Flex direction="column" gap="3">
        {children}
      </Flex>
    </Box>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Flex wrap="wrap" gap="3" style={{ alignItems: 'start' }}>
      {children}
    </Flex>
  )
}

function Field({
  label,
  children,
  maxWidth = FIELD_MAX,
}: {
  label: string
  children: React.ReactNode
  maxWidth?: number
}) {
  return (
    <Box style={{ maxWidth, width: 'min(100%, ' + maxWidth + 'px)' }}>
      <Text as="div" size="2" color="gray" mb="1">
        {label}
      </Text>
      <Box style={{ width: '100%' }}>{children}</Box>
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

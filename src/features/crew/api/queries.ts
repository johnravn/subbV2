// src/features/crew/api/queries.ts
import { QueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type CrewKind = 'employee' | 'freelancer' | 'owner'
export type CrewPerson = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  role: CrewKind | 'super_user'
}

export type PendingInvite = {
  id: string
  email: string
  role: string
  inviter_user_id: string
  inviter_name: string | null
  created_at: string
  expires_at: string
}

export type CrewOptionalFields = {
  date_of_birth?: string | null
  drivers_license?: string | null
  licenses?: Array<string> | null
  certificates?: Array<string> | null
  notes?: string | null
}

// Keep your existing types (CrewPerson, CrewKind)

export function crewIndexQuery({
  companyId,
  kind,
}: {
  companyId: string
  kind?: CrewKind | 'all'
}) {
  return {
    queryKey: ['company', companyId, 'crew-index', kind ?? 'all'] as const,
    queryFn: async () => {
      // Get users from company_user_profiles view
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select('user_id, role, email, display_name, first_name, last_name')
        .eq('company_id', companyId)

      if (error) throw error

      let rows = data as Array<{
        user_id: string
        role: CrewPerson['role']
        email: string
        display_name: string | null
        first_name: string | null
        last_name: string | null
      }>

      // Filter out superusers by checking profiles
      // Get all user_ids that are superusers
      const userIds = rows.map((r) => r.user_id)
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, superuser')
          .in('user_id', userIds)

        const superuserIds = new Set(
          (profilesData ?? [])
            .filter((p) => p.superuser)
            .map((p) => p.user_id),
        )

        // Filter out superusers
        rows = rows.filter((r) => !superuserIds.has(r.user_id))
      }

      if (kind && kind !== 'all') {
        rows = rows.filter((r) => r.role === kind)
      }

      return rows as Array<CrewPerson>
    },
  }
}

export type CrewDetail = {
  user_id: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string | null
  bio: string | null
  preferences: CrewOptionalFields | null
  locale: string | null
  timezone: string | null
  superuser: boolean
  primary_address_id: string | null
  selected_company_id: string | null
  primary_address: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

export function crewDetailQuery({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  return {
    queryKey: ['company', companyId, 'crew-detail', userId] as const,
    queryFn: async (): Promise<CrewDetail | null> => {
      // 1) Get normalized company/user fields from your view
      const { data: base, error } = await supabase
        .from('company_user_profiles')
        .select(
          'user_id, role, email, display_name, first_name, last_name, phone, avatar_url, created_at',
        )
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      if (!base) return null

      // 2) Pull the person's profile-only fields (bio, preferences, and other profile fields)
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select(
          `
          bio,
          preferences,
          locale,
          timezone,
          superuser,
          primary_address_id,
          selected_company_id,
          primary_address:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (pErr) throw pErr

      return {
        ...(base as Omit<
          CrewDetail,
          | 'bio'
          | 'preferences'
          | 'locale'
          | 'timezone'
          | 'superuser'
          | 'primary_address_id'
          | 'selected_company_id'
          | 'primary_address'
        >),
        bio: prof?.bio ?? null,
        preferences: prof?.preferences ?? null,
        locale: prof?.locale ?? null,
        timezone: prof?.timezone ?? null,
        superuser: prof?.superuser ?? false,
        primary_address_id: prof?.primary_address_id ?? null,
        selected_company_id: prof?.selected_company_id ?? null,
        primary_address: (prof as any)?.primary_address ?? null,
      }
    },
  }
}
// src/features/crew/api/queries.ts
export function myPendingInvitesQuery({
  companyId,
  inviterId, // or inviterUserId if you kept that name
}: {
  companyId: string
  inviterId?: string | null
}) {
  const key = [
    'company',
    companyId,
    'pending-invites',
    inviterId ?? '__none__',
  ] as const

  return {
    queryKey: key,
    queryFn: async (): Promise<Array<PendingInvite>> => {
      if (!inviterId) return []

      const { data, error } = await supabase
        .from('pending_invites')
        .select('id, email, role, inviter_user_id, created_at, expires_at')
        .eq('company_id', companyId)
        .eq('inviter_user_id', inviterId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map((r: any) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        inviter_user_id: r.inviter_user_id,
        created_at: r.created_at,
        expires_at: r.expires_at,
        inviter_name: null, // not needed for "my" invites
      }))
    },
  }
}
// src/features/crew/api/queries.ts
export type AddInviteResult =
  | { type: 'added' }
  | { type: 'invited' }
  | { type: 'already_invited'; by: string }
  | {
      type: 'already_member'
      role: 'owner' | 'employee' | 'freelancer' | 'super_user'
    }

export type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'

export async function addMemberOrInvite({
  companyId,
  email,
  role,
}: {
  companyId: string
  email: string
  role: CompanyRole
}): Promise<AddInviteResult> {
  const normalized = email.trim().toLowerCase()

  const { data: userRes, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const inviterId = userRes.user.id
  if (!inviterId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('add_member_or_invite', {
    p_company_id: companyId,
    p_email: normalized,
    p_inviter_id: inviterId,
    p_role: role,
  })
  if (error) throw error

  if (data?.type === 'already_invited' && data.by_user_id) {
    const { data: inviterProf } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name')
      .eq('user_id', data.by_user_id)
      .maybeSingle()

    const by =
      inviterProf?.display_name ??
      ([inviterProf?.first_name, inviterProf?.last_name]
        .filter(Boolean)
        .join(' ') ||
        'another user in your company')

    return { type: 'already_invited', by }
  }

  return data as AddInviteResult
}

// Keep your existing API for freelancers to minimize refactors:
export async function addFreelancerOrInvite({
  companyId,
  email,
}: {
  companyId: string
  email: string
}) {
  return addMemberOrInvite({ companyId, email, role: 'freelancer' })
}

export async function deleteInvite({ inviteId }: { inviteId: string }) {
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId)
  if (error) throw error
}

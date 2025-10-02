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
      // One round-trip via the view
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
      const { data, error } = await supabase
        .from('company_user_profiles')
        .select(
          'user_id, role, email, display_name, first_name, last_name, phone, avatar_url, created_at',
        )
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      // `data` already has the normalized shape from the view
      return data as CrewDetail
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

export async function addFreelancerOrInvite({
  companyId,
  email,
}: {
  companyId: string
  email: string
}): Promise<AddInviteResult> {
  // normalize email once here
  const normalized = email.trim().toLowerCase()

  // who is inviting?
  const { data: userRes, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const inviterId = userRes.user.id
  if (!inviterId) throw new Error('Not authenticated')

  // single round-trip: let the DB decide add vs invite
  const { data, error } = await supabase.rpc('add_freelancer_or_invite', {
    p_company_id: companyId,
    p_email: normalized,
    p_inviter_id: inviterId,
  })
  if (error) throw error

  // If the RPC returned "already_invited" with just a user id, resolve a friendly name
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

  // passthrough other outcomes from RPC: added / invited / already_member
  return data as AddInviteResult
}

export async function deleteInvite({ inviteId }: { inviteId: string }) {
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId)
  if (error) throw error
}

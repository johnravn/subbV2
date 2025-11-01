// src/features/company/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'

export async function setCompanyUserRole({
  companyId,
  userId,
  role,
}: {
  companyId: string
  userId: string
  role: CompanyRole
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('set_company_user_role', {
    p_company_id: companyId,
    p_target_user_id: userId,
    p_new_role: role,
    p_actor_user_id: actorId,
  })
  if (error) throw error
  return data
}

export async function removeCompanyUser({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) throw error
}

export function companyDetailQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'company-detail'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select(
          `
          id,
          name,
          created_at,
          address,
          vat_number,
          general_email,
          contact_person_id,
          contact_person:profiles!companies_contact_person_id_fkey (
            user_id,
            display_name,
            email
          )
        `,
        )
        .eq('id', companyId)
        // optional: cap the nested array at 1
        .limit(1, { foreignTable: 'profiles' })
        .single()

      if (error) throw error

      // 🔧 normalize embedded relation to a single object (or null)
      const person =
        (Array.isArray((data as any).contact_person)
          ? (data as any).contact_person[0]
          : (data as any).contact_person) ?? null

      return {
        id: data.id as string,
        name: data.name as string,
        created_at: data.created_at as string,
        address: (data.address ?? null) as string | null,
        vat_number: (data.vat_number ?? null) as string | null,
        general_email: (data.general_email ?? null) as string | null,
        contact_person_id: (data.contact_person_id ?? null) as string | null,
        contact_person: person as {
          user_id: string
          display_name: string | null
          email: string
        } | null,
      }
    },
  }
}

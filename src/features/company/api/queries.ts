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

export type CompanyIndexRow = {
  id: string
  name: string
  created_at: string
  address: string | null
  vat_number: string | null
  general_email: string | null
  contact_person_id: string | null
  contact_person: {
    user_id: string
    display_name: string | null
    email: string
  } | null
}

export function companiesIndexQuery() {
  return {
    queryKey: ['companies', 'index'] as const,
    queryFn: async (): Promise<Array<CompanyIndexRow>> => {
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
        .order('name', { ascending: true })

      if (error) throw error

      return (data as Array<any>).map((row) => {
        const person = Array.isArray(row.contact_person)
          ? row.contact_person[0]
          : row.contact_person

        return {
          id: row.id as string,
          name: row.name as string,
          created_at: row.created_at as string,
          address: (row.address ?? null) as string | null,
          vat_number: (row.vat_number ?? null) as string | null,
          general_email: (row.general_email ?? null) as string | null,
          contact_person_id: (row.contact_person_id ?? null) as string | null,
          contact_person: person as {
            user_id: string
            display_name: string | null
            email: string
          } | null,
        }
      })
    },
  }
}

// Radix Accent Color Type (used for company theme)
export type RadixAccentColor =
  | 'gray'
  | 'gold'
  | 'bronze'
  | 'brown'
  | 'yellow'
  | 'amber'
  | 'orange'
  | 'tomato'
  | 'red'
  | 'ruby'
  | 'pink'
  | 'plum'
  | 'purple'
  | 'violet'
  | 'iris'
  | 'indigo'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'jade'
  | 'green'
  | 'grass'
  | 'mint'
  | 'lime'
  | 'sky'

export type CompanyDetail = {
  id: string
  name: string
  created_at: string
  address: string | null
  vat_number: string | null
  general_email: string | null
  contact_person_id: string | null
  accent_color: RadixAccentColor | null
  contact_person: {
    user_id: string
    display_name: string | null
    email: string
    phone: string | null
  } | null
}

export function companyDetailQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'company-detail'] as const,
    queryFn: async (): Promise<CompanyDetail> => {
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
          accent_color,
          contact_person:profiles!companies_contact_person_id_fkey (
            user_id,
            display_name,
            email,
            phone
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
        accent_color: (data.accent_color as RadixAccentColor | null) ?? null,
        contact_person: person as {
          user_id: string
          display_name: string | null
          email: string
          phone: string | null
        } | null,
      }
    },
  }
}

export async function updateCompany({
  companyId,
  id,
  name,
  address,
  vat_number,
  general_email,
  contact_person_id,
}: {
  companyId: string
  id: string
  name: string
  address?: string | null
  vat_number?: string | null
  general_email?: string | null
  contact_person_id?: string | null
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Validate that id matches companyId for security
  if (id !== companyId) {
    throw new Error('Company ID mismatch')
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name,
      address: address || null,
      vat_number: vat_number || null,
      general_email: general_email || null,
      contact_person_id: contact_person_id || null,
    })
    .eq('id', id)

  if (error) throw error
}

// Update company accent color
export async function updateCompanyAccentColor({
  companyId,
  accentColor,
}: {
  companyId: string
  accentColor: RadixAccentColor | null
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('companies')
    .update({ accent_color: accentColor })
    .eq('id', companyId)

  if (error) throw error
}

// Company Expansions API

export type CompanyExpansion = {
  id: string
  company_id: string
  accounting_software: 'none' | 'conta' | null
  accounting_api_key_encrypted: string | null
  accounting_organization_id: string | null
  accounting_api_read_only: boolean
  created_at: string
  updated_at: string
}

export function companyExpansionQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'expansion'] as const,
    queryFn: async (): Promise<CompanyExpansion | null> => {
      const { data, error } = await supabase
        .from('company_expansions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      return data as CompanyExpansion | null
    },
  }
}

export async function updateCompanyExpansion({
  companyId,
  accountingSoftware,
  apiKey,
  organizationId,
  readOnly,
}: {
  companyId: string
  accountingSoftware?: 'none' | 'conta'
  apiKey?: string | null
  organizationId?: string | null
  readOnly?: boolean
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Encrypt the API key if provided
  let encryptedKey: string | null = null
  if (apiKey && accountingSoftware !== 'none') {
    const { data, error } = await supabase.rpc('encrypt_api_key', {
      p_company_id: companyId,
      p_api_key: apiKey,
    })
    if (error) throw error
    encryptedKey = data as string | null
  }

  // Get current expansion to preserve existing values if not provided
  const { data: current } = await supabase
    .from('company_expansions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  // Upsert the expansion record
  // Use onConflict to specify the unique constraint column to avoid duplicate key errors
  const { data, error } = await supabase
    .from('company_expansions')
    .upsert(
      {
        company_id: companyId,
        accounting_software:
          accountingSoftware !== undefined
            ? accountingSoftware
            : (current?.accounting_software ?? 'none'),
        accounting_api_key_encrypted:
          apiKey !== undefined
            ? encryptedKey
            : (current?.accounting_api_key_encrypted ?? null),
        accounting_organization_id:
          organizationId !== undefined
            ? organizationId
            : ((current as any)?.accounting_organization_id ?? null),
        accounting_api_read_only:
          readOnly !== undefined
            ? readOnly
            : (current?.accounting_api_read_only ?? true),
      },
      { onConflict: 'company_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

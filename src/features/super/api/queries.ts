// src/features/super/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type UserIndexRow = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  created_at: string
}

export function usersIndexQuery() {
  return {
    queryKey: ['users', 'index'] as const,
    queryFn: async (): Promise<Array<UserIndexRow>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          created_at
        `,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      return data as Array<UserIndexRow>
    },
  }
}

export type UserDetail = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  bio: string | null
  locale: string | null
  timezone: string | null
  avatar_url: string | null
  created_at: string
  preferences: {
    date_of_birth?: string
    drivers_license?: string
    licenses?: Array<string>
    certificates?: Array<string>
    notes?: string
  } | null
  primary_address_id: string | null
  primary_address: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

export function userDetailQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'detail', userId] as const,
    queryFn: async (): Promise<UserDetail | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          bio,
          locale,
          timezone,
          avatar_url,
          created_at,
          preferences,
          primary_address_id,
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

      if (error) throw error

      if (!data) return null

      // Normalize the address relation
      const address =
        (Array.isArray((data as any).primary_address)
          ? (data as any).primary_address[0]
          : (data as any).primary_address) ?? null

      return {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        phone: data.phone ?? null,
        superuser: data.superuser,
        bio: data.bio ?? null,
        locale: data.locale ?? null,
        timezone: data.timezone ?? null,
        avatar_url: data.avatar_url ?? null,
        created_at: data.created_at,
        preferences: (data.preferences ?? null) as {
          date_of_birth?: string
          drivers_license?: string
          licenses?: Array<string>
          certificates?: Array<string>
          notes?: string
        } | null,
        primary_address_id: data.primary_address_id ?? null,
        primary_address: address,
      }
    },
  }
}

export type UserCompanyMembership = {
  company_id: string
  company_name: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
}

export function userCompanyMembershipsQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'companies', userId] as const,
    queryFn: async (): Promise<Array<UserCompanyMembership>> => {
      const { data, error } = await supabase
        .from('company_users')
        .select(
          `
          company_id,
          role,
          companies (
            id,
            name
          )
        `,
        )
        .eq('user_id', userId)

      if (error) throw error

      return data.map((row) => ({
        company_id: row.company_id,
        company_name: (row.companies as any).name,
        role: row.role,
      }))
    },
  }
}

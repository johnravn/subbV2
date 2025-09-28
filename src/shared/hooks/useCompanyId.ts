// src/shared/hooks/useCompanyId.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export function useCompanyId() {
  return useQuery({
    queryKey: ['current-company-id'],
    queryFn: async (): Promise<string | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.company_id ?? null
    },
    staleTime: 60_000,
  })
}

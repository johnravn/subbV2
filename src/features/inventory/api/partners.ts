// src/features/inventory/api/partners.ts
import { supabase } from '@shared/api/supabase'

export function partnerCustomersQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'partner-customers'] as const,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_partner', true)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  }
}

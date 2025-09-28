// src/shared/companies/CompanyProvider.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

type Company = { id: string; name: string }
type Ctx = {
  companies: Array<Company>
  companyId: string | null
  company: Company | null
  setCompanyId: (id: string) => void
  loading: boolean
}

const CompanyCtx = React.createContext<Ctx>({
  companies: [],
  companyId: null,
  company: null,
  setCompanyId: () => {},
  loading: true,
})

const LS_KEY = 'selected-company-id'

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, _setCompanyId] = React.useState<string | null>(() =>
    localStorage.getItem(LS_KEY),
  )

  // 1) Who am I?
  const userQ = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
    staleTime: 60_000,
  })

  // 2) Which companies do I belong to?
  const companiesQ = useQuery({
    queryKey: ['my-companies', userQ.data?.id],
    enabled: !!userQ.data?.id,
    queryFn: async (): Promise<Array<Company>> => {
      const userId = userQ.data!.id
      const { data, error } = await supabase
        .from('company_users')
        .select('companies:companies(id,name)')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []).map((r: any) => r.companies).filter(Boolean)
    },
  })

  // 3) Pick a default if none is chosen
  React.useEffect(() => {
    if (!companiesQ.data) return
    if (!companyId) {
      const first = companiesQ.data[0]?.id ?? null
      if (first) {
        _setCompanyId(first)
        localStorage.setItem(LS_KEY, first)
      }
    } else {
      // validate stored id still exists
      const ok = companiesQ.data.some((c) => c.id === companyId)
      if (!ok && companiesQ.data[0]) {
        const first = companiesQ.data[0].id
        _setCompanyId(first)
        localStorage.setItem(LS_KEY, first)
      }
    }
  }, [companiesQ.data])

  function setCompanyId(id: string) {
    _setCompanyId(id)
    localStorage.setItem(LS_KEY, id)
  }

  const company = companiesQ.data?.find((c) => c.id === companyId) ?? null

  return (
    <CompanyCtx.Provider
      value={{
        companies: companiesQ.data ?? [],
        companyId,
        company,
        setCompanyId,
        loading: userQ.isLoading || companiesQ.isLoading,
      }}
    >
      {children}
    </CompanyCtx.Provider>
  )
}

export function useCompany() {
  return React.useContext(CompanyCtx)
}

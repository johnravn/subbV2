// src/shared/auth/useAuthz.ts
import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { capabilitiesFor } from './permissions'
import type { CapabilitySet, CompanyRole } from './permissions'

type State = {
  loading: boolean
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null
  caps: CapabilitySet
  userId: string | null
}

export function useAuthz(): State {
  const { companyId } = useCompany()
  const [state, setState] = React.useState<State>({
    loading: true,
    isGlobalSuperuser: false,
    companyRole: null,
    caps: new Set(),
    userId: null,
  })

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user ?? null
      const userId = user?.id ?? null

      let isGlobalSuperuser = false
      let companyRole: CompanyRole | null = null

      if (userId) {
        // profiles.superuser
        const { data: prof, error: perr } = await supabase
          .from('profiles')
          .select('superuser')
          .eq('user_id', userId)
          .maybeSingle()

        if (!perr && prof) isGlobalSuperuser = !!prof.superuser

        // company role for current company
        if (companyId) {
          const { data: cu, error: cerr } = await supabase
            .from('company_users')
            .select('role')
            .eq('user_id', userId)
            .eq('company_id', companyId)
            .maybeSingle()

          if (!cerr && cu?.role) companyRole = cu.role as CompanyRole
        }
      }

      const caps = capabilitiesFor({ isGlobalSuperuser, companyRole })

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (mounted) {
        setState({
          loading: false,
          isGlobalSuperuser,
          companyRole,
          caps,
          userId,
        })
      }
    })()

    return () => {
      mounted = false
    }
  }, [companyId])

  return state
}

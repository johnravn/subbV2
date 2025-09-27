import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import type { Session, User } from '@supabase/supabase-js'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthCtx = React.createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  })

  React.useEffect(() => {
    let mounted = true
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      })
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false })
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return React.useContext(AuthCtx)
}

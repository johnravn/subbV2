import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  })

  const previousUserIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      previousUserIdRef.current = data.session?.user?.id ?? null
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      })
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user?.id ?? null
      
      // Clear cache on sign out or when user changes
      if (
        event === 'SIGNED_OUT' ||
        (previousUserIdRef.current && previousUserIdRef.current !== currentUserId)
      ) {
        queryClient.clear()
      }
      
      previousUserIdRef.current = currentUserId
      setState({ session, user: session?.user ?? null, loading: false })
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return React.useContext(AuthCtx)
}

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

      // Set the user in query cache so CompanyProvider can use it immediately
      queryClient.setQueryData(['auth', 'user'], data.session?.user ?? null)

      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      })
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user?.id ?? null

      // Update auth/user query cache immediately on auth state changes
      queryClient.setQueryData(['auth', 'user'], session?.user ?? null)

      // Invalidate auth/user query on sign in events to trigger refetch if needed
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      }

      // Clear cache on sign out or when user changes to a different user
      if (
        event === 'SIGNED_OUT' ||
        (previousUserIdRef.current &&
          previousUserIdRef.current !== currentUserId &&
          currentUserId !== null)
      ) {
        queryClient.clear()
        // Ensure user query is cleared too
        queryClient.setQueryData(['auth', 'user'], null)
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

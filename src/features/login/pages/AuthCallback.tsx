import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import { useNavigate } from '@tanstack/react-router'

export default function AuthCallback() {
  const navigate = useNavigate()
  React.useEffect(() => {
    // Handles PKCE/OAuth and magic links
    supabase.auth.exchangeCodeForSession(window.location.href).finally(() => {
      navigate({ to: '/' })
    })
  }, [navigate])
  return <>Completing sign in…</>
}

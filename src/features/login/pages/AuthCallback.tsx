// src/features/login/pages/AuthCallback.tsx
import * as React from 'react'
import { supabase } from '@shared/api/supabase'
import { useNavigate } from '@tanstack/react-router'
import { Card, Flex, Heading, Text } from '@radix-ui/themes'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      const url = new URL(window.location.href)
      const code =
        url.searchParams.get('code') || url.hash.match(/code=([^&]+)/)?.[1]

      try {
        // 1) Try PKCE/OAuth session exchange first (works for many providers and some email links)
        const { error: excErr } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        )

        if (excErr) {
          // 2) If that failed and we have a `code`, try email confirmation (signup) verify
          if (code) {
            const { error: verErr } = await supabase.auth.verifyOtp({
              type: 'signup',
              token_hash: code,
            })
            if (verErr) throw verErr
          } else {
            // 3) No code in URL; see if we already have a session
            const { data: s } = await supabase.auth.getSession()
            if (!s.session) throw excErr
          }
        }

        if (!cancelled) navigate({ to: '/dashboard' })
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Could not complete sign-in')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100dvh' }}>
        <Card size="3" style={{ width: 420, background: 'var(--gray-a2)' }}>
          <Heading size="5" mb="2">
            Sign-in error
          </Heading>
          <Text color="red">{error}</Text>
        </Card>
      </Flex>
    )
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100dvh' }}>
      <Card size="3" style={{ width: 420, background: 'var(--gray-a2)' }}>
        <Heading size="5">Completing sign-in…</Heading>
        <Text color="gray">Please wait.</Text>
      </Card>
    </Flex>
  )
}

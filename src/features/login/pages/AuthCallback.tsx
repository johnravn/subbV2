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

    async function run() {
      try {
        // Handles OAuth PKCE and passwordless magic-link flows.
        // Safe to call even if there is no code in the URL.
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        )

        if (error) {
          // If there was no code or it was already exchanged, fall back to session check
          const { data: s } = await supabase.auth.getSession()
          if (!s.session) throw error
        }

        if (!cancelled) navigate({ to: '/' })
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
        <Card size="3" style={{ width: 420 }}>
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
      <Card size="3" style={{ width: 420 }}>
        <Heading size="5">Completing sign-in…</Heading>
        <Text color="gray">Please wait.</Text>
      </Card>
    </Flex>
  )
}

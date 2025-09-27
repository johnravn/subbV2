// src/features/login/pages/LoginPage.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Google } from 'iconoir-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) return setError(error.message)
    navigate({ to: '/' })
  }

  async function signUp() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: email.split('@')[0] } },
    })
    setLoading(false)
    if (error) return setError(error.message)
    // If email confirmations are enabled, user must confirm via email before session exists.
  }

  async function magicLink() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) return setError(error.message)
  }

  async function signInGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100%', padding: 16 }}
    >
      <Card size="3" style={{ width: 420 }}>
        <Heading size="6" mb="3">
          Sign in
        </Heading>
        <form onSubmit={signIn}>
          <Flex direction="column" gap="3">
            <TextField.Root
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField.Root
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <Text color="red">{error}</Text>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={signUp}
              disabled={loading}
            >
              Create account
            </Button>
          </Flex>
        </form>

        <Separator my="3" />

        <Flex direction="column" gap="2">
          <Button
            variant="soft"
            onClick={magicLink}
            disabled={!email || loading}
          >
            Send magic link
          </Button>
          <Button variant="soft" onClick={signInGoogle}>
            <Flex align="center" gap="2">
              <Google width={18} height={18} /> Sign in with Google
            </Flex>
          </Button>
        </Flex>
      </Card>
    </Flex>
  )
}

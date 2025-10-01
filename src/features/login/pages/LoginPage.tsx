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

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100%', // true full viewport height
        padding: '24px', // comfy outer padding on mobile
      }}
    >
      <Card
        size="4" // a bit roomier than size="3"
        style={{
          width: '100%',
          maxWidth: 480, // responsive cap on larger screens
        }}
      >
        <Flex direction="column" gap="4">
          {/* Header */}
          <Box>
            <Heading size="7" mb="1">
              Sign in
            </Heading>
            <Text color="gray">Welcome back. Please enter your details.</Text>
          </Box>

          <Separator size="4" />

          {/* Form */}
          <form onSubmit={signIn}>
            <Flex direction="column" gap="3">
              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Email
                </Text>
                <TextField.Root
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  size="3"
                  required
                />
              </Box>

              <Box>
                <Flex justify="between" align="center" mb="1">
                  <Text as="label" size="2" color="gray">
                    Password
                  </Text>
                  {/* Optional forgot link spot */}
                  {/* <Text size="2" color="gray"><Link to="/forgot">Forgot?</Link></Text> */}
                </Flex>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  size="3"
                  required
                />
              </Box>

              {error && <Text color="red">{error}</Text>}

              <Button
                type="submit"
                size="3"
                disabled={loading}
                variant="classic"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="3"
                onClick={() => navigate({ to: '/signup' })}
                disabled={loading}
              >
                Create account
              </Button>
            </Flex>
          </form>
        </Flex>
      </Card>
    </Flex>
  )
}

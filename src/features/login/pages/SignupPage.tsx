// src/features/login/pages/SignupPage.tsx
import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '@shared/api/supabase'
import { isValidPhoneNumber } from 'react-phone-number-input' // ✅ add this
import { PhoneInputField } from '@shared/phone/PhoneInputField' // ✅ add this
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

export default function SignupPage() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [phone, setPhone] = React.useState<string | undefined>(undefined) // ✅ allow undefined
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Please enter a valid phone number')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp(
        {
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: `${firstName} ${lastName}`.trim(),
              first_name: firstName,
              last_name: lastName,
              phone,
            },
          },
        },
      )
      if (signUpErr) throw signUpErr
    } catch (e: any) {
      console.error('signUp failed:', {
        message: e?.message,
        status: e?.status,
        name: e?.name,
      })
      setLoading(false)
      setError(e?.message ?? 'Sign up failed')
      return
    }

    // 2) If a session exists immediately (email confirmation OFF),
    //    we can upsert into public.profiles right now.
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session?.user) {
      setLoading(false)
      navigate({ to: '/' })
      return
    }

    // 3) If no session yet (email confirmation ON), show next steps.
    setLoading(false)
    setInfo(
      'Check your email to confirm your account. Your profile will be created after confirmation.',
    )
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100%', padding: '24px' }}
    >
      <Card size="4" style={{ width: '100%', maxWidth: 520 }}>
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="7" mb="1">
              Create your account
            </Heading>
            <Text color="gray">Fill in your details to sign up.</Text>
          </Box>

          <Separator size="4" />

          <form onSubmit={onSubmit}>
            <Flex direction="column" gap="3">
              <Flex gap="3" wrap="wrap">
                <Box style={{ flex: 1, minWidth: 180 }}>
                  <Text
                    as="label"
                    size="2"
                    color="gray"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    First name
                  </Text>
                  <TextField.Root
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    size="3"
                  />
                </Box>
                <Box style={{ flex: 1, minWidth: 180 }}>
                  <Text
                    as="label"
                    size="2"
                    color="gray"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Last name
                  </Text>
                  <TextField.Root
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    size="3"
                  />
                </Box>
              </Flex>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Phone number
                </Text>
                <PhoneInputField
                  id="signup-phone"
                  value={phone}
                  onChange={setPhone}
                  defaultCountry="NO"
                  placeholder="Enter phone number"
                  disabled={loading}
                />
              </Box>

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
                  required
                  size="3"
                />
              </Box>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Password
                </Text>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  size="3"
                />
              </Box>

              <Box>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  Confirm password
                </Text>
                <TextField.Root
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  size="3"
                />
              </Box>

              {error && <Text color="red">{error}</Text>}
              {info && <Text color="green">{info}</Text>}

              <Button
                type="submit"
                size="3"
                disabled={loading}
                variant="classic"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="3"
                onClick={() => navigate({ to: '/login' })}
                disabled={loading}
              >
                Back to sign in
              </Button>
            </Flex>
          </form>

          <Text size="2" color="gray">
            By creating an account, you agree to our{' '}
            <Link to="/legal" style={{ textDecoration: 'underline' }}>
              terms and privacy policy.
            </Link>
          </Text>
        </Flex>
      </Card>
    </Flex>
  )
}

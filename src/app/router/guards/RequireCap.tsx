// src/app/routes/guards/RequireCap.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthz } from '@shared/auth/useAuthz'
import { Flex, Spinner, Text } from '@radix-ui/themes'
import type { Capability } from '@shared/auth/permissions'

export default function RequireCap({
  need,
  children,
}: {
  need: Capability
  children: React.ReactNode
}) {
  const { loading, caps } = useAuthz()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!loading) {
      if (!caps.has(need)) {
        // Navigate to a safe page (home) if blocked
        navigate({ to: '/dashboard' })
      }
    }
  }, [loading, caps, need, navigate])

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '50vh' }}>
        <Flex align="center" gap="1">
          <Text>Thinking</Text>
          <Spinner size="2" />
        </Flex>
      </Flex>
    )
  }

  // If user lacks permission, a nav will trigger; render nothing here.
  return <>{children}</>
}

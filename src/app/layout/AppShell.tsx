// src/app/layout/AppShell.tsx
import * as React from 'react'
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { Avatar, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { Menu } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
// add
import { useQuery } from '@tanstack/react-query'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { NAV, Sidebar } from './Sidebar'

export default function AppShell() {
  const [open, setOpen] = React.useState(true)
  const [userName, setUserName] = React.useState<string | null>(null)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')
  const navigate = useNavigate()

  // keep your existing `const [userName, setUserName] = React.useState<string | null>(null)` if you still need it for anything else,
  // but we’ll rely on the profile data below.

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })

  // Load my profile row
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,display_name,avatar_url')
        .eq('user_id', authUser!.id)
        .maybeSingle()
      if (error) throw error
      return data as {
        user_id: string
        email: string
        display_name: string | null
        avatar_url: string | null
      }
    },
  })

  // Build a public avatar URL from storage path (if any)
  const avatarUrl = React.useMemo(() => {
    if (!myProfile?.avatar_url) return null
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(myProfile.avatar_url)
    return data.publicUrl
  }, [myProfile?.avatar_url])

  const displayName = myProfile?.display_name || myProfile?.email || ''

  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

  React.useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUserName(data.user.user_metadata.uid || data.user.email) // FIX THIS LATER
      }
    }
    fetchUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const title = getPageTitle(currentPath)
  const isLogin =
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/legal'

  return (
    <Flex
      height="100svh" // was 100dvh
      width="100%"
      direction="row"
      style={{ position: 'relative', minHeight: 0 }} // allow children to shrink
    >
      {!isLogin && (
        <Sidebar
          open={open}
          onToggle={(next) => setOpen(next ?? !open)}
          currentPath={currentPath}
          // NEW:
          userDisplayName={displayName}
          userEmail={myProfile?.email ?? ''}
          userAvatarUrl={avatarUrl}
          onLogout={handleLogout}
        />
      )}

      <Box style={{ flex: 1, minWidth: 0 }}>
        <Flex direction="column" style={{ height: '100%', minHeight: 0 }}>
          {/* Top bar */}
          <Flex align="center" justify="between" px="4" py="3">
            {!isLogin && isMobile && (
              <IconButton
                size="2"
                variant="ghost"
                aria-label={(open ? 'Close' : 'Open') + ' menu'}
                onClick={() => setOpen((o) => !o)}
              >
                <Menu />
              </IconButton>
            )}
            {!isLogin && (
              <Text size="8" weight="light">
                {title}
              </Text>
            )}
            {!isLogin && !isMobile && (
              <Flex align="center" gap="3">
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <Flex
                    align="center"
                    gap="2"
                    // make it feel like a button without Radix Button hover styles
                    role="button"
                    tabIndex={0}
                    aria-label="Go to profile"
                    style={{ cursor: 'pointer' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.currentTarget.click()
                        e.preventDefault()
                      }
                    }}
                  >
                    <Avatar
                      size="2"
                      radius="full"
                      src={avatarUrl ?? undefined}
                      fallback={(displayName || '?').slice(0, 2).toUpperCase()}
                      style={{ border: '1px solid var(--gray-5)' }}
                    />
                    <Text size="2" style={{ maxWidth: 200 }} truncate>
                      {displayName}
                    </Text>
                  </Flex>
                </Link>

                <Button variant="soft" onClick={handleLogout}>
                  Logout
                </Button>
              </Flex>
            )}
          </Flex>

          {/* Content area should be the ONLY scroller */}
          <Box
            p="4"
            style={{
              flex: 1, // <-- grow to fill
              minHeight: 0, // <-- allow scrolling area to shrink
              overflow: 'auto', // <-- scroll here
            }}
          >
            {/* <AnimatePresence mode="wait">
              <motion.div
                key={currentPath}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ height: '100%' }}
              > */}
            <Outlet />
            {/* </motion.div>
            </AnimatePresence> */}
          </Box>
        </Flex>
      </Box>
    </Flex>
  )
}

/* ------- helpers ------- */
function getPageTitle(path: string) {
  const NAVinfo = NAV

  for (const section of NAVinfo) {
    for (const navItem of section) {
      if (path === navItem.to) return navItem.label
    }
  }
}

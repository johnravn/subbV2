// src/app/layout/AppShell.tsx
import * as React from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { Menu } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { AnimatePresence, motion } from 'framer-motion'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Sidebar } from './Sidebar'

export default function AppShell() {
  const [open, setOpen] = React.useState(true)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')
  const navigate = useNavigate()

  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

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
            {!isLogin && (
              <Box>
                <Button variant="soft" onClick={handleLogout}>
                  Logout
                </Button>
              </Box>
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
  if (path === '/') return 'Home'
  if (path.startsWith('/inventory')) return 'Inventory'
  if (path.startsWith('/calendar')) return 'Calendar'
  if (path.startsWith('/vehicles')) return 'Vehicles'
  if (path.startsWith('/jobs')) return 'Jobs'
  if (path.startsWith('/crew')) return 'Crew'
  if (path === '/login') return 'Login'
  return 'Page'
}

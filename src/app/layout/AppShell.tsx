// src/app/layout/AppShell.tsx  (was App.tsx)
import * as React from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Box, Flex, IconButton, Text } from '@radix-ui/themes'
import { Menu } from 'iconoir-react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Sidebar } from './Sidebar'

export default function AppShell() {
  const [open, setOpen] = React.useState(true)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')

  // On mobile, start closed
  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

  const title = getPageTitle(currentPath)

  return (
    <Flex
      height="100dvh"
      width="100%"
      direction="row"
      style={{ position: 'relative' }}
    >
      {/* Sidebar (static slot + actual content handled inside) */}
      <Sidebar
        open={open}
        onToggle={(next) => setOpen(next ?? !open)}
        currentPath={currentPath}
      />

      {/* Main content */}
      <Box flexGrow="1">
        <Flex direction="column" height="100%">
          {/* Top bar */}
          <Flex
            align="center"
            justify="between"
            px="4"
            py="3"
            // style={{ borderBottom: '1px solid var(--gray-a6)' }}
          >
            {/* Left: persistent menu button */}
            {isMobile && (
              <IconButton
                size="2"
                variant="ghost"
                aria-label={(open ? 'Close' : 'Open') + ' menu'}
                onClick={() => setOpen((o) => !o)}
              >
                <Menu />
              </IconButton>
            )}
            {/* Title */}
            <Text size="7" weight="bold">
              {title}
            </Text>

            {/* Right-aligned actions placeholder */}
            <Box style={{ width: 32 /* keeps layout balanced */ }} />
          </Flex>

          {/* Outlet area */}
          <Box p="4" style={{ overflow: 'auto', height: '100%' }}>
            <Outlet />
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
  return 'Page'
}

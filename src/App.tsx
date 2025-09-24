// App.tsx
import * as React from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Separator,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Archive, HomeAlt, Menu } from 'iconoir-react'

const SIDEBAR_EXPANDED = 300
const SIDEBAR_COLLAPSED = 64
const CONTENT_MAX_WIDTH = 1080 // constant width for main content

export default function App() {
  const [open, setOpen] = React.useState(true)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  // Map path → page title (keep this in sync with your sidebar labels)
  const title = getPageTitle(currentPath)

  return (
    <Flex height="100dvh" width="100%" direction="row">
      {/* Sidebar */}
      <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
        <Box
          asChild
          style={{
            width: open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
            transition: 'width 180ms ease',
            borderRight: '1px solid var(--gray-a6)',
          }}
        >
          <aside>
            {/* Sidebar header */}
            <Flex align="center" justify="between" px="3" py="3" gap="3">
              <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                <Box
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'var(--accent-9)',
                  }}
                />
                {open && (
                  <Text size="3" weight="bold" truncate>
                    Your App
                  </Text>
                )}
              </Flex>

              <Tooltip
                content={open ? 'Collapse' : 'Expand'}
                delayDuration={300}
              >
                <IconButton
                  size="2"
                  variant="ghost"
                  onClick={() => setOpen((o) => !o)}
                  aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  <Menu />
                </IconButton>
              </Tooltip>
            </Flex>

            <Separator size="4" />

            {/* Nav list */}
            <ScrollArea.Root style={{ height: 'calc(100dvh - 64px)' }}>
              <ScrollArea.Viewport style={{ padding: '8px 8px 16px' }}>
                <Flex direction="column" gap="2">
                  <NavItem
                    to="/"
                    icon={<HomeAlt />}
                    label="Home"
                    open={open}
                    currentPath={currentPath}
                  />
                  <NavItem
                    to="/inventory"
                    icon={<Archive />}
                    label="Inventory"
                    open={open}
                    currentPath={currentPath}
                  />
                  {/* Add more items here */}
                </Flex>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical">
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </aside>
        </Box>
      </Collapsible.Root>

      {/* Main content */}
      <Box flexGrow="1">
        <Flex direction="column" height="100%">
          {/* Top bar with dynamic page title */}
          <Flex
            align="center"
            justify="between"
            px="4"
            py="3"
            // style={{ borderBottom: '1px solid var(--gray-a6)' }}
          >
            <Box style={{ width: '100%' }}>
              <Text size="8" weight="bold">
                {title}
              </Text>
            </Box>
            {/* Right-side actions could go here */}
          </Flex>

          {/* Outlet area with constant width container */}
          <Box p="4" style={{ overflow: 'auto', height: '100%' }}>
            <Box style={{ width: '100%' }}>
              <Outlet />
            </Box>
          </Box>
        </Flex>
      </Box>
    </Flex>
  )
}

/** One nav row that supports icon-only when collapsed */
function NavItem({
  to,
  icon,
  label,
  open,
  currentPath,
}: {
  to: string
  icon: React.ReactNode
  label: string
  open: boolean
  currentPath: string
}) {
  const active = isActive(to, currentPath)

  // Use Button with `asChild` so the router's <Link> is the actual clickable element.
  const content = (
    <Button variant={active ? 'solid' : 'ghost'} size="3" highContrast asChild>
      <Link
        to={to}
        style={{ justifyContent: open ? 'flex-start' : 'center', gap: 10 }}
      >
        {icon}
        {open && <span style={{ lineHeight: 1 }}>{label}</span>}
      </Link>
    </Button>
  )

  // When collapsed, wrap in a tooltip so users still see the label on hover
  if (!open) {
    return (
      <Tooltip content={label} delayDuration={300}>
        {content}
      </Tooltip>
    )
  }
  return content
}

/* ---------------- helpers ---------------- */

function isActive(to: string, currentPath: string) {
  if (to === '/') return currentPath === '/'
  // simple startsWith for section highlighting
  return currentPath === to || currentPath.startsWith(to + '/')
}

function getPageTitle(path: string) {
  if (path === '/') return 'Home'
  if (path.startsWith('/inventory')) return 'Inventory'
  // add more mappings as you add sections:
  // if (path.startsWith('/crew')) return 'Crew'
  return 'Page'
}

// src/app/layout/Sidebar.tsx
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import iconSmall from '@shared/assets/subbLogo/svg/white/IconSmallWhite.svg'
import logoWhite from '@shared/assets/subbLogo/svg/white/LogoWhite.svg'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Separator,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import {
  BoxIso,
  Calendar,
  Car,
  GoogleDocs,
  Group,
  HomeAlt,
  Menu,
} from 'iconoir-react'
import { useMediaQuery } from '../hooks/useMediaQuery'

const SIDEBAR_EXPANDED = 240
const SIDEBAR_COLLAPSED = 64

type NavItem = { to: string; label: string; icon: React.ReactNode }

const NAV: Array<NavItem> = [
  { to: '/', label: 'Home', icon: <HomeAlt /> },
  { to: '/inventory', label: 'Inventory', icon: <BoxIso /> },
  { to: '/calendar', label: 'Calendar', icon: <Calendar /> },
  { to: '/vehicles', label: 'Vehicles', icon: <Car /> },
  { to: '/jobs', label: 'Jobs', icon: <GoogleDocs /> },
  { to: '/crew', label: 'Crew', icon: <Group /> },
]

export function Sidebar({
  open,
  onToggle,
  currentPath,
}: {
  open: boolean
  onToggle: (next?: boolean) => void
  currentPath: string
}) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Desktop: we render a static sidebar block that takes space in the flex row.
  // Mobile: we render an off-canvas drawer (position: fixed). The static slot collapses to 0px.
  const staticWidth = isMobile ? 0 : open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  return (
    <>
      {/* Static slot (takes horizontal space in desktop; hidden on mobile) */}
      <Box
        asChild
        style={{
          width: staticWidth,
          transition: 'width 180ms ease',
          //   borderRight: staticWidth ? '1px solid var(--gray-a6)' : 'none',
        }}
      >
        <aside aria-label="Sidebar navigation" />
      </Box>

      {/* Actual sidebar content */}
      {isMobile ? (
        // Off-canvas: only render when open
        open && (
          <>
            {/* Backdrop */}
            <Box
              onClick={() => onToggle(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--black-a7)',
                zIndex: 50,
              }}
            />
            {/* Drawer */}
            <Box
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: '100dvh',
                width: Math.min(320, Math.floor(window.innerWidth * 0.85)),
                background: 'var(--black-a9)',
                borderRight: '1px solid var(--gray-a6)',
                zIndex: 51,
                boxShadow: '0 10px 40px var(--black-a6)',
              }}
            >
              <SidebarContent
                open // in mobile drawer we always show labels
                onToggle={onToggle}
                currentPath={currentPath}
                isMobile={isMobile}
                showCollapseButton
              />
            </Box>
          </>
        )
      ) : (
        // Desktop inline sidebar (expanded/collapsed)
        <Box
          style={{
            position: 'absolute',
            // visually hidden; the actual occupied space is the static slot above.
            // We position this content on top of the static slot.
            left: 0,
            top: 0,
            bottom: 0,
            width: staticWidth,
            pointerEvents: 'none',
          }}
        >
          <Box
            style={{
              height: '100dvh',
              width: staticWidth,
              pointerEvents: 'auto',
            }}
          >
            <SidebarContent
              open={open}
              onToggle={onToggle}
              currentPath={currentPath}
              isMobile={isMobile}
              showCollapseButton
            />
          </Box>
        </Box>
      )}
    </>
  )
}

function SidebarContent({
  open,
  onToggle,
  currentPath,
  isMobile,
  showCollapseButton,
}: {
  open: boolean
  onToggle: (next?: boolean) => void
  currentPath: string
  isMobile: boolean
  showCollapseButton?: boolean
}) {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      {/* Header */}
      <Flex align="center" justify="between" px="3" py="3" gap="3">
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          {open && (
            <>
              <img
                src={iconSmall}
                alt="App logo"
                style={{ width: 28, height: 28 }}
              />
              <Text size="3" weight="bold" truncate>
                Ekte Lyd AS
              </Text>
            </>
          )}
        </Flex>

        {showCollapseButton && (
          <Tooltip content={open ? 'Collapse' : 'Expand'} delayDuration={300}>
            <IconButton
              size="2"
              variant="ghost"
              onClick={() => onToggle(!open)}
              aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Menu />
            </IconButton>
          </Tooltip>
        )}
      </Flex>

      <Separator size="4" />

      {/* Main nav area */}
      <Box flexGrow="1" style={{ minHeight: 0 }}>
        <ScrollArea.Root style={{ height: '100%' }}>
          <ScrollArea.Viewport style={{ padding: '8px 8px 16px' }}>
            <Flex direction="column" gap="4">
              {NAV.map((n) => (
                <NavItem
                  key={n.to}
                  to={n.to}
                  icon={n.icon}
                  label={n.label}
                  open={open}
                  currentPath={currentPath}
                  isMobile={isMobile}
                  onCloseMobile={() => onToggle(false)}
                />
              ))}
            </Flex>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Box>

      {/* Footer image (only when open) */}
      {open && (
        <Box px="3" py="3">
          <Flex align="center" justify="center">
            <img
              src={logoWhite}
              alt="Footer illustration"
              style={{ maxWidth: '50%', borderRadius: 6 }}
            />
          </Flex>
        </Box>
      )}
    </aside>
  )
}

function NavItem({
  to,
  icon,
  label,
  open,
  currentPath,
  isMobile,
  onCloseMobile,
}: {
  to: string
  icon: React.ReactNode
  label: string
  open: boolean
  currentPath: string
  isMobile: boolean
  onCloseMobile: () => void
}) {
  const active =
    to === '/'
      ? currentPath === '/'
      : currentPath === to || currentPath.startsWith(to + '/')

  function handleClick(e: React.MouseEvent) {
    if (!isMobile) return
    // respect modifier/middle clicks so users can open in new tab
    const modified =
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
    if (!modified) {
      onCloseMobile()
    }
  }

  const content = (
    <Button variant={active ? 'solid' : 'ghost'} size="3" highContrast asChild>
      <Link
        to={to}
        onClick={handleClick}
        style={{ justifyContent: open ? 'flex-start' : 'center', gap: 10 }}
      >
        {icon}
        {open && <span style={{ lineHeight: 1 }}>{label}</span>}
      </Link>
    </Button>
  )

  if (!open) {
    return (
      <Tooltip content={label} delayDuration={300}>
        {content}
      </Tooltip>
    )
  }
  return content
}

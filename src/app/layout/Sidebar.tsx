// src/app/layout/Sidebar.tsx
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import logoWhite from '@shared/assets/subbLogo/svg/white/LogoWhite.svg'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Select,
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
  { to: '/vehicles', label: 'Vehicles', icon: <Car /> },
  { to: '/crew', label: 'Crew', icon: <Group /> },
  { to: '/jobs', label: 'Jobs', icon: <GoogleDocs /> },
  { to: '/calendar', label: 'Calendar', icon: <Calendar /> },
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
  const staticWidth = isMobile ? 0 : open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  return (
    <>
      {/* Static slot (desktop width reservation) */}
      <Box
        asChild
        style={{
          width: staticWidth,
          transition: 'width 180ms ease',
        }}
      >
        <aside aria-label="Sidebar navigation" />
      </Box>

      {/* Actual sidebar content */}
      {isMobile ? (
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
                open
                onToggle={onToggle}
                currentPath={currentPath}
                isMobile={isMobile}
                showCollapseButton
              />
            </Box>
          </>
        )
      ) : (
        <Box
          style={{
            position: 'absolute',
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
  const { companies, company, companyId, setCompanyId, loading } = useCompany()

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      {/* Header / Company selector */}
      <Flex align="center" justify="between" px="3" py="3" gap="3">
        <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
          {open ? (
            <div style={{ width: '100%' }}>
              <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
                Company
              </Text>
              <Select.Root
                value={companyId ?? ''}
                onValueChange={setCompanyId}
                disabled={loading || companies.length === 0}
              >
                <Select.Trigger placeholder="Select company" variant="ghost" />
                <Select.Content>
                  {companies.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {c.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          ) : (
            // Collapsed: initials pill with tooltip
            <Tooltip content={company?.name ?? 'Company'} delayDuration={300}>
              <Box
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--accent-9)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {(company?.name ?? '—')
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Box>
            </Tooltip>
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
    const modified =
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
    if (!modified) onCloseMobile()
  }

  const content = (
    <Button
      variant={active ? 'outline' : 'ghost'}
      size="3"
      highContrast
      asChild
    >
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

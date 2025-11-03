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
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')
  const navigate = useNavigate()

  // Get user from shared query (already fetched by CompanyProvider)
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

  // Check user preference for animated background (defaults to false)
  const { data: backgroundPrefs } = useQuery({
    queryKey: ['profile', authUser?.id, 'animated-background-preference'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id)
        return {
          enabled: false,
          intensity: 1.0,
          shapeType: 'circles' as const,
          speed: 1.0,
        }
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', authUser.id)
        .maybeSingle()
      const prefs = data?.preferences as any
      // Default to false if not set
      return {
        enabled: prefs?.animated_background_enabled ?? false,
        intensity: prefs?.animated_background_intensity ?? 1.0,
        shapeType: prefs?.animated_background_shape_type ?? 'circles',
        speed: prefs?.animated_background_speed ?? 1.0,
      }
    },
    staleTime: 0, // Always refetch when invalidated
    refetchOnWindowFocus: true, // Refetch when window gains focus
  })

  const backgroundEnabled = backgroundPrefs?.enabled ?? false
  const backgroundIntensity = backgroundPrefs?.intensity ?? 1.0
  const backgroundShapeType = backgroundPrefs?.shapeType ?? 'circles'
  const backgroundSpeed = backgroundPrefs?.speed ?? 1.0

  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const title = getPageTitle(currentPath)
  const isPublic =
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/legal' ||
    currentPath === '/'

  return (
    <Flex
      height={isPublic ? 'auto' : '100svh'} // was 100dvh
      width="100%"
      direction="row"
      style={{ position: 'relative', minHeight: 0 }} // allow children to shrink
    >
      {/* Animated background - only on authenticated pages and if enabled */}
      {!isPublic && backgroundEnabled === true && (
        <AnimatedBackground
          intensity={backgroundIntensity}
          shapeType={backgroundShapeType}
          speed={backgroundSpeed}
        />
      )}

      {!isPublic && (
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

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          backgroundColor: isPublic ? undefined : 'transparent',
        }}
      >
        <Flex
          direction="column"
          style={{ height: isPublic ? 'auto' : '100%', minHeight: 0 }}
        >
          {/* Top bar */}
          <Flex align="center" justify="between" px="4" py="3">
            {!isPublic && isMobile && (
              <IconButton
                size="2"
                variant="ghost"
                aria-label={(open ? 'Close' : 'Open') + ' menu'}
                onClick={() => setOpen((o) => !o)}
              >
                <Menu />
              </IconButton>
            )}
            {!isPublic && (
              <Text size="8" weight="light">
                {title}
              </Text>
            )}
            {!isPublic && !isMobile && (
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
            p={isPublic ? undefined : '4'}
            style={{
              flex: 1, // <-- grow to fill
              minHeight: 0, // <-- allow scrolling area to shrink
              overflow: isPublic ? 'visible' : 'auto', // <-- scroll here
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

/* ------- Animated Background Component ------- */
type ShapeType = 'circles' | 'triangles' | 'rectangles'

function AnimatedBackground({
  intensity = 1.0,
  shapeType = 'circles',
  speed = 1.0,
}: {
  intensity?: number
  shapeType?: ShapeType
  speed?: number
}) {
  // Clamp intensity between 0 and 1
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  // Clamp speed between 0.1 and 3.0, use as multiplier (inverse for duration)
  const speedMultiplier = Math.max(0.1, Math.min(3.0, speed))
  // Base durations (in seconds) - slower speed = longer duration
  const baseDurations = [120, 150, 180, 100, 200]
  const durations = baseDurations.map((d) => d / speedMultiplier)
  // Rotation durations (in seconds) - much slower for subtle rotation, also affected by speed multiplier
  // Each shape rotates at a different speed for variety
  const baseRotationDurations = [300, 420, 360, 380, 400]
  const rotationDurations = baseRotationDurations.map(
    (d) => d / speedMultiplier,
  )

  // Initial rotation angles (degrees) - each shape starts at a different angle
  const initialRotations = [15, 30, 45, 60, 75]

  // Calculate rotation amounts (degrees per slide cycle) for triangles/rectangles
  // Much more subtle - only partial rotations per slide cycle
  const rotationAmounts = durations.map((slideDur, idx) =>
    Math.round((slideDur / rotationDurations[idx]) * 360),
  )

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes slideSlow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(calc(100vw + 100%));
          }
        }
        
        @keyframes slideSlowReverse {
          0% {
            transform: translateX(calc(100vw + 100%));
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        @keyframes slideSlowWithRotate1 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[0]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[0] + rotationAmounts[0]}deg);
          }
        }
        
        @keyframes slideSlowReverseWithRotate2 {
          0% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[1]}deg);
          }
          100% {
            transform: translateX(-100%) rotate(${initialRotations[1] - rotationAmounts[1]}deg);
          }
        }
        
        @keyframes slideSlowWithRotate3 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[2]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[2] + rotationAmounts[2]}deg);
          }
        }
        
        @keyframes slideSlowReverseWithRotate4 {
          0% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[3]}deg);
          }
          100% {
            transform: translateX(-100%) rotate(${initialRotations[3] - rotationAmounts[3]}deg);
          }
        }
        
        @keyframes slideSlowWithRotate5 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[4]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[4] + rotationAmounts[4]}deg);
          }
        }
        
        @keyframes rotateSlow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        @keyframes rotateSlowReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        
        .bg-shape {
          position: absolute;
          opacity: ${clampedIntensity};
          mix-blend-mode: normal;
        }
        
        .bg-shape-1 {
          width: 800px;
          height: 800px;
          background: var(--accent-a3);
          top: -200px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate1 ${durations[0]}s linear infinite`
              : `slideSlow ${durations[0]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 10px;' : ''}
        }
        
        .bg-shape-2 {
          width: 600px;
          height: 600px;
          background: var(--accent-a2);
          top: 20%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowReverseWithRotate2 ${durations[1]}s linear infinite`
              : `slideSlowReverse ${durations[1]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 20px;' : ''}
        }
        
        .bg-shape-3 {
          width: 1000px;
          height: 1000px;
          background: var(--accent-a3);
          bottom: -300px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate3 ${durations[2]}s linear infinite`
              : `slideSlow ${durations[2]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 10px;' : ''}
        }
        
        .bg-shape-4 {
          width: 400px;
          height: 400px;
          background: var(--accent-a2);
          top: 50%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowReverseWithRotate4 ${durations[3]}s linear infinite`
              : `slideSlowReverse ${durations[3]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 40px;' : ''}
        }
        
        .bg-shape-5 {
          width: 700px;
          height: 700px;
          background: var(--accent-a3);
          top: 10%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate5 ${durations[4]}s linear infinite`
              : `slideSlow ${durations[4]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 15px;' : ''}
        }
        
        /* Increase contrast for light mode */
        .light .bg-shape-1,
        .light .bg-shape-3,
        .light .bg-shape-5 {
          background: var(--accent-a7);
        }
        
        .light .bg-shape-2,
        .light .bg-shape-4 {
          background: var(--accent-a6);
        }
      `}</style>
      <div className="bg-shape bg-shape-1" />
      <div className="bg-shape bg-shape-2" />
      <div className="bg-shape bg-shape-3" />
      <div className="bg-shape bg-shape-4" />
      <div className="bg-shape bg-shape-5" />
    </Box>
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

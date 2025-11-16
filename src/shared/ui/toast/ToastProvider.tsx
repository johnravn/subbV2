// src/shared/ui/toast/ToastProvider.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import * as Toast from '@radix-ui/react-toast'
import { Text } from '@radix-ui/themes'
import { CheckCircleSolid, InfoCircle, WarningTriangle } from 'iconoir-react'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = {
  id: string
  title: string
  description?: string
  kind: ToastKind
  duration?: number
}

type ToastContextValue = {
  show: (opts: Omit<ToastItem, 'id' | 'kind'> & { kind?: ToastKind }) => void
  success: (title: string, description?: string, duration?: number) => void
  error: (title: string, description?: string, duration?: number) => void
  info: (title: string, description?: string, duration?: number) => void
}

const ToastCtx = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <AppToastProvider>')
  return ctx
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Array<ToastItem>>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const api: ToastContextValue = {
    show: ({ kind = 'info', ...rest }) => {
      // Log error to console for debugging when kind is 'error'
      if (kind === 'error') {
        console.error('[Toast Error]', {
          title: rest.title,
          description: rest.description,
          duration: rest.duration,
          timestamp: new Date().toISOString(),
          stack: new Error().stack,
        })
      }
      push({ kind, ...rest })
    },
    success: (title, description, duration) =>
      push({ kind: 'success', title, description, duration }),
    error: (title, description, duration) => {
      // Log error to console for debugging
      console.error('[Toast Error]', {
        title,
        description,
        duration,
        timestamp: new Date().toISOString(),
        stack: new Error().stack,
      })
      push({ kind: 'error', title, description, duration })
    },
    info: (title, description, duration) =>
      push({ kind: 'info', title, description, duration }),
  }

  const viewport = (
    <Toast.Viewport
      // Fixed viewport so toasts appear above dialogs, not inside them
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 'min(420px, calc(100vw - 32px))',
        zIndex: 2147483647, // Maximum z-index to appear above dialogs
        outline: 'none',
        pointerEvents: 'auto',
      }}
    />
  )

  return (
    <ToastCtx.Provider value={api}>
      <Toast.Provider swipeDirection="right">
        {children}

        {/* Render all active toasts */}
        {toasts.map((t) => {
          // Get border color based on toast kind
          const borderColor =
            t.kind === 'success'
              ? 'var(--green-9)'
              : t.kind === 'error'
                ? 'var(--red-9)'
                : 'var(--blue-9)'

          // Get icon color - using darker, more readable colors
          const iconColor =
            t.kind === 'success'
              ? 'var(--green-11)'
              : t.kind === 'error'
                ? 'var(--red-11)'
                : 'var(--blue-11)'

          // Get subtle background tint based on toast kind
          const backgroundTint =
            t.kind === 'success'
              ? 'rgba(46, 160, 67, 0.08)'
              : t.kind === 'error'
                ? 'rgba(231, 72, 74, 0.08)'
                : 'rgba(49, 130, 206, 0.08)'

          return (
            <Toast.Root
              key={t.id}
              open
              onOpenChange={(open) => {
                if (!open) remove(t.id)
              }}
              duration={t.duration ?? 3000}
              style={{
                background: backgroundTint,
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                border: `1.5px solid ${borderColor}`,
                borderRadius: 12,
                padding: 14,
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                maxWidth: 420,
                zIndex: 2147483647, // Maximum z-index to appear above dialogs
              }}
            >
              <div
                style={{
                  lineHeight: 0,
                  marginTop: 2,
                  color: iconColor,
                  flexShrink: 0,
                }}
              >
                {t.kind === 'success' ? (
                  <CheckCircleSolid width={20} height={20} />
                ) : t.kind === 'error' ? (
                  <WarningTriangle width={20} height={20} />
                ) : (
                  <InfoCircle width={20} height={20} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Toast.Title
                  style={{
                    fontWeight: 600,
                    color: 'var(--gray-12)',
                    fontSize: 14,
                    lineHeight: '20px',
                    marginBottom: t.description ? 4 : 0,
                  }}
                >
                  {t.title}
                </Toast.Title>
                {t.description && (
                  <Toast.Description asChild>
                    <Text
                      size="2"
                      style={{
                        color: 'var(--gray-11)',
                        lineHeight: '18px',
                      }}
                    >
                      {t.description}
                    </Text>
                  </Toast.Description>
                )}
              </div>
            </Toast.Root>
          )
        })}

        {/* Portal viewport to document.body to ensure it's rendered after dialogs in DOM order */}
        {mounted && typeof document !== 'undefined'
          ? createPortal(viewport, document.body)
          : viewport}
      </Toast.Provider>
    </ToastCtx.Provider>
  )
}

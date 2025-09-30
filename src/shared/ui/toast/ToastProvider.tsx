// src/shared/ui/toast/ToastProvider.tsx
import * as React from 'react'
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

  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const api: ToastContextValue = {
    show: ({ kind = 'info', ...rest }) => push({ kind, ...rest }),
    success: (title, description, duration) =>
      push({ kind: 'success', title, description, duration }),
    error: (title, description, duration) =>
      push({ kind: 'error', title, description, duration }),
    info: (title, description, duration) =>
      push({ kind: 'info', title, description, duration }),
  }

  return (
    <ToastCtx.Provider value={api}>
      <Toast.Provider swipeDirection="right">
        {children}

        {/* Render all active toasts */}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            open
            onOpenChange={(open) => {
              if (!open) remove(t.id)
            }}
            duration={t.duration ?? 3000}
            // Simple Radix-friendly styles; swap for your design system if you like
            style={{
              background:
                t.kind === 'success'
                  ? 'var(--green-9)'
                  : t.kind === 'error'
                    ? 'var(--red-9)'
                    : 'var(--gray-9)',
              color: 'white',
              borderRadius: 8,
              padding: 12,
              boxShadow: 'var(--shadow-4)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              maxWidth: 420,
            }}
          >
            <div style={{ lineHeight: 0, marginTop: 2 }}>
              {t.kind === 'success' ? (
                <CheckCircleSolid />
              ) : t.kind === 'error' ? (
                <WarningTriangle />
              ) : (
                <InfoCircle />
              )}
            </div>
            <div>
              <Toast.Title style={{ fontWeight: 600 }}>{t.title}</Toast.Title>
              {t.description && (
                <Toast.Description asChild>
                  <Text size="2" style={{ color: 'white' }}>
                    {t.description}
                  </Text>
                </Toast.Description>
              )}
            </div>
          </Toast.Root>
        ))}

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
            zIndex: 1000, // keep above sheets/dialogs
            outline: 'none',
          }}
        />
      </Toast.Provider>
    </ToastCtx.Provider>
  )
}

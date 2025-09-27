// main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import { RouterProvider } from '@tanstack/react-router'

import './app/styles.css'
import { router } from '@app/router/routes.tsx'
import { QueryProvider } from '@app/providers/QueryProvider.tsx'
import { AuthProvider } from '@app/providers/AuthProvider.tsx'
import reportWebVitals from './reportWebVitals.ts'

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <Theme radius="small" appearance="dark">
        <QueryProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryProvider>
      </Theme>
    </StrictMode>,
  )
}

reportWebVitals()

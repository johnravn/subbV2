// main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import './app/styles.css'
import AppShell from '@app/layout/AppShell.tsx'
import { router } from '@app/router/routes.tsx'
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
        <RouterProvider router={router} />
      </Theme>
    </StrictMode>,
  )
}

reportWebVitals()

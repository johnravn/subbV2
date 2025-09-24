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

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

import App from './App.tsx'
import Home from './pages/Home.tsx'
import Inventory from './pages/Inventory.tsx'
import ItemDetail from './pages/ItemDetail.tsx'

// Root: render your layout (App). App MUST contain <Outlet />.
const rootRoute = createRootRoute({
  component: () => (
    <>
      <App />
      <TanStackRouterDevtools />
    </>
  ),
})

// "/" (index) under root
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/', // index route under root
  component: Home,
})

// "/inventory"
const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'inventory',
  component: Inventory,
})

// "/inventory/:itemId"
const itemDetailRoute = createRoute({
  getParentRoute: () => inventoryRoute,
  path: '$itemId',
  component: ItemDetail,
})

// 404
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <div>Not found</div>,
})

// ✅ Do NOT nest homeRoute under itself, and only add it once
const routeTree = rootRoute.addChildren([
  homeRoute,
  inventoryRoute.addChildren([itemDetailRoute]),
  notFoundRoute,
])

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

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

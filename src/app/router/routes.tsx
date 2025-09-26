// src/app/router/routes.tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import AppShell from '../layout/AppShell'
import InventoryPage from '../../features/inventory/pages/InventoryPage'
import ItemPage from '../../features/inventory/pages/ItemPage'
import HomePage from '../../features/home/pages/HomePage' // keep simple pages here or move to a "home" feature

// const rootRoute = createRootRoute({ component: AppShell })
const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell />
      <TanStackRouterDevtools />
    </>
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'inventory',
  component: InventoryPage,
})

const itemRoute = createRoute({
  getParentRoute: () => inventoryRoute,
  path: '$itemId',
  component: ItemPage,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <div>Not found</div>,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  inventoryRoute.addChildren([itemRoute]),
  notFoundRoute,
])

export const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

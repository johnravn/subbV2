// src/app/router/routes.tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import CalendarPage from '@features/calendar/pages/CalendarPage'
import VehiclesPage from '@features/vehicles/pages/VehiclesPage'
import JobsPage from '@features/jobs/pages/JobsPage'
import CrewPage from '@features/crew/pages/CrewPage'
import InventoryPage from '@features/inventory/pages/InventoryPage'
import ItemPage from '@features/inventory/pages/ItemPage'
import HomePage from '@features/home/pages/HomePage'
import AppShell from '../layout/AppShell'

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

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'calendar',
  component: CalendarPage,
})
const vehiclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles',
  component: VehiclesPage,
})
const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'jobs',
  component: JobsPage,
})
const crewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'crew',
  component: CrewPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  inventoryRoute.addChildren([itemRoute]),
  calendarRoute,
  vehiclesRoute,
  jobsRoute,
  crewRoute,
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

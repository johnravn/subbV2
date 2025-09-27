// src/app/router/routes.tsx
import {
  Outlet,
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
import LoginPage from '@features/login/pages/LoginPage'
import { supabase } from '@shared/api/supabase'
import AppShell from '../layout/AppShell'
// import { Outlet } from '@tanstack/react-router'

// Root keeps your shell & devtools as-is
const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell />
      <TanStackRouterDevtools />
    </>
  ),
})

// --- PUBLIC: Login route -----------------------------------------------------
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: LoginPage,
})

// --- AUTH GUARD: Parent route that protects children -------------------------
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  // Runs before any child route loads. Redirects to /login if no session.
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session?.user) {
      throw redirect({
        to: '/login',
        // After login, send the user back here:
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})

// --- Your existing pages, now nested under authedRoute -----------------------
const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  component: HomePage,
})

const inventoryRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'inventory',
  component: InventoryPage,
})

const itemRoute = createRoute({
  getParentRoute: () => inventoryRoute,
  path: '$itemId',
  component: ItemPage,
})

const calendarRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'calendar',
  component: CalendarPage,
})

const vehiclesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'vehicles',
  component: VehiclesPage,
})

const jobsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'jobs',
  component: JobsPage,
})

const crewRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'crew',
  component: CrewPage,
})

// --- Not Found stays under root (public) -------------------------------------
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <div>Not found</div>,
})

const routeTree = rootRoute.addChildren([
  loginRoute, // public
  authedRoute.addChildren([
    // protected
    homeRoute,
    inventoryRoute.addChildren([itemRoute]),
    calendarRoute,
    vehiclesRoute,
    jobsRoute,
    crewRoute,
  ]),
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

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { RouterProvider } from '@tanstack/react-router'

import './app/styles.css'
import { router } from '@app/router/routes.tsx'
import { QueryProvider } from '@app/providers/QueryProvider.tsx'
import { AuthProvider } from '@app/providers/AuthProvider.tsx'
import { CompanyProvider } from '@shared/companies/CompanyProvider.tsx'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider.tsx'
import { IconContext } from 'react-icons/lib'
import reportWebVitals from './reportWebVitals.ts'
import 'react-phone-number-input/style.css'

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
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        <Theme radius="small">
          <QueryProvider>
            <AuthProvider>
              <CompanyProvider>
                <AppToastProvider>
                  <IconContext.Provider value={{ size: '1.5em' }}>
                    <RouterProvider router={router} />
                  </IconContext.Provider>
                </AppToastProvider>
              </CompanyProvider>
            </AuthProvider>
          </QueryProvider>
        </Theme>
      </NextThemesProvider>
    </StrictMode>,
  )
}

reportWebVitals()

# @tanstack/react-devtools

This package is still under active development and might have breaking changes in the future. Please use it with caution.

## Usage

```tsx
import { TanstackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <h1>My App</h1>
      <TanstackDevtools
        plugins={[
          {
            name: 'Tanstack Query',
            render: <ReactQueryDevtoolsPanel />,
          },
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel router={router} />,
          },
        ]}
      />
    </QueryClientProvider>
  )
}
```

## Creating plugins

In order to create a plugin for TanStack Devtools, you can use the `plugins` prop of the `TanstackDevtools` component. Here's an example of how to create a simple plugin:

```tsx
import { TanstackDevtools } from '@tanstack/react-devtools'

function App() {
  return (
    <div>
      <h1>My App</h1>
      <TanstackDevtools
        plugins={[
          {
            id: 'your-plugin-id',
            name: 'Your Plugin',
            render: <CustomPluginComponent />,
          },
        ]}
      />
    </div>
  )
}
```

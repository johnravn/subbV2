# Codebase Optimization & UX Consistency Suggestions

This document contains comprehensive suggestions for optimizing the codebase, improving design coherence, and ensuring consistent UX throughout the application.

## Executive Summary

**Overall Assessment**: The codebase is well-structured with good architectural decisions. Main areas for improvement are:

1. **Code Duplication** - Resizable panel logic duplicated across 3+ pages (~200 lines each)
2. **Inconsistent Patterns** - Loading states, error handling, and form patterns vary
3. **UX Inconsistency** - Toast messages, button styles, and empty states differ
4. **Performance** - Console logs in production, missing optimizations

**Key Metrics**:

- 398 `useQuery`/`useMutation` calls across 84 files
- 23 files with console logging
- 3+ pages with duplicated resizable panel code
- Multiple inspector components with similar patterns

**Quick Wins** (High Impact, Low Effort):

1. Create `ResizablePanels` component → Eliminates ~600 lines of duplication
2. Standardize loading states → Use existing `InspectorSkeleton` everywhere
3. Remove/guard console logs → Clean up 23 files
4. Standardize toast messages → Consistent UX across app

## Table of Contents

1. [Code Duplication & Reusability](#code-duplication--reusability)
2. [Component Patterns & Consistency](#component-patterns--consistency)
3. [Loading & Error States](#loading--error-states)
4. [Form Patterns](#form-patterns)
5. [API Patterns](#api-patterns)
6. [Performance Optimizations](#performance-optimizations)
7. [UX Consistency](#ux-consistency)
8. [Type Safety](#type-safety)
9. [Code Organization](#code-organization)

---

## Code Duplication & Reusability

### 1. **Resizable Panel Pattern** (High Priority)

**Issue**: The resizable panel logic is duplicated across multiple pages:

- `JobsPage.tsx` (lines 125-221)
- `CostumerPage.tsx` (lines 12-79)
- `InventoryPage.tsx` (likely similar)

**Solution**: Create a reusable `ResizablePanels` component:

```tsx
// src/shared/ui/components/ResizablePanels.tsx
type ResizablePanelsProps = {
  left: React.ReactNode
  right: React.ReactNode
  leftLabel?: string
  rightLabel?: string
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  canMinimize?: boolean
  breakpoint?: string
}
```

**Benefits**:

- Single source of truth for resize logic
- Consistent behavior across pages
- Easier to maintain and test

### 2. **Media Query Hook Duplication**

**Issue**: Multiple components manually implement media query logic:

- `JobsPage.tsx` (lines 125-140)
- `CostumerPage.tsx` (lines 12-27)
- `AppShell.tsx` uses `useMediaQuery` hook (good!)

**Solution**: Ensure all components use the existing `useMediaQuery` hook from `src/app/hooks/useMediaQuery.ts`. Remove manual implementations.

### 3. **Inspector Pattern**

**Issue**: Similar inspector patterns across:

- `JobInspector.tsx`
- `CustomerInspector.tsx`
- `VehicleInspector.tsx`
- `InventoryInspector.tsx`
- `CompanyInspector.tsx`

**Solution**: Create a base `Inspector` component with common patterns:

- Loading states
- Error states
- Empty states
- Action buttons layout
- Tab navigation (if applicable)

### 4. **Table/List Selection Pattern**

**Issue**: Selection state management is duplicated:

- Each table manages `selectedId` and `onSelect` independently
- Similar row highlighting logic repeated

**Solution**: Create a `SelectableTable` wrapper or hook `useTableSelection`:

```tsx
function useTableSelection(initialId?: string | null) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialId ?? null,
  )
  // URL sync logic
  // Return { selectedId, setSelectedId, isSelected }
}
```

### 5. **Dialog Pattern Standardization**

**Issue**: Dialogs have inconsistent patterns:

- Some use `mode: 'create' | 'edit'`
- Some have separate `Add*Dialog` and `Edit*Dialog` components
- Inconsistent form reset logic
- Inconsistent success/error handling

**Solution**: Create a standard `FormDialog` component or hook that handles:

- Create/edit mode switching
- Form state management
- Validation
- Loading states
- Success/error toasts
- Query invalidation

---

## Component Patterns & Consistency

### 6. **Loading State Inconsistency**

**Issue**: Different loading indicators used:

- `JobsPage.tsx`: Uses `PageSkeleton`
- `InventoryInspector.tsx`: Uses `Spinner` with "Thinking" text
- `CompanyInspector.tsx`: Uses `Spinner` with "Thinking" text
- Some use just `Spinner`

**Solution**: Standardize on:

- `PageSkeleton` for full-page loads
- `InspectorSkeleton` for inspector panels (already exists!)
- `Spinner` for inline/button loading states

**Action**: Update all inspectors to use `InspectorSkeleton`:

```tsx
if (isLoading) return <InspectorSkeleton />
```

### 7. **Error State Inconsistency**

**Issue**: Error messages vary:

- Some show: `"Failed to load. {error.message}"`
- Some show: `"Not found."`
- Some show: `"Preparing…"` when no company

**Solution**: Create standard error components:

```tsx
<ErrorState
  title="Failed to load"
  message={error?.message}
  onRetry={() => refetch()}
/>

<EmptyState
  title="Not found"
  description="The requested item could not be found"
/>
```

### 8. **Empty State Patterns**

**Issue**: Empty states are inconsistent:

- Tables: "No results" or "No vehicles"
- Inspectors: "Select an item to view details"
- Different styling and messaging

**Solution**: Create reusable `EmptyState` component with variants:

- `EmptyState.Table`
- `EmptyState.Inspector`
- `EmptyState.Search`

### 9. **Button Variants & Sizes**

**Issue**: Inconsistent button usage:

- Some use `variant="soft"`, others `variant="outline"`
- Size inconsistencies (`size="2"` vs `size="3"`)
- Icon buttons vs text buttons for similar actions

**Solution**: Document and enforce button usage:

- Primary actions: `variant="solid"`
- Secondary actions: `variant="soft"`
- Destructive: `variant="soft" color="red"`
- Icon-only: `IconButton variant="ghost"`

### 10. **Card Usage**

**Issue**: Cards used inconsistently:

- Some pages wrap content in `Card`, others don't
- Different `size` props (`size="3"` vs no size)

**Solution**: Standardize:

- Page content: `Card size="3"` (already mostly consistent)
- Nested content: `Card size="2"` or no card
- Ensure translucent background for animated background compatibility

---

## Loading & Error States

### 11. **Query Loading States**

**Issue**: Some queries don't handle loading states properly:

- `AppShell.tsx` queries user profile but doesn't show loading state
- Some components show content before data is ready

**Solution**:

- Always check `isLoading` before rendering data-dependent content
- Use suspense boundaries for better UX (optional, but recommended)

### 12. **Mutation Loading States**

**Issue**: Inconsistent mutation loading handling:

- Some disable buttons during mutation
- Some show spinners
- Some don't provide feedback

**Solution**: Create `useMutationWithToast` hook:

```tsx
function useMutationWithToast<TData, TVariables>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  options: {
    successMessage?: string
    errorMessage?: string
    onSuccess?: (data: TData) => void
    invalidateQueries?: QueryKey[]
  },
)
```

### 13. **Optimistic Updates**

**Issue**: No optimistic updates for mutations:

- Deleting items requires waiting for server response
- Creating items doesn't show immediately

**Solution**: Implement optimistic updates for:

- Delete operations (remove from list immediately)
- Create operations (add to list with temporary ID)
- Update operations (update UI immediately)

---

## Form Patterns

### 14. **Form State Management**

**Issue**: Forms use different state management:

- Some use individual `useState` for each field
- Some use single object state
- Inconsistent validation timing

**Solution**: Standardize on:

- Single form state object
- Use `react-hook-form` or similar for complex forms
- Or create a `useFormState` hook for simple forms

### 15. **Form Validation**

**Issue**: Validation is inconsistent:

- Some validate on submit
- Some validate on blur
- Some show errors inline, others in toasts

**Solution**: Create `FormField` wrapper component:

```tsx
<FormField label="Name" error={errors.name} required>
  <TextField.Root {...fieldProps} />
</FormField>
```

### 16. **Phone Number Input**

**Issue**: Phone input used inconsistently:

- Some use `PhoneInputField`
- Some use regular `TextField`
- Different default countries

**Solution**: Always use `PhoneInputField` for phone numbers, ensure consistent `defaultCountry="NO"`

### 17. **Address Input Pattern**

**Issue**: Address fields handled differently:

- Some use separate fields (address_line, zip_code, city, country)
- Some use comma-separated string
- Inconsistent parsing logic

**Solution**: Create `AddressInput` component that:

- Manages all address fields
- Handles serialization/deserialization
- Provides consistent validation

### 18. **Form Reset on Dialog Close**

**Issue**: Forms don't always reset when dialogs close:

- Some reset in `onSuccess`
- Some reset in `useEffect` watching `open`
- Some never reset

**Solution**: Create `useDialogForm` hook that:

- Resets form when dialog closes
- Handles initial data population
- Manages dirty state

---

## API Patterns

### 19. **Query Key Consistency**

**Issue**: Query keys are inconsistent:

- Some use `['company', companyId, 'customers']`
- Some use `['company', companyId, 'customers-index']`
- Some use `['my-companies', userId]`

**Solution**: Document and enforce query key patterns:

```tsx
// Pattern: [resource, id?, sub-resource?, ...]
;['company', companyId, 'customers'][
  ('company', companyId, 'customer', customerId)
][('auth', 'user')][('profile', userId)]
```

### 20. **Query Invalidation**

**Issue**: Invalidation is inconsistent:

- Some invalidate specific queries
- Some invalidate with `exact: false`
- Some don't invalidate related queries

**Solution**: Create helper functions:

```tsx
function invalidateCompanyQueries(companyId: string, resource?: string) {
  if (resource) {
    qc.invalidateQueries({ queryKey: ['company', companyId, resource] })
  } else {
    qc.invalidateQueries({ queryKey: ['company', companyId] }, { exact: false })
  }
}
```

### 21. **Error Handling in Queries**

**Issue**: Query error handling varies:

- Some throw errors
- Some return null
- Some return empty arrays

**Solution**: Standardize:

- Use `queryOptions` helper consistently
- Return `null` for "not found" (not an error)
- Throw errors for actual failures
- Handle in components with error boundaries or error states

### 22. **Activity Logging Pattern**

**Issue**: Activity logging is inconsistent:

- Some mutations log activities
- Some don't
- Error handling for logging varies (some catch, some don't)

**Solution**: Create `useActivityLogger` hook:

```tsx
function useActivityLogger() {
  return React.useCallback(async (activity: ActivityInput) => {
    try {
      await logActivity(activity)
    } catch (err) {
      console.error('Failed to log activity:', err)
      // Don't fail the operation
    }
  }, [])
}
```

---

## Performance Optimizations

### 23. **Unnecessary Re-renders**

**Issue**: Potential re-render issues:

- `AppShell.tsx` queries user profile on every render
- Some components don't memoize callbacks
- Some components don't use `React.memo` where beneficial

**Solution**:

- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback`
- Use `React.memo` for list items and pure components

### 24. **Query Stale Times**

**Issue**: Stale times are inconsistent:

- Some queries have `staleTime: 0`
- Some have `staleTime: 60_000`
- Some don't specify

**Solution**: Standardize stale times:

```tsx
const STALE_TIMES = {
  user: 60_000, // 1 minute
  company: 60_000,
  list: 10_000, // 10 seconds
  detail: 30_000, // 30 seconds
  realtime: 0, // Always fresh
}
```

### 25. **Large Query Results**

**Issue**: Some queries fetch large datasets:

- `inventoryIndexQuery` fetches all items
- No pagination for some lists

**Solution**:

- Implement server-side pagination where needed
- Use virtual scrolling for large lists
- Consider infinite scroll for feeds

### 26. **Console Logging in Production** ✅ (See #43)

### 27. **Image Optimization**

**Issue**: No image optimization:

- Avatars loaded directly from storage
- No lazy loading
- No placeholder/skeleton

**Solution**:

- Implement lazy loading for images
- Use placeholder images
- Consider image optimization service

---

## UX Consistency

### 28. **Toast Messages**

**Issue**: Toast messages are inconsistent:

- Some: `success('Success', 'Customer added')`
- Some: `success('Customer added')`
- Some: `error('Failed', message)`

**Solution**: Standardize toast messages:

```tsx
// Success: Just the action
success('Customer added')
// Error: Action + reason
error('Failed to add customer', error.message)
// Info: Context + detail
info('Processing', 'This may take a moment')
```

### 29. **Confirmation Dialogs**

**Issue**: Delete confirmations are inconsistent:

- Some use `AlertDialog`
- Some use custom dialogs
- Different messaging

**Solution**: Create standard `ConfirmDialog` component:

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete customer?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  variant="destructive"
  onConfirm={handleDelete}
/>
```

### 30. **Navigation Feedback**

**Issue**: No loading states during navigation:

- Users don't know if navigation is happening
- No transition feedback

**Solution**:

- Use TanStack Router's built-in loading states
- Add transition animations (already commented out in `AppShell.tsx`)

### 31. **Search UX**

**Issue**: Search behavior varies:

- Some search on type
- Some search on submit
- Different placeholder text

**Solution**: Standardize:

- Search on type with debounce (300ms)
- Consistent placeholder: "Search..."
- Clear button on all search inputs

### 32. **Table Interactions**

**Issue**: Table interactions are inconsistent:

- Some tables are sortable, others aren't
- Different selection styles
- Different hover effects

**Solution**:

- Make all tables sortable where appropriate
- Consistent selection highlighting: `var(--accent-a3)`
- Consistent hover effects

### 33. **Date/Time Display**

**Issue**: Date formatting is inconsistent:

- Some use `formatDate()`
- Some use `toLocaleString()`
- Different timezone handling

**Solution**: Create date formatting utilities:

```tsx
// src/shared/lib/dateFormat.ts
export function formatDate(iso: string): string
export function formatDateTime(iso: string): string
export function formatTime(iso: string): string
export function formatRelative(iso: string): string // "2 hours ago"
```

### 34. **Status Badges**

**Issue**: Status badges are inconsistent:

- Different colors for similar statuses
- Different variants (`soft` vs `solid`)

**Solution**: Create `StatusBadge` component:

```tsx
<StatusBadge status="active" />
<StatusBadge status="inactive" />
<StatusBadge status="pending" />
```

### 35. **Page Titles**

**Issue**: Page titles are inconsistent:

- Some pages have headings
- Some don't
- Different sizes

**Solution**: Ensure all pages have:

```tsx
<Heading size="5" mb="3">
  {pageTitle}
</Heading>
<Separator size="4" mb="3" />
```

---

## Type Safety

### 36. **Type Definitions**

**Issue**: Some types are defined inline:

- Props types defined in component files
- Some types duplicated across files

**Solution**:

- Move shared types to `types.ts` files in each feature
- Use `type` vs `interface` consistently (prefer `type` for unions, `interface` for objects)

### 37. **API Response Types**

**Issue**: API response types are inconsistent:

- Some use database types directly
- Some create separate DTOs
- Some use `any`

**Solution**:

- Create proper DTO types for API responses
- Avoid `any` types
- Use type guards for runtime validation

### 38. **Null vs Undefined**

**Issue**: Inconsistent use of `null` vs `undefined`:

- Some use `null` for "not found"
- Some use `undefined`
- Some use both

**Solution**: Standardize:

- Use `null` for "intentionally empty" (e.g., not found)
- Use `undefined` for "not set" (e.g., optional fields)
- Document the pattern

---

## Code Organization

### 39. **Feature Structure**

**Issue**: Feature structure is mostly good, but some inconsistencies:

- Some features have `utils/` folders
- Some don't
- API files sometimes in root, sometimes in `api/`

**Solution**: Standardize feature structure:

```
feature/
  api/
    queries.ts
    mutations.ts
    types.ts
  components/
    [feature]Table.tsx
    [feature]Inspector.tsx
    dialogs/
  pages/
    [Feature]Page.tsx
  types.ts
  utils/ (if needed)
```

### 40. **Shared Components Location**

**Issue**: Some shared components might be feature-specific:

- `CompanyLogoUpload` in `shared/ui/components/`
- Could be in `features/company/components/`

**Solution**:

- Keep truly shared components in `shared/ui/`
- Move feature-specific components to features
- Document what goes where

### 41. **Import Paths**

**Issue**: Import paths are mostly consistent with `@` aliases, but:

- Some use relative paths
- Some use `@app/`, some use `@features/`

**Solution**:

- Always use `@` aliases
- Prefer `@features/` over relative paths
- Document import path conventions

### 42. **Constants Organization**

**Issue**: Constants are scattered:

- Some in component files
- Some in separate files
- Magic numbers in code

**Solution**:

- Create `constants.ts` files for feature constants
- Extract magic numbers to named constants
- Document constants

---

## Specific Code Issues

### 43. **Console Logging Cleanup**

**Issue**: 23 files contain console.log/error/warn statements:

- `JobsPage.tsx` has extensive debug logging (lines 36-111)
- Some components log on every render
- Production code should not have debug logs

**Solution**:

- Remove or gate behind `import.meta.env.DEV`
- Use a logging utility:

```tsx
const log = import.meta.env.DEV ? console.log : () => {}
```

- Consider using a proper logging library for production

### 44. **Commented Code**

**Issue**: Commented code in several places:

- `AppShell.tsx` lines 224-235 (motion animations)
- `routes.tsx` line 32 (commented import)
- `routes.tsx` line 39 (commented devtools)

**Solution**:

- Remove commented code or uncomment if needed
- Use version control for history

### 45. **Unused Imports**

**Issue**: Some files may have unused imports (need to check with linter)

**Solution**:

- Run linter regularly
- Remove unused imports
- Consider using `eslint-plugin-unused-imports`

### 46. **Hardcoded Values**

**Issue**: Some hardcoded values:

- Breakpoints: `'1024px'`, `'768px'`
- Z-index values: `2147483647`
- Timeouts: `3000` (toast duration)

**Solution**: Extract to constants:

```tsx
// src/app/config/constants.ts
export const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px',
  desktop: '1280px',
} as const

export const Z_INDEX = {
  toast: 2147483647,
  dialog: 100,
  dropdown: 50,
} as const
```

---

## Priority Recommendations

### High Priority (Do First)

1. Create `ResizablePanels` component (eliminates ~200 lines of duplication)
2. Standardize loading/error states (use `InspectorSkeleton` everywhere)
3. Create `FormDialog` pattern (standardize all dialogs)
4. Standardize toast messages (consistent UX)
5. Remove/guard console logs (23 files need cleanup)

### Medium Priority

6. Create `Inspector` base component
7. Standardize table patterns
8. Implement optimistic updates
9. Create date formatting utilities
10. Extract constants

### Low Priority (Nice to Have)

11. Implement image optimization
12. Add transition animations (uncomment in AppShell.tsx)
13. Improve type safety (remove `any` types)
14. Document patterns (create style guide)
15. Add unit tests for shared utilities

---

## Implementation Strategy

1. **Phase 1**: Fix critical issues (syntax errors, broken patterns)
2. **Phase 2**: Create shared components (ResizablePanels, FormDialog, etc.)
3. **Phase 3**: Migrate existing code to use shared components
4. **Phase 4**: Standardize patterns (loading, errors, toasts)
5. **Phase 5**: Performance optimizations
6. **Phase 6**: Polish and consistency improvements

---

## Notes

- The codebase is generally well-structured
- Good use of React Query and TanStack Router
- TypeScript usage is good but could be stricter
- Component composition is good
- Main issues are consistency and duplication

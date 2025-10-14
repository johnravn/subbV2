import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
  activeOnly: boolean,
  allow_individual_booking: boolean,
  category: string | null,
  sortBy: SortBy,
  sortDir: SortDir,
  includeExternal: boolean, // 👈 add
) =>
  [
    'company',
    companyId,
    'inventory-index',
    page,
    pageSize,
    search,
    activeOnly,
    allow_individual_booking,
    category,
    sortBy,
    sortDir,
    includeExternal,
  ] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

function escapeForPostgrestOr(value: string) {
  // PostgREST uses commas and parentheses to separate conditions.
  // Strip or space them out so user input can't break the expression.
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ------------ Types (aligned to the views) ------------ */

export type InventoryIndexRow = {
  company_id: string
  id: string
  name: string
  category_name: string | null
  brand_name: string | null
  on_hand: number | null
  current_price: number | null
  currency: string // "NOK"
  is_group: boolean
  unique: boolean | null
  allow_individual_booking: boolean | null
  active: boolean // 👈 exists in the view (you filtered by it)
  // 👇 NEW
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
}

export type ItemPriceHistoryRow = {
  id: string
  amount: number

  effective_from: string
  effective_to: string | null
  set_by: string | null
  set_by_name?: string | null
}

export type ItemDetail = {
  id: string
  name: string
  type: 'item'
  category_name: string | null
  brand_name: string | null
  model: string | null
  allow_individual_booking: boolean
  active: boolean
  notes: string | null
  current_price: number | null
  on_hand: number | null
  price_history: Array<ItemPriceHistoryRow>
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
}

export type GroupPartRow = {
  item_id: string
  item_name: string
  quantity: number
  item_current_price: number | null
}

export type GroupDetail = {
  id: string
  name: string
  type: 'group'
  on_hand: number | null
  current_price: number | null
  category_name: string | null
  description: string | null
  active: boolean
  unique: boolean
  parts: Array<GroupPartRow>
  price_history: Array<ItemPriceHistoryRow>
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
}

export type InventoryDetail = ItemDetail | GroupDetail

export type SortBy =
  | 'name'
  | 'category_name'
  | 'brand_name'
  | 'on_hand'
  | 'current_price'

export type SortDir = 'asc' | 'desc'

// --- Category query keys ---
export const categoryNamesKey = (companyId: string) =>
  ['company', companyId, 'item-categories', 'names'] as const

export const categoryOptionsKey = (companyId: string) =>
  ['company', companyId, 'item-categories', 'options'] as const

// --- Names only (string[]) ---
export const categoryNamesQuery = ({ companyId }: { companyId: string }) =>
  queryOptions<
    Array<string>,
    Error,
    Array<string>,
    ReturnType<typeof categoryNamesKey>
  >({
    queryKey: categoryNamesKey(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      const names = data.map((c: any) => c.name).filter(Boolean)
      return Array.from(new Set(names))
    },
    staleTime: 60_000,
  })

// --- Full options ({ id, name }) ---
export type CategoryOption = { id: string; name: string }

export const categoryOptionsQuery = ({ companyId }: { companyId: string }) =>
  queryOptions<
    Array<CategoryOption>,
    Error,
    Array<CategoryOption>,
    ReturnType<typeof categoryOptionsKey>
  >({
    queryKey: categoryOptionsKey(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data.filter((c: any) => c.name) as Array<CategoryOption>
    },
    staleTime: 60_000,
  })

/* ------------ Index (Items + Groups) ------------ */

export const inventoryIndexQuery = ({
  companyId,
  page,
  pageSize,
  search,
  activeOnly,
  allow_individual_booking,
  category,
  sortBy,
  sortDir,
  includeExternal,
}: {
  companyId: string
  page: number
  pageSize: number
  search: string
  activeOnly: boolean
  allow_individual_booking: boolean
  category: string | null
  sortBy: SortBy
  sortDir: SortDir
  includeExternal: boolean
}) =>
  queryOptions<
    { rows: Array<InventoryIndexRow>; count: number },
    Error,
    { rows: Array<InventoryIndexRow>; count: number },
    ReturnType<typeof inventoryIndexKey>
  >({
    queryKey: inventoryIndexKey(
      companyId,
      page,
      pageSize,
      search,
      activeOnly,
      allow_individual_booking,
      category,
      sortBy,
      sortDir,
      includeExternal,
    ),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase
        .from('inventory_index')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)

      // exclude deleted rows
      q = q.or('deleted.is.null,deleted.eq.false')

      if (activeOnly) q = q.eq('active', true)

      // Items must allow individual booking if the filter is on,
      // but groups should still be included.
      if (allow_individual_booking) {
        // "include if (is_group) OR (allow_individual_booking)"
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      }

      if (!includeExternal) q = q.eq('internally_owned', true) // 👈 NEW

      if (category && category !== 'all') q = q.eq('category_name', category)

      if (search) {
        const s = escapeForPostgrestOr(search)
        // IMPORTANT: no wrapping parentheses here
        q = q.or(
          `name.ilike.*${s}*,category_name.ilike.*${s}*,brand_name.ilike.*${s}*`,
        )
      }

      // Server-side sort + stable tiebreaker for pagination
      q = q
        .order(sortBy, {
          ascending: sortDir === 'asc',
          nullsFirst: false,
        })
        .order('id', { ascending: true }) // 👈 stable secondary sort

      const { data, error, count } = await q.range(from, to)
      if (error) throw error
      return {
        rows: data as Array<InventoryIndexRow>,
        count: count ?? 0,
      }
    },
    staleTime: 10_000,
  })

/* ------------ Detail (DRIVEN BY inventory_index) ------------ */
/* If a row is visible in the index, detail will render. We enrich from
   base tables/views (notes, model, parts, history). If those are not
   visible due to RLS, we still return a complete shape using the index row. */

export const inventoryDetailQuery = ({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) =>
  queryOptions<
    InventoryDetail | null,
    Error,
    InventoryDetail | null,
    ReturnType<typeof inventoryDetailKey>
  >({
    queryKey: inventoryDetailKey(companyId, id),
    // Keep retries low; data either exists (by index) or doesn't
    retry: (failCount, _err: any) => failCount < 2,
    queryFn: async () => {
      const TAG = 'inventoryDetailQuery'
      const RUN = `${TAG}#${performance.now().toFixed(3)}`
      const t = (s: string) => `[${RUN}] ${s}`

      console.groupCollapsed(t('start'), { companyId, id })
      console.time(t('total'))
      const safeEnd = () => {
        try {
          console.timeEnd(t('total'))
        } catch {}
        try {
          console.groupEnd()
        } catch {}
      }
      const logSb = <T>(label: string, res: { data: T | null; error: any }) => {
        if (res.error) {
          console.error(t(`${label} ERROR`), {
            code: res.error?.code,
            details: res.error?.details,
            hint: res.error?.hint,
            message: res.error?.message,
          })
        } else {
          const d: any = res.data
          Array.isArray(d)
            ? console.log(t(`${label} OK`), { rows: d.length, sample: d[0] })
            : console.log(t(`${label} OK`), { row: d })
        }
      }

      try {
        // 1) Always read the base row from the SAME view the list uses
        console.time(t('INDEX base'))
        const { data: base, error: baseErr } = await supabase
          .from('inventory_index')
          .select('*')
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<InventoryIndexRow>()
        logSb('INDEX base', { data: base, error: baseErr })
        console.timeEnd(t('INDEX base'))

        if (baseErr) {
          safeEnd()
          throw baseErr
        }
        if (!base) {
          // If it isn't even in the index, it's truly not visible to this user
          safeEnd()
          return null
        }

        // 2) Branch by type (using is_group from index)
        if (!base.is_group) {
          // ----- ITEM -----
          // Optional enrich: notes, model, flags from base table (might be RLS'd)
          console.time(t('ITEM enrich'))
          const { data: itemMeta, error: itemErr } = await supabase
            .from('items')
            .select(
              `
              id,
              model,
              notes,
              allow_individual_booking,
              active
            `,
            )
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle<{
              id: string
              model: string | null
              notes: string | null
              allow_individual_booking: boolean | null
              active: boolean | null
            }>()
          logSb('ITEM enrich', { data: itemMeta, error: itemErr })
          console.timeEnd(t('ITEM enrich'))
          // Do NOT throw on itemErr — just fall back to index row

          // Price history (view; usually RLS-safe)
          console.time(t('ITEM history'))
          const { data: hist, error: hErr } = await supabase
            .from('item_price_history_with_profile')
            .select(
              'id, amount, effective_from, effective_to, set_by, set_by_name',
            )
            .eq('company_id', companyId)
            .eq('item_id', id)
            .order('effective_from', { ascending: false })
          logSb('ITEM history', { data: hist, error: hErr })
          console.timeEnd(t('ITEM history'))
          if (hErr) {
            safeEnd()
            throw hErr
          }

          const result: ItemDetail = {
            id: base.id,
            name: base.name,
            type: 'item',
            category_name: base.category_name ?? null,
            brand_name: base.brand_name ?? null,
            model: itemMeta?.model ?? null,
            allow_individual_booking: Boolean(
              itemMeta?.allow_individual_booking ??
                base.allow_individual_booking,
            ),
            active: Boolean(itemMeta?.active ?? base.active),
            notes: itemMeta?.notes ?? null,
            current_price: base.current_price ?? null,
            on_hand: base.on_hand ?? 0,
            price_history: hist as Array<ItemPriceHistoryRow>,
            internally_owned: base.internally_owned,
            external_owner_id: base.external_owner_id,
            external_owner_name: base.external_owner_name,
          }

          console.log(t('RETURN item'), {
            id: result.id,
            name: result.name,
            current_price: result.current_price,
            on_hand: result.on_hand,
            price_history_len: result.price_history.length,
          })
          safeEnd()
          return result
        } else {
          // ----- GROUP -----
          // Optional enrich: description/unique/active from base table (may be RLS'd)
          console.time(t('GROUP enrich'))
          const { data: gmeta, error: gErr } = await supabase
            .from('item_groups')
            .select('id, description, unique, active')
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle<{
              id: string
              description: string | null
              unique: boolean | null
              active: boolean | null
            }>()
          logSb('GROUP enrich', { data: gmeta, error: gErr })
          console.timeEnd(t('GROUP enrich'))
          // No throw on gErr — we can fall back to index

          // Rollups (or fall back to index)
          console.time(t('GROUP rollups'))
          const { data: roll, error: rErr } = await supabase
            .from('groups_with_rollups')
            .select('on_hand, current_price')
            .eq('id', id)
            .maybeSingle<{
              on_hand: number | null
              current_price: number | null
            }>()
          logSb('GROUP rollups', { data: roll, error: rErr })
          console.timeEnd(t('GROUP rollups'))
          if (rErr && rErr.code !== 'PGRST116') {
            safeEnd()
            throw rErr
          }

          // Parts (view; usually RLS-safe)
          console.time(t('GROUP parts'))
          const { data: parts, error: pErr } = await supabase
            .from('group_parts')
            .select('item_id, item_name, quantity, item_current_price')
            .eq('group_id', id)
          logSb('GROUP parts', { data: parts, error: pErr })
          console.timeEnd(t('GROUP parts'))
          if (pErr) {
            safeEnd()
            throw pErr
          }

          // History (view)
          console.time(t('GROUP history'))
          const { data: ghist, error: ghErr } = await supabase
            .from('group_price_history_with_profile')
            .select(
              'id, amount, effective_from, effective_to, set_by, set_by_name',
            )
            .eq('company_id', companyId)
            .eq('group_id', id)
            .order('effective_from', { ascending: false })
          logSb('GROUP history', { data: ghist, error: ghErr })
          console.timeEnd(t('GROUP history'))
          if (ghErr) {
            safeEnd()
            throw ghErr
          }

          const result: GroupDetail = {
            id: base.id,
            name: base.name,
            type: 'group',
            on_hand: roll?.on_hand ?? base.on_hand ?? 0,
            current_price: roll?.current_price ?? base.current_price ?? null,
            category_name: base.category_name ?? null,
            description: gmeta?.description ?? null,
            active: Boolean(gmeta?.active ?? base.active),
            unique: Boolean(gmeta?.unique ?? base.unique ?? false),
            parts: parts as Array<GroupPartRow>,
            price_history: ghist as Array<ItemPriceHistoryRow>,
            internally_owned: base.internally_owned,
            external_owner_id: base.external_owner_id,
            external_owner_name: base.external_owner_name,
          }

          console.log(t('RETURN group'), {
            id: result.id,
            name: result.name,
            current_price: result.current_price,
            on_hand: result.on_hand,
            parts_len: result.parts.length,
            price_history_len: result.price_history.length,
          })
          safeEnd()
          return result
        }
      } catch (e: any) {
        console.error(t('THROW'), {
          name: e?.name,
          message: e?.message,
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
        })
        safeEnd()
        throw e
      }
    },
  })

import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
  activeOnly: boolean,
  category: string | null,
) =>
  [
    'company',
    companyId,
    'inventory-index',
    page,
    pageSize,
    search,
    activeOnly,
    category,
  ] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

/* ------------ Types (aligned to the new view) ------------ */

export type InventoryIndexRow = {
  company_id: string
  id: string
  name: string
  category_name: string | null
  brand_name: string | null
  on_hand: number | null
  current_price: number | null
  currency: string // "NOK" per your view
}

// Add/adjust these in queries.ts

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
  parts: Array<GroupPartRow>
}

export type InventoryDetail = ItemDetail | GroupDetail

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
      // de-dup just in case + strip nulls
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
  category,
}: {
  companyId: string
  page: number
  pageSize: number
  search: string
  activeOnly: boolean // 👈 add
  category: string | null
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
      category,
    ),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase
        .from('inventory_index')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)

      q = q.or('deleted.is.null,deleted.eq.false')
      if (activeOnly) q = q.eq('active', true)
      if (category && category != 'all') q = q.eq('category_name', category) // 👈 filter by category
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,category_name.ilike.%${search}%,brand_name.ilike.%${search}%`,
        )
      }

      const { data, error, count } = await q.range(from, to)
      if (error) throw error
      return {
        rows: data as Array<InventoryIndexRow>,
        count: count ?? 0,
      }
    },
    staleTime: 10_000,
  })

/* ------------ Detail (try item, then group) ------------ */

export const inventoryDetailQuery = ({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) =>
  queryOptions<
    InventoryDetail,
    Error,
    InventoryDetail,
    ReturnType<typeof inventoryDetailKey>
  >({
    queryKey: inventoryDetailKey(companyId, id),
    queryFn: async () => {
      // inside inventoryDetailQuery's item branch
      {
        type Row = {
          id: string
          company_id: string
          name: string
          category_name: string | null
          brand_name: string | null
          model: string | null
          allow_individual_booking: boolean
          active: boolean
          notes: string | null
          total_quantity: number | null
          current_price: number | null
        }

        const { data, error } = await supabase
          .from('items')
          .select(
            `
    id,
    company_id,
    name,
    model,
    allow_individual_booking,
    active,
    notes,
    total_quantity,
    category:item_categories(name),
    brand:item_brands(name)
  `,
          )
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<any>()

        if (error && error.code !== 'PGRST116') throw error
        if (data) {
          // 🔹 fetch current price from the view explicitly
          const { data: cp, error: cpErr } = await supabase
            .from('item_current_price')
            .select('current_price')
            .eq('item_id', data.id)
            .maybeSingle<{ current_price: number }>()
          if (cpErr && cpErr.code !== 'PGRST116') throw cpErr

          // price history (unchanged)
          const { data: hist, error: hErr } = await supabase
            .from('item_price_history_with_profile')
            .select(
              'id, amount, effective_from, effective_to, set_by, set_by_name',
            )
            .eq('company_id', companyId)
            .eq('item_id', data.id)
            .order('effective_from', { ascending: false })
          if (hErr) throw hErr

          return {
            id: data.id,
            name: data.name,
            type: 'item',
            category_name: data.category?.name ?? null,
            brand_name: data.brand?.name ?? null,
            model: data.model ?? null,
            allow_individual_booking: Boolean(data.allow_individual_booking),
            active: Boolean(data.active),
            notes: data.notes ?? null,
            current_price: cp?.current_price ?? null, // 👈 now populated
            on_hand: data.total_quantity ?? 0,
            price_history: hist.map((h) => ({
              id: h.id,
              amount: h.amount,
              effective_from: h.effective_from,
              effective_to: h.effective_to,
              set_by: h.set_by,
              set_by_name: h.set_by_name,
            })),
          } as ItemDetail
        }
      }

      // Then GROUP
      {
        type GroupRow = {
          id: string
          company_id: string
          name: string
          on_hand: number | null
          current_price: number | null
        }
        const { data: group, error: gErr } = await supabase
          .from('groups_with_rollups')
          .select('id, company_id, name, on_hand, current_price')
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<GroupRow>()

        if (gErr && gErr.code !== 'PGRST116') throw gErr
        if (!group) throw gErr ?? new Error('Not found')

        const { data: parts, error: pErr } = await supabase
          .from('group_parts')
          .select('item_id, item_name, quantity, item_current_price')
          .eq('group_id', group.id)

        if (pErr) throw pErr

        return {
          id: group.id,
          name: group.name,
          type: 'group',
          on_hand: group.on_hand ?? 0,
          current_price: group.current_price,
          parts: parts as Array<GroupPartRow>,
        }
      }
    },
  })

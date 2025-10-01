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
  ] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

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
  price_history: Array<ItemPriceHistoryRow> // 👈 add this
}

export type InventoryDetail = ItemDetail | GroupDetail

// types you already have
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
      if (allow_individual_booking) {
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      }
      if (category && category !== 'all') q = q.eq('category_name', category)
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,category_name.ilike.%${search}%,brand_name.ilike.%${search}%`,
        )
      }

      q = q.order(sortBy, {
        ascending: sortDir === 'asc',
        nullsFirst: false,
      })

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
      // Try ITEM first
      {
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
          // current item price
          const { data: cp, error: cpErr } = await supabase
            .from('item_current_price')
            .select('current_price')
            .eq('item_id', data.id)
            .maybeSingle<{ current_price: number }>()
          if (cpErr && cpErr.code !== 'PGRST116') throw cpErr

          // price history
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
            current_price: cp?.current_price ?? null,
            on_hand: data.total_quantity ?? 0,
            price_history: hist.map((h: any) => ({
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
        // base group meta (with category name)
        const { data: gmeta, error: gErr } = await supabase
          .from('item_groups')
          .select(
            `
        id,
        company_id,
        name,
        active,
        description,
        unique,
        category:item_categories(name)
      `,
          )
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<any>()
        if (gErr && gErr.code !== 'PGRST116') throw gErr
        if (!gmeta) throw gErr ?? new Error('Not found')

        // rollups (on_hand, current_price)
        const { data: roll, error: rErr } = await supabase
          .from('groups_with_rollups')
          .select('on_hand, current_price')
          .eq('id', gmeta.id)
          .maybeSingle<{
            on_hand: number | null
            current_price: number | null
          }>()
        if (rErr && rErr.code !== 'PGRST116') throw rErr

        // parts
        const { data: parts, error: pErr } = await supabase
          .from('group_parts')
          .select('item_id, item_name, quantity, item_current_price')
          .eq('group_id', gmeta.id)
        if (pErr) throw pErr

        // price history (for groups)
        const { data: ghist, error: ghErr } = await supabase
          .from('group_price_history_with_profile')
          .select(
            'id, amount, effective_from, effective_to, set_by, set_by_name',
          )
          .eq('company_id', companyId)
          .eq('group_id', gmeta.id)
          .order('effective_from', { ascending: false })
        if (ghErr) throw ghErr

        return {
          id: gmeta.id,
          name: gmeta.name,
          type: 'group',
          on_hand: roll?.on_hand ?? 0,
          current_price: roll?.current_price ?? null,
          category_name: gmeta.category?.name ?? null,
          description: gmeta.description ?? null,
          active: Boolean(gmeta.active),
          unique: Boolean(gmeta.unique),
          parts: parts as Array<GroupPartRow>,
          price_history: ghist as Array<ItemPriceHistoryRow>, // 👈 include it
        } as GroupDetail
      }
    },
  })

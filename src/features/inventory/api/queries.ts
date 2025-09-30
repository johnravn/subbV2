import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
) => ['company', companyId, 'inventory-index', page, pageSize, search] as const

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

export type ItemDetail = {
  id: string
  name: string
  type: 'item'
  category_name: string | null
  current_price: number | null
  on_hand: number | null
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
  parts: GroupPartRow[]
}

export type InventoryDetail = ItemDetail | GroupDetail

/* ------------ Index (Items + Groups) ------------ */

export const inventoryIndexQuery = ({
  companyId,
  page,
  pageSize,
  search,
}: {
  companyId: string
  page: number
  pageSize: number
  search: string
}) =>
  queryOptions<
    { rows: Array<InventoryIndexRow>; count: number },
    Error,
    { rows: Array<InventoryIndexRow>; count: number },
    ReturnType<typeof inventoryIndexKey>
  >({
    queryKey: inventoryIndexKey(companyId, page, pageSize, search),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase
        .from('inventory_index')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)

      if (search) {
        // Keep it simple: name search.
        // If you want to search category/brand too, use .or() as shown below in the note.
        q = q.or(
          `name.ilike.%${search}%,category_name.ilike.%${search}%,brand_name.ilike.%${search}%`,
        )
      }

      const { data, error, count } = await q.range(from, to)
      if (error) throw error
      return {
        rows: (data ?? []) as Array<InventoryIndexRow>,
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
      // Try ITEM first (via a view that exposes category_name + current_price)
      {
        type Row = {
          id: string
          company_id: string
          name: string
          category_name: string | null
          total_quantity: number | null
          current_price: number | null
        }
        const { data, error } = await supabase
          .from('items_with_price') // recommend: a view joining items + item_categories + item_current_price
          .select(
            'id, company_id, name, category_name, total_quantity, current_price',
          )
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<Row>()

        // PGRST116 = no rows
        if (error && error.code !== 'PGRST116') throw error
        if (data) {
          return {
            id: data.id,
            name: data.name,
            type: 'item',
            category_name: data.category_name,
            current_price: data.current_price,
            on_hand: data.total_quantity ?? 0,
          }
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
          parts: (parts ?? []) as GroupPartRow[],
        }
      }
    },
  })

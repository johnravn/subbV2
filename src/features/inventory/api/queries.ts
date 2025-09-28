import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type { UseQueryOptions } from '@tanstack/react-query'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
) => ['company', companyId, 'inventory-index', page, pageSize, search] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

/* ------------ Types (unchanged) ------------ */

export type InventoryIndexRow = {
  company_id: string
  id: string
  name: string
  type: 'item' | 'bundle'
  kind: string | null
  on_hand: number | null
  currency: string | null
  current_price: number | null
}

export type ItemDetail = {
  id: string
  name: string
  type: 'item'
  kind: string
  currency: string | null
  current_price: number | null
  on_hand: number | null
}

export type BundleUnitRow = {
  unit_id: string
  inventory_units: {
    serial_number: string | null
    inventory_items: { name: string | null } | null
  } | null
}

export type BundleDetail = {
  id: string
  name: string
  type: 'bundle'
  units: Array<{
    unit_id: string
    serial_number: string | null
    item_name: string | null
  }>
}

export type InventoryDetail = ItemDetail | BundleDetail

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
    // TQueryFnData
    { rows: Array<InventoryIndexRow>; count: number },
    // TError
    Error,
    // TData (same as TQueryFnData here)
    { rows: Array<InventoryIndexRow>; count: number },
    // TQueryKey
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

      if (search) q = q.ilike('name', `%${search}%`)

      const { data, error, count } = await q.range(from, to)
      if (error) throw error
      return {
        rows: (data ?? []) as Array<InventoryIndexRow>,
        count: count ?? 0,
      }
    },
    staleTime: 10_000,
  })

/* ------------ Detail (try item, then bundle) ------------ */

export const inventoryDetailQuery = ({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) =>
  queryOptions<
    // TQueryFnData
    InventoryDetail,
    // TError
    Error,
    // TData (same)
    InventoryDetail,
    // TQueryKey
    ReturnType<typeof inventoryDetailKey>
  >({
    queryKey: inventoryDetailKey(companyId, id),
    queryFn: async () => {
      // Try item (scoped)
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select(
          'id, company_id, name, kind, currency, current_price, inventory_stock(on_hand)',
        )
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle<{
          id: string
          company_id: string
          name: string
          kind: string
          currency: string | null
          current_price: number | null
          inventory_stock: Array<{ on_hand: number }> | null
        }>()

      if (item) {
        return {
          id: item.id,
          name: item.name,
          type: 'item',
          kind: item.kind,
          currency: item.currency,
          current_price: item.current_price,
          on_hand: item.inventory_stock?.[0]?.on_hand ?? null,
        }
      }

      // Try bundle (scoped)
      const { data: bundle, error: bErr } = await supabase
        .from('bundles')
        .select('id, company_id, name')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle<{ id: string; company_id: string; name: string }>()

      if (bundle) {
        const { data: units, error: unitsErr } = await supabase
          .from('bundle_units')
          .select(
            `
            unit_id,
            inventory_units (
              serial_number,
              inventory_items ( name )
            )
          `,
          )
          .eq('bundle_id', bundle.id)
          .returns<Array<BundleUnitRow>>()

        if (unitsErr) throw unitsErr

        return {
          id: bundle.id,
          name: bundle.name,
          type: 'bundle',
          units:
            units?.map((u) => ({
              unit_id: u.unit_id,
              serial_number: u.inventory_units?.serial_number ?? null,
              item_name: u.inventory_units?.inventory_items?.name ?? null,
            })) ?? [],
        }
      }

      if (itemErr) throw itemErr
      throw bErr ?? new Error('Not found')
    },
  })

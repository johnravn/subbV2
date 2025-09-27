// features/inventory/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export type InventoryRow = {
  id: string
  name: string
  quantity: number
  created_at: string
}

export type InventoryResult = { rows: Array<InventoryRow>; count: number }

export const inventoryTableQuery = ({
  page,
  pageSize,
  search,
}: {
  page: number
  pageSize: number
  search: string
}) =>
  queryOptions<InventoryResult>({
    queryKey: ['inventory', page, pageSize, search],
    queryFn: async (): Promise<InventoryResult> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase.from('items').select('*', { count: 'exact' })
      if (search) q = q.ilike('name', `%${search}%`)

      const { data, error, count } = await q.range(from, to)
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return { rows: (data as Array<InventoryRow>) ?? [], count: count ?? 0 }
    },

    // v5 replacement for keepPreviousData:
    // show the last successful data while the new queryKey is fetching
    placeholderData: (prev) => prev,

    // (optional) keep data in cache longer to make back/forward snappy
    gcTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 10_000, // data considered fresh for 10s
  })

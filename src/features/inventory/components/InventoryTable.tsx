// src/features/inventory/components/InventoryTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button, Flex, Table, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { inventoryIndexQuery } from '../api/queries'
import type { ColumnDef } from '@tanstack/react-table'
import type { InventoryIndexRow } from '../api/queries'

// Make sure InventoryIndexRow matches the view:
// {
//   company_id: string
//   id: string
//   name: string
//   category_name: string | null
//   brand_name: string | null
//   on_hand: number | null
//   current_price: number | null
//   currency: string // "NOK"
// }

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function InventoryTable({ selectedId, onSelect }: Props) {
  const { companyId } = useCompany()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const pageSize = 13

  const { data, isLoading } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '__none__',
      page,
      pageSize,
      search,
    }),
    enabled: !!companyId,
  })

  const fmt = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

  const columns = React.useMemo<Array<ColumnDef<InventoryIndexRow>>>(
    () => [
      // name
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (ctx) => (
          <Text size="2" weight="medium">
            {String(ctx.getValue() ?? '')}
          </Text>
        ),
      },
      // category_name
      {
        accessorKey: 'category_name',
        header: 'Category',
        cell: (ctx) => (
          <Text size="2" color="gray">
            {String(ctx.getValue() ?? '')}
          </Text>
        ),
      },
      // brand_name
      {
        accessorKey: 'brand_name',
        header: 'Brand',
        cell: (ctx) => (
          <Text size="2" color="gray">
            {String(ctx.getValue() ?? '')}
          </Text>
        ),
      },
      // on_hand
      {
        accessorKey: 'on_hand',
        header: 'On hand',
        cell: (ctx) => String(ctx.getValue() ?? ''),
      },
      // current_price + currency from the row (still NOK today, but future-proof)
      {
        id: 'price',
        header: 'Price',
        cell: (ctx) => {
          const v = ctx.row.original
          if (v.current_price == null) return ''
          // Use row.currency if you ever support multi-currency.
          return fmt.format(Number(v.current_price))
        },
      },
    ],
    [fmt],
  )

  const table = useReactTable({
    data: data?.rows as Array<InventoryIndexRow>,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      {/* Search bar */}
      <Flex gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="Search items, groups…"
          size="3"
          style={{ flex: '1 1 260px' }}
        />
      </Flex>

      {/* Table */}
      <Table.Root variant="surface" style={{ marginTop: 16 }}>
        <Table.Header>
          {table.getHeaderGroups().map((hg) => (
            <Table.Row key={hg.id}>
              {hg.headers.map((h) => (
                <Table.ColumnHeaderCell key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </Table.ColumnHeaderCell>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body>
          {isLoading ? (
            <Table.Row>
              <Table.Cell colSpan={columns.length}>Loading…</Table.Cell>
            </Table.Row>
          ) : table.getRowModel().rows.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={columns.length}>No results</Table.Cell>
            </Table.Row>
          ) : (
            table.getRowModel().rows.map((row) => {
              const active = row.original.id === selectedId
              return (
                <Table.Row
                  key={row.id}
                  onClick={() => onSelect(row.original.id)}
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--accent-a3)' : undefined,
                  }}
                  data-state={active ? 'active' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.Cell>
                  ))}
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table.Root>

      {/* Pagination */}
      <Flex gap="2" mt="3">
        <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <Button
          disabled={!data || data.rows.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Flex>
    </>
  )
}

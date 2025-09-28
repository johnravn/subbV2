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

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  companyId: string
}

export default function InventoryTable({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { companyId } = useCompany()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const pageSize = 20

  const { data, isLoading } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '__none__', // placeholder
      page,
      pageSize,
      search: search, // avoid undefined in the key
    }),
    enabled: !!companyId, // only runs when a company is selected
  })

  const columns = React.useMemo<Array<ColumnDef<any>>>(
    () => [
      {
        accessorKey: 'type',
        header: 'Type',
        cell: (ctx) => <Text size="2">{ctx.getValue() as string}</Text>,
      },
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'kind',
        header: 'Kind',
        cell: (ctx) => (
          <Text size="2" color="gray">
            {ctx.getValue() as string}
          </Text>
        ),
      },
      {
        accessorKey: 'on_hand',
        header: 'On hand',
        cell: (ctx) => ctx.getValue() ?? '',
      },
      {
        accessorKey: 'current_price',
        header: 'Price',
        cell: (ctx) => {
          const v = ctx.row.original
          if (v.current_price == null) return ''
          return `${v.currency ?? 'NOK'} ${Number(v.current_price).toFixed(2)}`
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: data?.rows ?? [],
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
          placeholder="Search items, bundles…"
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

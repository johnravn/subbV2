import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button, Flex, Table, TextField } from '@radix-ui/themes'
import React from 'react'
import { inventoryTableQuery } from '../api/queries'

export default function InventoryTable() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const { data, isLoading } = useQuery(
    inventoryTableQuery({ page, pageSize: 20, search }),
  )

  const table = useReactTable({
    data: data?.rows ?? [],
    columns: [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'quantity', header: 'Qty' },
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      {/* Search bar */}
      <TextField.Root
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items..."
      />

      {/* Table */}
      <Table.Root variant="surface" style={{ marginTop: 16 }}>
        <Table.Header>
          {table.getHeaderGroups().map((hg) => (
            <Table.Row key={hg.id}>
              {hg.headers.map((h) => (
                <Table.Cell key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body>
          {table.getRowModel().rows.map((row) => (
            <Table.Row key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Cell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {/* Pagination */}
      <Flex gap="2" mt="3">
        <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <Button
          disabled={!data || data.rows.length < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Flex>
    </>
  )
}

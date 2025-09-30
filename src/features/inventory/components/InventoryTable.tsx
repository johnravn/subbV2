// src/features/inventory/components/InventoryTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Button,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { categoryNamesQuery, inventoryIndexQuery } from '../api/queries'
import EditCategoriesDialog from './EditCategoriesDialog'
import EditBrandsDialog from './EditBrandsDialog'
import AddItemDialog from './AddItemDialog'
import AddGroupDialog from './AddGroupDialog'
import type { ColumnDef } from '@tanstack/react-table'
import type { InventoryIndexRow } from '../api/queries'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  activeOnly: boolean
}

export default function InventoryTable({
  selectedId,
  onSelect,
  activeOnly,
}: Props) {
  const { companyId } = useCompany()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )
  const pageSize = 13

  const [addItemOpen, setAddItemOpen] = React.useState(false)
  const [addGroupDialog, setAddGroupDialog] = React.useState(false)
  const [editCategoriesOpen, setEditCategoriesOpen] = React.useState(false)
  const [editBrandsOpen, setEditBrandsOpen] = React.useState(false)

  const { data, isLoading, isFetching } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '__none__',
      page,
      pageSize,
      search,
      activeOnly,
      category: categoryFilter,
    }),
    enabled: !!companyId,
  })

  const { data: categories = [] } = useQuery({
    ...categoryNamesQuery({ companyId: companyId ?? '__none__' }),
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
  console.log('data.rows.length: ' + data?.rows.length)
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
        >
          <TextField.Slot side="right">
            {isFetching && <Spinner />}
          </TextField.Slot>
        </TextField.Root>

        <Select.Root
          value={categoryFilter ?? ''}
          size="3"
          onValueChange={(val) => {
            setPage(1)
            setCategoryFilter(val === '' ? null : val)
          }}
        >
          <Select.Trigger
            placeholder="Filter category…"
            style={{ minHeight: 'var(--space-7)' }} // 👈 match TextField height
          />
          <Select.Content>
            <Select.Item value="all">All</Select.Item>
            {categories.map((name) => (
              <Select.Item key={name} value={name}>
                {name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
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

      <Flex align="center" justify="between" mb="3" mt="3">
        <Flex gap="2">
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
        <Flex align="center" gap={'1'}>
          <EditCategoriesDialog
            open={editCategoriesOpen}
            onOpenChange={setEditCategoriesOpen}
            companyId={companyId ?? ''}
          />
          <EditBrandsDialog
            open={editBrandsOpen}
            onOpenChange={setEditBrandsOpen}
            companyId={companyId ?? ''}
          />
          <AddItemDialog
            open={addItemOpen}
            onOpenChange={setAddItemOpen}
            companyId={companyId ?? ''}
          />
          <AddGroupDialog
            open={addGroupDialog}
            onOpenChange={setAddGroupDialog}
            companyId={companyId ?? ''}
          />
        </Flex>
      </Flex>
    </>
  )
}

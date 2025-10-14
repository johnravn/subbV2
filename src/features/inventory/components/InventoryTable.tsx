// src/features/inventory/components/InventoryTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Badge,
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
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { InventoryIndexRow, SortBy, SortDir } from '../api/queries'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  activeOnly: boolean
  allow_individual_booking: boolean
  includeExternal: boolean // 👈 new
  pageSizeOverride?: number
}

export default function InventoryTable({
  selectedId,
  onSelect,
  activeOnly,
  allow_individual_booking,
  includeExternal,
  pageSizeOverride,
}: Props) {
  const { companyId } = useCompany()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'name', desc: false }, // 👈 default sort by name ascending
  ])
  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const [addItemOpen, setAddItemOpen] = React.useState(false)
  const [addGroupDialog, setAddGroupDialog] = React.useState(false)
  const [editCategoriesOpen, setEditCategoriesOpen] = React.useState(false)
  const [editBrandsOpen, setEditBrandsOpen] = React.useState(false)

  // ⬇️ add these near your other state hooks
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const controlsRef = React.useRef<HTMLDivElement | null>(null)
  const theadRef = React.useRef<HTMLTableSectionElement | null>(null)
  const pagerRef = React.useRef<HTMLDivElement | null>(null)

  // const pageSize = 12
  // start with a sane default; it will be recalculated on mount/resize/data changes
  const [pageSize, setPageSize] = React.useState(12)

  const effectivePageSize = pageSizeOverride ?? pageSize

  // ⬇️ place below the refs
  const recomputePageSize = React.useCallback(() => {
    // Use the viewport height as the baseline
    // const screenH = window.innerHeight
    const screenH =
      containerRef.current?.getBoundingClientRect().height ?? window.innerHeight

    // Measure actual occupied space inside this component
    const controlsH = controlsRef.current?.offsetHeight ?? 0
    const theadH = theadRef.current?.offsetHeight ?? 0
    const pagerH = pagerRef.current?.offsetHeight ?? 0

    // Some breathing room for margins/padding around blocks
    const miscPadding = 32

    // Available vertical space for table rows
    const available = Math.max(
      0,
      screenH - controlsH - theadH - pagerH - miscPadding,
    )

    // Measure an actual row height if possible; fall back to 44px
    const rowEl = containerRef.current?.querySelector<HTMLTableRowElement>(
      'tbody tr[data-row-probe], tbody tr',
    )
    const rowH = rowEl?.getBoundingClientRect().height || 44

    const rows = Math.max(5, Math.floor(available / rowH)) // never go below 5
    setPageSize(rows)
  }, [])

  const { data, isLoading, isFetching } = useQuery({
    ...inventoryIndexQuery({
      companyId: companyId ?? '__none__',
      page,
      pageSize: effectivePageSize,
      search,
      activeOnly,
      allow_individual_booking,
      category: categoryFilter,
      sortBy,
      sortDir,
      includeExternal, // 👈 new
    }),
    enabled: !!companyId,
  })

  // ⬇️ recompute when window resizes
  React.useEffect(() => {
    if (pageSizeOverride != null) return // ⬅️ bail out on phones
    const onResize = () => recomputePageSize()
    window.addEventListener('resize', onResize)
    // initial compute on mount
    recomputePageSize()
    return () => window.removeEventListener('resize', onResize)
  }, [recomputePageSize])

  // ⬇️ recompute when data loads or sorting/filtering changes row heights
  React.useEffect(() => {
    // next tick so the DOM is painted before measuring
    if (pageSizeOverride != null) return // ⬅️ bail out on phones
    const id = requestAnimationFrame(recomputePageSize)
    return () => cancelAnimationFrame(id)
  }, [
    pageSizeOverride,
    data,
    sorting,
    search,
    categoryFilter,
    sortBy,
    sortDir,
    activeOnly,
    allow_individual_booking,
    recomputePageSize,
  ])

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
        cell: (ctx) => {
          const r = ctx.row.original
          return (
            <Flex align="center" gap="2">
              <Text size="2" weight="medium">
                {r.name}
              </Text>
              {r.is_group && (
                <Badge size="1" variant="soft" color="pink">
                  Group
                </Badge>
              )}
              {r.is_group && r.unique === true && (
                <Badge size="1" variant="soft">
                  Unique
                </Badge>
              )}
              {r.active === false && (
                <Badge size="1" variant="soft" color="red">
                  Inactive
                </Badge>
              )}
            </Flex>
          )
        },
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
      {
        id: 'owner',
        header: 'Owner',
        cell: (ctx) => {
          const r = ctx.row.original
          return r.internally_owned ? (
            <Badge size="1" variant="soft" color="indigo">
              Internal
            </Badge>
          ) : (
            <Badge size="1" variant="soft" color="amber">
              {r.external_owner_name ?? 'External'}
            </Badge>
          )
        },
      },
    ],
    [fmt],
  )

  const table = useReactTable({
    data: data?.rows as Array<InventoryIndexRow>,
    state: { sorting },
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  })
  console.log('data.rows.length:', data?.rows.length ?? 0)

  return (
    <div ref={containerRef} style={{ height: '100%', minHeight: 0 }}>
      {/* Search bar */}
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap">
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
        <Table.Header ref={theadRef}>
          {table.getHeaderGroups().map((hg) => (
            <Table.Row key={hg.id}>
              {hg.headers.map((h) => {
                // map column.id to our server columns (defaults to accessorKey or id)
                const colId = h.column.id as SortBy

                // only allow sorting on columns we support server-side
                const sortableCols: Array<SortBy> = [
                  'name',
                  'category_name',
                  'brand_name',
                  'on_hand',
                  'current_price',
                ]
                const canSort = sortableCols.includes(colId)

                const isActive = sortBy === colId
                const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

                const handleClick = () => {
                  if (!canSort) return
                  setPage(1) // reset pagination when changing sort
                  if (isActive) {
                    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                  } else {
                    setSortBy(colId)
                    setSortDir('asc')
                  }
                }

                return (
                  <Table.ColumnHeaderCell
                    key={h.id}
                    onClick={canSort ? handleClick : undefined}
                    style={{
                      cursor: canSort ? 'pointer' : undefined,
                      userSelect: 'none',
                    }}
                    title={canSort ? 'Click to sort' : undefined}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {arrow}
                  </Table.ColumnHeaderCell>
                )
              })}
            </Table.Row>
          ))}
        </Table.Header>

        <Table.Body>
          {!isLoading && table.getRowModel().rows.length === 0 && (
            <Table.Row data-row-probe style={{ visibility: 'hidden' }}>
              <Table.Cell colSpan={columns.length}>probe</Table.Cell>
            </Table.Row>
          )}
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

      <div ref={pagerRef}>
        <Flex align="center" justify="between" mb="3" mt="3">
          <Flex gap="2">
            <Button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              variant="classic"
            >
              Prev
            </Button>
            <Button
              disabled={!data || data.rows.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
              variant="classic"
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
      </div>
    </div>
  )
}

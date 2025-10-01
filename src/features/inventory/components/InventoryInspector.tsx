// src/features/inventory/components/InventoryInspector.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { inventoryDetailQuery } from '../api/queries'

export default function InventoryInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()
  const fmtCurrency = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

  const { data, isLoading } = useQuery({
    ...inventoryDetailQuery({
      companyId: companyId ?? '__none__',
      id: id ?? '__none__',
    }),
    enabled: !!companyId && !!id,
  })

  if (!id)
    return <Text color="gray">Select an item/bundle to view details.</Text>
  if (isLoading) return <Text>Loading…</Text>
  if (!data) return <Text color="red">Not found.</Text>

  const entry = data
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : '—'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {entry.name}
          </Text>
          <Text as="div" color="gray" size="2">
            {entry.type}
            {/* decorate subtitle similarly for both kinds */}
            {entry.type === 'item' && entry.category_name
              ? ` · ${entry.category_name}`
              : ''}
            {entry.type === 'item' && entry.brand_name
              ? ` · ${entry.brand_name}`
              : ''}
            {entry.type === 'group' && entry.category_name
              ? ` · ${entry.category_name}`
              : ''}
          </Text>
        </div>
        <Flex gap="2">
          <Button size="2" variant="soft">
            Edit
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* ITEM DETAILS (unchanged look) */}
      {entry.type === 'item' ? (
        <Flex direction="column" gap="3">
          {/* Quick stats */}
          <Grid columns={{ initial: '1', sm: '3' }} gap="3">
            <Stat label="On hand" value={<b>{entry.on_hand ?? 0}</b>} />
            <Stat
              label="Current price"
              value={
                entry.current_price != null ? (
                  <b>{fmtCurrency.format(Number(entry.current_price))}</b>
                ) : (
                  <Text color="gray">—</Text>
                )
              }
            />
            <Stat
              label="Booking"
              value={
                <Badge
                  color={entry.allow_individual_booking ? 'green' : 'gray'}
                  variant="soft"
                >
                  {entry.allow_individual_booking
                    ? 'Individual allowed'
                    : 'Group-only'}
                </Badge>
              }
            />
          </Grid>

          {/* Meta */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            <Field label="Category" value={entry.category_name ?? '—'} />
            <Field label="Brand" value={entry.brand_name ?? '—'} />
            <Field
              label="Status"
              value={
                <Badge color={entry.active ? 'green' : 'red'} variant="soft">
                  {entry.active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
            <Field label="Model" value={entry.model ?? '—'} />
          </Grid>

          {/* Notes */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Notes
            </Text>
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              <Text size="2" color={entry.notes ? undefined : 'gray'}>
                {entry.notes || 'No notes'}
              </Text>
            </Box>
          </div>

          {/* Price history */}
          <div>
            <Flex align="baseline" justify="between" mb="2">
              <Text size="2" color="gray">
                Price history
              </Text>
              <Text size="1" color="gray">
                Most recent first
              </Text>
            </Flex>

            {entry.price_history.length === 0 ? (
              <Text size="2" color="gray">
                No price records yet.
              </Text>
            ) : (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Edited</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Set by</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {entry.price_history.map((p) => (
                    <Table.Row key={p.id}>
                      <Table.Cell>
                        {fmtCurrency.format(Number(p.amount))}
                      </Table.Cell>
                      <Table.Cell>
                        <Code>{fmtDate(p.effective_from)}</Code>
                      </Table.Cell>
                      <Table.Cell>
                        {p.set_by_name || p.set_by || '—'}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </div>
        </Flex>
      ) : null}

      {/* GROUP DETAILS (mirrors AddGroupDialog structure/style) */}
      {entry.type === 'group' ? (
        <Flex direction="column" gap="3">
          {/* Quick stats */}
          <Grid columns={{ initial: '1', sm: '3' }} gap="3">
            <Stat label="On hand" value={<b>{entry.on_hand ?? 0}</b>} />
            <Stat
              label="Current price"
              value={
                entry.current_price != null ? (
                  <b>{fmtCurrency.format(Number(entry.current_price))}</b>
                ) : (
                  <Text color="gray">—</Text>
                )
              }
            />
            <div />
          </Grid>

          {/* Meta (Category / Status / Description) */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            <Field label="Category" value={entry.category_name ?? '—'} />
            <Field
              label="Status"
              value={
                <Badge color={entry.active ? 'green' : 'red'} variant="soft">
                  {entry.active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
            <Field
              label="Type"
              value={
                <Badge variant="soft">
                  {entry.unique ? 'Unique (fixed set)' : 'Bundle (generic)'}
                </Badge>
              }
            />
          </Grid>

          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Description
            </Text>
            <Box
              p="2"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              <Text size="2" color={entry.description ? undefined : 'gray'}>
                {entry.description || 'No description'}
              </Text>
            </Box>
          </div>

          {/* Parts (table like the dialog’s right column) */}
          <div>
            <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
              Bundle contents
            </Text>

            {entry.parts.length ? (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Qty</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Unit</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {entry.parts.map((p) => {
                    const unit = p.item_current_price ?? null
                    const total =
                      unit != null ? Number(unit) * Number(p.quantity) : null
                    return (
                      <Table.Row key={p.item_id}>
                        <Table.Cell>{p.item_name}</Table.Cell>
                        <Table.Cell>{p.quantity}</Table.Cell>
                        <Table.Cell>
                          {unit != null
                            ? fmtCurrency.format(Number(unit))
                            : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          {total != null ? fmtCurrency.format(total) : '—'}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                  <Table.Row>
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell style={{ fontWeight: 600 }}>
                      Parts total
                    </Table.Cell>
                    <Table.Cell style={{ fontWeight: 600 }}>
                      {fmtCurrency.format(
                        entry.parts.reduce((sum, p) => {
                          const up = Number(p.item_current_price ?? 0)
                          return sum + up * p.quantity
                        }, 0),
                      )}
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            ) : (
              <Text size="2" color="gray">
                No parts
              </Text>
            )}
          </div>
          {/* Group price history */}
          <div>
            <Flex align="baseline" justify="between" mb="2">
              <Text size="2" color="gray">
                Price history
              </Text>
              <Text size="1" color="gray">
                Most recent first
              </Text>
            </Flex>

            {entry.price_history.length ? (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Edited</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Set by</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {entry.price_history.map((p) => (
                    <Table.Row key={p.id}>
                      <Table.Cell>
                        {fmtCurrency.format(Number(p.amount))}
                      </Table.Cell>
                      <Table.Cell>
                        <Code>{fmtDate(p.effective_from)}</Code>
                      </Table.Cell>
                      <Table.Cell>
                        {p.set_by_name || p.set_by || '—'}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            ) : (
              <Text size="2" color="gray">
                No price records yet.
              </Text>
            )}
          </div>
        </Flex>
      ) : null}
    </Box>
  )
}

/* ---------- small presentational helpers ---------- */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box
      p="2"
      style={{
        border: '1px solid var(--gray-a6)',
        borderRadius: 8,
      }}
    >
      <Text as="div" size="1" color="gray" style={{ marginBottom: 2 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </Box>
  )
}

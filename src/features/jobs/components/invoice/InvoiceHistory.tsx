// src/features/jobs/components/invoice/InvoiceHistory.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  Flex,
  Heading,
  Table,
  Text,
  Badge,
  Button,
} from '@radix-ui/themes'
import { CheckCircle, XmarkCircle, OpenNewWindow } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'

type InvoiceRecord = {
  id: string
  job_id: string
  offer_id: string | null
  organization_id: string
  conta_invoice_id: string | null
  conta_customer_id: number | null
  invoice_basis: 'offer' | 'bookings'
  status: 'pending' | 'created' | 'failed'
  error_message: string | null
  created_at: string
  conta_response: any
}

export default function InvoiceHistory({ jobId }: { jobId: string }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'invoices'],
    queryFn: async (): Promise<Array<InvoiceRecord>> => {
      const { data, error } = await supabase
        .from('job_invoices')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Array<InvoiceRecord>
    },
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getContaInvoiceUrl = (
    organizationId: string,
    invoiceId: string | null,
  ) => {
    if (!invoiceId) return null
    // Conta invoice URL format (adjust based on actual Conta URL structure)
    const baseUrl =
      import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
    // If it's a sandbox/test environment, use sandbox URL
    if (baseUrl.includes('sandbox') || baseUrl.includes('test')) {
      return `https://app.conta-sandbox.no/invoices/${invoiceId}`
    }
    return `https://app.conta.no/invoices/${invoiceId}`
  }

  if (isLoading) {
    return (
      <Card>
        <Heading size="4" mb="3">
          Invoice History
        </Heading>
        <Text>Loading invoice history...</Text>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <Heading size="4" mb="3">
          Invoice History
        </Heading>
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="3" color="gray">
            No invoices created yet
          </Text>
          <Text size="2" color="gray" mt="2" style={{ display: 'block' }}>
            Invoices created through this system will appear here
          </Text>
        </Box>
      </Card>
    )
  }

  return (
    <Card>
      <Heading size="4" mb="3">
        Invoice History
      </Heading>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Basis</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Conta Invoice ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
              Actions
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {invoices.map((invoice) => {
            const contaUrl = getContaInvoiceUrl(
              invoice.organization_id,
              invoice.conta_invoice_id,
            )

            return (
              <Table.Row key={invoice.id}>
                <Table.Cell>
                  <Text size="2">{formatDate(invoice.created_at)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    variant="soft"
                    color={
                      invoice.invoice_basis === 'offer' ? 'blue' : 'purple'
                    }
                  >
                    {invoice.invoice_basis === 'offer' ? 'Offer' : 'Bookings'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {invoice.status === 'created' ? (
                    <Flex align="center" gap="2">
                      <CheckCircle
                        width={16}
                        height={16}
                        color="var(--green-9)"
                      />
                      <Text size="2" color="green" weight="medium">
                        Created
                      </Text>
                    </Flex>
                  ) : invoice.status === 'failed' ? (
                    <Flex align="center" gap="2">
                      <XmarkCircle
                        width={16}
                        height={16}
                        color="var(--red-9)"
                      />
                      <Text size="2" color="red" weight="medium">
                        Failed
                      </Text>
                    </Flex>
                  ) : (
                    <Text size="2" color="gray">
                      Pending
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {invoice.conta_invoice_id ? (
                    <Text
                      size="2"
                      weight="medium"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {invoice.conta_invoice_id}
                    </Text>
                  ) : (
                    <Text size="2" color="gray">
                      —
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  {contaUrl && (
                    <Button
                      size="1"
                      variant="ghost"
                      onClick={() => window.open(contaUrl, '_blank')}
                    >
                      <OpenNewWindow width={14} height={14} />
                      View in Conta
                    </Button>
                  )}
                  {invoice.error_message && (
                    <Box mt="2">
                      <Text size="1" color="red">
                        {invoice.error_message}
                      </Text>
                    </Box>
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table.Root>
    </Card>
  )
}

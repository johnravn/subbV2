// src/features/jobs/components/tabs/InvoiceTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { CheckCircle, GoogleDocs, Plus, XmarkCircle } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { contaClient } from '@shared/api/conta/client'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import type { JobDetail, JobOffer } from '../../types'

export default function InvoiceTab({
  jobId,
  job,
}: {
  jobId: string
  job: JobDetail
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { info, success, error: toastError } = useToast()

  // Fetch accepted offers for this job
  const { data: acceptedOffers = [], isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })

      if (error) throw error
      return data as Array<JobOffer>
    },
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Get accounting organization ID from company_expansions
  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('accounting_organization_id, accounting_software')
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      return data as {
        accounting_organization_id: string | null
        accounting_software: string | null
      } | null
    },
    enabled: !!companyId,
  })

  // Helper function to find or create a customer in Conta
  const findOrCreateContaCustomer = async (
    organizationId: string,
    customer: JobDetail['customer'],
  ): Promise<number | null> => {
    if (!customer) return null

    try {
      // First, try to search for the customer by name
      const searchResponse = await contaClient.get<Array<{ id: number }>>(
        `/invoice/organizations/${organizationId}/customers/v1?name=${encodeURIComponent(customer.name || '')}`,
      )

      if (
        searchResponse &&
        Array.isArray(searchResponse) &&
        searchResponse.length > 0
      ) {
        // Customer found, return the first match's ID
        return searchResponse[0].id
      }

      // Customer not found, create a new one
      const createResponse = await contaClient.post<{ id: number }>(
        `/invoice/organizations/${organizationId}/customers/v1`,
        {
          name: customer.name || '',
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          // Additional fields can be added based on Conta API requirements
        },
      )

      return createResponse?.id || null
    } catch (error: any) {
      // If customer creation/search fails, log but don't block invoice creation
      console.error('Failed to find/create Conta customer:', error)
      return null
    }
  }

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async ({
      offer,
      organizationId,
    }: {
      offer: JobOffer
      organizationId: string
    }) => {
      // Find or create the customer in Conta
      const contaCustomerId = await findOrCreateContaCustomer(
        organizationId,
        job.customer,
      )

      // For now, create a simple invoice with the offer total
      // In the future, we might want to break down by equipment/crew/transport lines
      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 14 days from now
        currency: 'NOK',
        lines: [
          {
            description: offer.title || `Invoice for Job ${job.jobnr || jobId}`,
            quantity: 1,
            unitPrice: offer.total_after_discount,
            vatPercent: offer.vat_percent,
            // If there's a discount, we could add it as a separate line item
            // For now, we use total_after_discount as the base
          },
        ],
        // Add discount if applicable
        ...(offer.discount_percent > 0
          ? {
              discountPercent: offer.discount_percent,
            }
          : {}),
        // Reference the job and offer
        comment: `Job: ${job.title}${job.jobnr ? ` (#${job.jobnr})` : ''}\nOffer: ${offer.title || `v${offer.version_number}`}`,
      }

      const response = await contaClient.post(
        `/invoice/organizations/${organizationId}/invoices/v1`,
        invoiceData,
      )

      return response
    },
    onSuccess: async (data, variables) => {
      success(
        'Invoice Created',
        `Invoice has been successfully created in your accounting software.`,
      )

      // Update job status to 'invoiced' if not already
      if (job.status !== 'invoiced' && job.status !== 'paid') {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: 'invoiced' })
          .eq('id', jobId)

        if (!updateError) {
          // Invalidate job queries to refresh the status
          qc.invalidateQueries({ queryKey: ['jobs', jobId] })
        }
      }

      // Refresh accepted offers to show updated invoice status
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
      })
    },
    onError: (err: any) => {
      toastError(
        'Failed to Create Invoice',
        err?.message ||
          'An error occurred while creating the invoice. Please try again.',
      )
    },
  })

  const handleCreateInvoice = (offerId: string) => {
    const offer = acceptedOffers.find((o) => o.id === offerId)
    if (!offer) {
      toastError('Error', 'Offer not found')
      return
    }

    if (!accountingConfig?.accounting_organization_id) {
      info(
        'Accounting Integration Required',
        'Please configure your accounting software organization ID in Company settings before creating invoices.',
      )
      return
    }

    if (accountingConfig.accounting_software !== 'conta') {
      info(
        'Accounting Software Not Supported',
        'Currently only Conta accounting software is supported for invoice creation.',
      )
      return
    }

    createInvoiceMutation.mutate({
      offer,
      organizationId: accountingConfig.accounting_organization_id,
    })
  }

  const handleCreateInvoiceForAll = async () => {
    if (offersNeedingInvoice.length === 0) {
      info('No Offers', 'There are no offers ready to invoice.')
      return
    }

    if (!accountingConfig?.accounting_organization_id) {
      info(
        'Accounting Integration Required',
        'Please configure your accounting software organization ID in Company settings before creating invoices.',
      )
      return
    }

    if (accountingConfig.accounting_software !== 'conta') {
      info(
        'Accounting Software Not Supported',
        'Currently only Conta accounting software is supported for invoice creation.',
      )
      return
    }

    // Create invoices for all pending offers
    // For now, we'll do them sequentially to avoid overwhelming the API
    // In the future, we could batch them or show progress
    try {
      for (const offer of offersNeedingInvoice) {
        await createInvoiceMutation.mutateAsync({
          offer,
          organizationId: accountingConfig.accounting_organization_id,
        })
      }
      success(
        'All Invoices Created',
        `Successfully created ${offersNeedingInvoice.length} invoice(s).`,
      )
    } catch (error: any) {
      toastError(
        'Error Creating Invoices',
        error?.message ||
          'An error occurred while creating some invoices. Please check and retry if needed.',
      )
    }
  }

  // Check if job has been invoiced (status is 'invoiced' or 'paid')
  const isInvoiced = job.status === 'invoiced' || job.status === 'paid'
  const isCompleted = job.status === 'completed'

  // Offers that need invoicing (accepted but not yet invoiced)
  // For now, we'll assume all accepted offers need invoicing
  // In the future, we might track invoice status per offer
  const offersNeedingInvoice = acceptedOffers

  const totalToInvoice = offersNeedingInvoice.reduce(
    (sum, offer) => sum + offer.total_with_vat,
    0,
  )

  if (isLoading) {
    return (
      <Box>
        <Heading size="3" mb="3">
          Invoice
        </Heading>
        <Text>Loading invoice data...</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Heading size="3" mb="3">
        Invoice
      </Heading>

      {/* Job Invoice Status */}
      <Card mb="4">
        <Flex justify="between" align="center" mb="3">
          <Box>
            <Heading size="4" mb="1">
              Job Invoice Status
            </Heading>
            <Text size="2" color="gray">
              Current status: {makeWordPresentable(job.status)}
            </Text>
          </Box>
          <Box>
            {isInvoiced ? (
              <Flex align="center" gap="2">
                <CheckCircle width={24} height={24} color="var(--green-9)" />
                <Text size="3" weight="medium" color="green">
                  {job.status === 'paid' ? 'Paid' : 'Invoiced'}
                </Text>
              </Flex>
            ) : (
              <Flex align="center" gap="2">
                <XmarkCircle width={24} height={24} color="var(--orange-9)" />
                <Text size="3" weight="medium" color="orange">
                  Not Invoiced
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
        {!isInvoiced && isCompleted && (
          <Box
            p="3"
            style={{
              background: 'var(--orange-a2)',
              borderRadius: 8,
              border: '1px solid var(--orange-a6)',
            }}
          >
            <Text size="2" color="gray">
              This job is completed and ready to be invoiced.
            </Text>
          </Box>
        )}
      </Card>

      {/* Accepted Offers Section */}
      {acceptedOffers.length > 0 ? (
        <Card mb="4">
          <Flex justify="between" align="center" mb="3">
            <Heading size="4">Accepted Offers</Heading>
            {offersNeedingInvoice.length > 0 && !isInvoiced && (
              <Text size="2" color="gray">
                {offersNeedingInvoice.length} offer
                {offersNeedingInvoice.length !== 1 ? 's' : ''} ready to invoice
              </Text>
            )}
          </Flex>

          {offersNeedingInvoice.length > 0 ? (
            <>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Offer</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Accepted</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                      Amount
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'center' }}>
                      Invoice Status
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                      Actions
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {acceptedOffers.map((offer) => {
                    const needsInvoice = offersNeedingInvoice.some(
                      (o) => o.id === offer.id,
                    )
                    return (
                      <Table.Row key={offer.id}>
                        <Table.Cell>
                          <Text weight="medium">{offer.title}</Text>
                          <Text size="1" color="gray">
                            {offer.offer_type === 'technical'
                              ? 'Technical'
                              : 'Pretty'}{' '}
                            • v{offer.version_number}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{formatDate(offer.accepted_at)}</Text>
                          {offer.accepted_by_name && (
                            <Text size="1" color="gray">
                              by {offer.accepted_by_name}
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text
                            size="3"
                            weight="medium"
                            style={{ textAlign: 'right' }}
                          >
                            {formatCurrency(offer.total_with_vat)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'center' }}>
                          {needsInvoice ? (
                            <Text size="2" color="orange">
                              Pending
                            </Text>
                          ) : (
                            <Flex align="center" justify="center" gap="1">
                              <CheckCircle
                                width={16}
                                height={16}
                                color="var(--green-9)"
                              />
                              <Text size="2" color="green">
                                Invoiced
                              </Text>
                            </Flex>
                          )}
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right' }}>
                          {needsInvoice && (
                            <Button
                              size="2"
                              variant="soft"
                              onClick={() => handleCreateInvoice(offer.id)}
                              disabled={createInvoiceMutation.isPending}
                            >
                              <GoogleDocs width={14} height={14} />
                              Create Invoice
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>

              {offersNeedingInvoice.length > 0 && !isInvoiced && (
                <>
                  <Separator my="4" />
                  <Flex justify="between" align="center">
                    <Box>
                      <Text size="2" color="gray" mb="1">
                        Total to Invoice
                      </Text>
                      <Heading size="5">
                        {formatCurrency(totalToInvoice)}
                      </Heading>
                    </Box>
                    <Button
                      size="3"
                      onClick={handleCreateInvoiceForAll}
                      disabled={createInvoiceMutation.isPending}
                    >
                      <Plus width={16} height={16} />
                      Create Invoice for All
                    </Button>
                  </Flex>
                </>
              )}
            </>
          ) : (
            <Box
              p="4"
              style={{
                border: '2px dashed var(--green-a6)',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <CheckCircle width={32} height={32} color="var(--green-9)" />
              <Text
                size="3"
                weight="medium"
                mt="2"
                style={{ display: 'block' }}
              >
                All offers have been invoiced
              </Text>
            </Box>
          )}
        </Card>
      ) : (
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ minHeight: '200px', padding: '40px' }}
          >
            <Text size="4" color="gray" align="center">
              No accepted offers yet
            </Text>
            <Text size="2" color="gray" align="center">
              Once offers are accepted, they will appear here and can be
              invoiced.
            </Text>
          </Flex>
        </Card>
      )}

      {/* Accounting Software Integration Info */}
      <Card style={{ background: 'var(--blue-a2)' }}>
        <Flex gap="3" align="start">
          <Box style={{ paddingTop: '2px' }}>
            <GoogleDocs width={20} height={20} color="var(--blue-9)" />
          </Box>
          <Box style={{ flex: 1 }}>
            <Heading size="3" mb="1">
              Accounting Software Integration
            </Heading>
            <Text size="2" color="gray" mb="2">
              Connect your accounting software in Company settings to enable
              automatic invoice creation and synchronization.
            </Text>
            <Text size="1" color="gray">
              Once connected, you'll be able to create invoices directly from
              accepted offers and track their payment status.
            </Text>
          </Box>
        </Flex>
      </Card>
    </Box>
  )
}

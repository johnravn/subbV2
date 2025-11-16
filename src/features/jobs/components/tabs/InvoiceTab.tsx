// src/features/jobs/components/tabs/InvoiceTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { CheckCircle, GoogleDocs, Plus, XmarkCircle, Eye } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompany } from '@shared/companies/CompanyProvider'
import { contaClient } from '@shared/api/conta/client'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import {
  jobBookingsForInvoiceQuery,
  type BookingsForInvoice,
} from '../../api/invoiceQueries'
import type { JobDetail, JobOffer } from '../../types'
import InvoicePreview from '../invoice/InvoicePreview'
import InvoiceHistory from '../invoice/InvoiceHistory'
import { Dialog } from '@radix-ui/themes'

type InvoiceBasis = 'offer' | 'bookings'

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
  const [invoiceBasis, setInvoiceBasis] = React.useState<InvoiceBasis>('offer')
  const [previewOffer, setPreviewOffer] = React.useState<JobOffer | null>(null)
  const [previewBookings, setPreviewBookings] = React.useState<BookingsForInvoice | null>(null)
  
  // Get current user ID for tracking
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })
  
  // Check if we're in test/sandbox mode
  const isTestMode = React.useMemo(() => {
    const apiUrl = import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
    return apiUrl.includes('sandbox') || apiUrl.includes('test')
  }, [])

  // Fetch accepted offers for this job
  const { data: acceptedOffers = [], isLoading: isLoadingOffers } = useQuery({
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

  // Fetch bookings for invoice (only when bookings basis is selected)
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    ...jobBookingsForInvoiceQuery({
      jobId,
      companyId: companyId ?? '',
      defaultVatPercent: 25, // Default to 25% VAT (high rate in Norway)
    }),
    enabled: invoiceBasis === 'bookings' && !!companyId,
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

  // Helper to map VAT percent to Conta VAT code
  const getVatCode = (vatPercent: number): string => {
    // Map VAT percentages to Conta VAT codes
    if (vatPercent === 0) return 'no.vat'
    if (vatPercent >= 20) return 'high' // 25% in Norway
    if (vatPercent >= 10) return 'medium' // 15% in Norway
    if (vatPercent > 0) return 'low' // 10% in Norway
    return 'high' // Default to high
  }

  // Create invoice mutation for offer basis
  const createInvoiceFromOfferMutation = useMutation({
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

      // Create invoice with single line for the offer
      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        invoiceDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 14 days from now
        invoiceCurrency: 'NOK',
        invoiceLines: [
          {
            description:
              offer.title || `Invoice for Job ${job.jobnr || jobId}`,
            quantity: 1,
            price: offer.total_after_discount, // Price ex VAT
            discount: offer.discount_percent,
            vatCode: getVatCode(offer.vat_percent),
            lineNo: 1,
          },
        ],
        // Reference the job and offer
        comment: `Job: ${job.title}${job.jobnr ? ` (#${job.jobnr})` : ''}\nOffer: ${offer.title || `v${offer.version_number}`}`,
      }

      // Create invoice record in database first (pending status)
      const { data: invoiceRecord, error: recordError } = await supabase
        .from('job_invoices')
        .insert({
          job_id: jobId,
          offer_id: offer.id,
          organization_id: organizationId,
          conta_customer_id: contaCustomerId,
          invoice_basis: 'offer',
          invoice_data: invoiceData as any,
          status: 'pending',
          created_by_user_id: authUser?.id ?? null,
        })
        .select()
        .single()

      if (recordError) {
        console.error('Failed to create invoice record:', recordError)
      }

      let response: any
      let errorMessage: string | null = null

      try {
        response = await contaClient.post(
          `/invoice/organizations/${organizationId}/invoices/v1`,
          invoiceData,
        )

        // Update invoice record with success
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'created',
              conta_invoice_id: response?.id?.toString() || response?.invoiceId?.toString() || null,
              conta_response: response,
            })
            .eq('id', invoiceRecord.id)
        }
      } catch (error: any) {
        errorMessage = error?.message || 'Unknown error'
        
        // Update invoice record with failure
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', invoiceRecord.id)
        }
        
        throw error
      }

      return { response, invoiceRecord }
    },
    onSuccess: async (data) => {
      const invoiceId = data.response?.id || data.response?.invoiceId
      success(
        'Invoice Created',
        `Invoice has been successfully created${isTestMode ? ' (TEST MODE)' : ''}${invoiceId ? ` with ID: ${invoiceId}` : ''}.`,
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

      // Refresh accepted offers and invoice history
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'accepted-offers'],
      })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoices'],
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

  // Create invoice mutation for bookings basis
  const createInvoiceFromBookingsMutation = useMutation({
    mutationFn: async ({
      bookingsData,
      organizationId,
    }: {
      bookingsData: BookingsForInvoice
      organizationId: string
    }) => {
      // Find or create the customer in Conta
      const contaCustomerId = await findOrCreateContaCustomer(
        organizationId,
        job.customer,
      )

      if (!bookingsData.all || bookingsData.all.length === 0) {
        throw new Error('No bookings available to invoice')
      }

      // Create invoice lines from bookings (one line per booking)
      const invoiceLines = bookingsData.all.map((line, index) => ({
        description: line.description,
        quantity: line.quantity,
        price: line.unitPrice, // Price ex VAT per unit
        discount: 0, // No discount per line for bookings
        vatCode: getVatCode(line.vatPercent),
        lineNo: index + 1,
      }))

      const invoiceData = {
        customerId: contaCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        invoiceDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 14 days from now
        invoiceCurrency: 'NOK',
        invoiceLines,
        // Reference the job
        comment: `Job: ${job.title}${job.jobnr ? ` (#${job.jobnr})` : ''}\nInvoice based on bookings (${bookingsData.all.length} line${bookingsData.all.length !== 1 ? 's' : ''})`,
      }

      // Create invoice record in database first (pending status)
      const { data: invoiceRecord, error: recordError } = await supabase
        .from('job_invoices')
        .insert({
          job_id: jobId,
          organization_id: organizationId,
          conta_customer_id: contaCustomerId,
          invoice_basis: 'bookings',
          invoice_data: invoiceData as any,
          status: 'pending',
          created_by_user_id: authUser?.id ?? null,
        })
        .select()
        .single()

      if (recordError) {
        console.error('Failed to create invoice record:', recordError)
      }

      let response: any
      let errorMessage: string | null = null

      try {
        response = await contaClient.post(
          `/invoice/organizations/${organizationId}/invoices/v1`,
          invoiceData,
        )

        // Update invoice record with success
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'created',
              conta_invoice_id: response?.id?.toString() || response?.invoiceId?.toString() || null,
              conta_response: response,
            })
            .eq('id', invoiceRecord.id)
        }
      } catch (error: any) {
        errorMessage = error?.message || 'Unknown error'
        
        // Update invoice record with failure
        if (invoiceRecord) {
          await supabase
            .from('job_invoices')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', invoiceRecord.id)
        }
        
        throw error
      }

      return { response, invoiceRecord }
    },
    onSuccess: async (data) => {
      const invoiceId = data.response?.id || data.response?.invoiceId
      success(
        'Invoice Created',
        `Invoice has been successfully created${isTestMode ? ' (TEST MODE)' : ''}${invoiceId ? ` with ID: ${invoiceId}` : ''}.`,
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

      // Refresh bookings and invoice history
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoice', 'bookings'],
      })
      qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'invoices'],
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

  const handleCreateInvoiceFromOffer = (offerId: string, showPreview = false) => {
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

    if (showPreview) {
      setPreviewOffer(offer)
      return
    }

    createInvoiceFromOfferMutation.mutate({
      offer,
      organizationId: accountingConfig.accounting_organization_id,
    })
  }

  const handleCreateInvoiceFromBookings = (showPreview = false) => {
    if (!bookings || bookings.all.length === 0) {
      info('No Bookings', 'There are no bookings available to invoice.')
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

    if (showPreview) {
      setPreviewBookings(bookings)
      return
    }

    createInvoiceFromBookingsMutation.mutate({
      bookingsData: bookings,
      organizationId: accountingConfig.accounting_organization_id,
    })
  }

  const handleCreateInvoiceForAllOffers = async () => {
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
        await createInvoiceFromOfferMutation.mutateAsync({
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

  const isLoading = isLoadingOffers || (invoiceBasis === 'bookings' && isLoadingBookings)

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
      <Flex justify="between" align="center" mb="4">
        <Heading size="3">Invoice</Heading>
        {!isInvoiced && (
          <SegmentedControl.Root
            value={invoiceBasis}
            onValueChange={(value) => setInvoiceBasis(value as InvoiceBasis)}
          >
            <SegmentedControl.Item value="offer">
              Accepted Offer
            </SegmentedControl.Item>
            <SegmentedControl.Item value="bookings">
              Bookings on Job
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
      </Flex>

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

      {/* Invoice Basis: Accepted Offer */}
      {invoiceBasis === 'offer' && (
        <>
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
                            <Flex gap="2" justify="end">
                              <Button
                                size="2"
                                variant="ghost"
                                onClick={() => handleCreateInvoiceFromOffer(offer.id, true)}
                                disabled={createInvoiceFromOfferMutation.isPending}
                              >
                                <Eye width={14} height={14} />
                                Preview
                              </Button>
                              <Button
                                size="2"
                                variant="soft"
                                onClick={() => handleCreateInvoiceFromOffer(offer.id)}
                                disabled={createInvoiceFromOfferMutation.isPending}
                              >
                                <GoogleDocs width={14} height={14} />
                                Create Invoice
                              </Button>
                            </Flex>
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
                      onClick={handleCreateInvoiceForAllOffers}
                      disabled={createInvoiceFromOfferMutation.isPending}
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
        </>
      )}

      {/* Invoice Basis: Bookings on Job */}
      {invoiceBasis === 'bookings' && (
        <>
          {bookings && bookings.all.length > 0 ? (
            <Card mb="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="4">Bookings on Job</Heading>
                <Text size="2" color="gray">
                  {bookings.all.length} booking
                  {bookings.all.length !== 1 ? 's' : ''} ready to invoice
                </Text>
              </Flex>

              <Table.Root mb="4">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                      Quantity
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                      Unit Price
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                      Total (ex VAT)
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {bookings.all.map((line) => (
                    <Table.Row key={line.id}>
                      <Table.Cell>
                        <Text size="2" weight="medium">
                          {makeWordPresentable(line.type)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{line.description}</Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text>
                          {line.type === 'crew' || line.type === 'transport'
                            ? `${line.quantity} day${line.quantity !== 1 ? 's' : ''}`
                            : line.quantity}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text>{formatCurrency(line.unitPrice)}</Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        <Text weight="medium">
                          {formatCurrency(line.totalPrice)}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>

              <Separator my="4" />

              <Flex justify="between" align="center" mb="3">
                <Box>
                  <Text size="2" color="gray" mb="1">
                    Subtotal (ex VAT)
                  </Text>
                  <Heading size="5">
                    {formatCurrency(bookings.totalExVat)}
                  </Heading>
                </Box>
                <Box style={{ textAlign: 'right' }}>
                  <Text size="2" color="gray" mb="1">
                    VAT (25%)
                  </Text>
                  <Heading size="5">{formatCurrency(bookings.totalVat)}</Heading>
                </Box>
                <Box style={{ textAlign: 'right' }}>
                  <Text size="2" color="gray" mb="1">
                    Total (incl. VAT)
                  </Text>
                  <Heading size="5">
                    {formatCurrency(bookings.totalWithVat)}
                  </Heading>
                </Box>
              </Flex>

              {/* Warning for bookings with zero prices */}
              {(bookings.equipment.some((b) => b.unitPrice === 0) ||
                bookings.crew.some((b) => b.unitPrice === 0) ||
                bookings.transport.some((b) => b.unitPrice === 0)) && (
                <Box
                  p="3"
                  mb="3"
                  style={{
                    background: 'var(--orange-a2)',
                    borderRadius: 8,
                    border: '1px solid var(--orange-a6)',
                  }}
                >
                  <Text size="2" color="orange" weight="medium">
                    Warning: Some bookings have zero prices. Please verify prices
                    before creating the invoice.
                  </Text>
                </Box>
              )}

              <Flex justify="end" gap="3">
                <Button
                  size="3"
                  variant="soft"
                  onClick={() => handleCreateInvoiceFromBookings(true)}
                  disabled={createInvoiceFromBookingsMutation.isPending}
                >
                  <Eye width={16} height={16} />
                  Preview Invoice
                </Button>
                <Button
                  size="3"
                  onClick={() => handleCreateInvoiceFromBookings()}
                  disabled={createInvoiceFromBookingsMutation.isPending}
                >
                  <GoogleDocs width={16} height={16} />
                  Create Invoice from Bookings
                </Button>
              </Flex>
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
                  No bookings available
                </Text>
                <Text size="2" color="gray" align="center">
                  Book equipment, crew, or transport on this job to create an
                  invoice based on bookings.
                </Text>
              </Flex>
            </Card>
          )}
        </>
      )}

      {/* Invoice History */}
      <InvoiceHistory jobId={jobId} />

      {/* Test Mode Indicator */}
      {isTestMode && (
        <Card mt="4" style={{ background: 'var(--yellow-a2)', border: '1px solid var(--yellow-a6)' }}>
          <Flex gap="2" align="center">
            <Text size="2" weight="bold" color="yellow">
              🧪 TEST MODE
            </Text>
            <Text size="2" color="gray">
              You are connected to the Conta sandbox environment. Invoices created here will not appear in your production accounting system.
            </Text>
          </Flex>
        </Card>
      )}

      {/* Accounting Software Integration Info */}
      <Card mt="4" style={{ background: 'var(--blue-a2)' }}>
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

      {/* Invoice Preview Dialog */}
      <Dialog.Root
        open={!!previewOffer || !!previewBookings}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOffer(null)
            setPreviewBookings(null)
          }
        }}
      >
        <Dialog.Content size="4" style={{ maxWidth: '800px' }}>
          <Dialog.Title>Invoice Preview</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Review the invoice details before creating it in your accounting software.
          </Dialog.Description>
          
          {previewOffer && (
            <InvoicePreview
              basis="offer"
              offer={previewOffer}
              customerName={job.customer?.name || 'Unknown Customer'}
            />
          )}
          
          {previewBookings && (
            <InvoicePreview
              basis="bookings"
              bookings={previewBookings}
              customerName={job.customer?.name || 'Unknown Customer'}
            />
          )}

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button
                onClick={() => {
                  if (previewOffer) {
                    handleCreateInvoiceFromOffer(previewOffer.id)
                  } else if (previewBookings) {
                    handleCreateInvoiceFromBookings()
                  }
                  setPreviewOffer(null)
                  setPreviewBookings(null)
                }}
                disabled={
                  createInvoiceFromOfferMutation.isPending ||
                  createInvoiceFromBookingsMutation.isPending
                }
              >
                <GoogleDocs width={16} height={16} />
                Create Invoice
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}

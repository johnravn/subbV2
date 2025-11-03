// src/features/jobs/pages/PublicOfferPage.tsx
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useParams, useNavigate } from '@tanstack/react-router'
import { publicOfferQuery, acceptOffer, markOfferViewed } from '../api/offerQueries'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { OfferAcceptance } from '../types'

export default function PublicOfferPage() {
  const { accessToken } = useParams({ strict: false })
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()

  const [acceptanceForm, setAcceptanceForm] = React.useState<OfferAcceptance>({
    name: '',
    email: '',
    phone: '',
  })
  const [showAcceptForm, setShowAcceptForm] = React.useState(false)

  const { data: offer, isLoading, error } = useQuery({
    ...publicOfferQuery(accessToken),
    enabled: !!accessToken,
  })

  // Mark offer as viewed when loaded
  React.useEffect(() => {
    if (offer && !offer.viewed_at) {
      markOfferViewed(accessToken).catch((err) =>
        console.error('Failed to mark offer as viewed:', err),
      )
    }
  }, [offer, accessToken])

  const acceptMutation = useMutation({
    mutationFn: () => acceptOffer(accessToken, acceptanceForm),
    onSuccess: () => {
      success('Offer Accepted', 'Thank you for accepting the offer!')
      // Refresh the offer to show accepted status
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowAcceptForm(false)
    },
    onError: (err: any) => {
      toastError('Failed to accept offer', err?.message || 'Please try again.')
    },
  })

  if (isLoading) {
    return (
      <Box p="8" style={{ textAlign: 'center' }}>
        <Spinner size="3" />
        <Text mt="4" color="gray">
          Loading offer...
        </Text>
      </Box>
    )
  }

  if (error || !offer) {
    return (
      <Box p="8" style={{ textAlign: 'center' }}>
        <Heading size="6" mb="2" color="red">
          Offer Not Found
        </Heading>
        <Text color="gray">
          This offer link is invalid or the offer has been removed.
        </Text>
      </Box>
    )
  }

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
      month: 'long',
      day: 'numeric',
    })
  }

  const canAccept = offer.status === 'sent' && !showAcceptForm
  const isAccepted = offer.status === 'accepted'

  return (
    <Box p="6" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card>
        <Box p="6">
          <Heading size="7" mb="2">
            {offer.title}
          </Heading>
          <Text size="3" color="gray">
            Version {offer.version_number}
          </Text>

          <Separator my="6" />

          {/* Offer Content */}
          <Box mb="6">
            {/* Pretty Offer Sections */}
            {offer.offer_type === 'pretty' &&
              offer.pretty_sections &&
              offer.pretty_sections.length > 0 && (
                <Box mb="6">
                  {offer.pretty_sections
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((section) => (
                      <Box key={section.id} mb="6">
                        {section.section_type === 'hero' && (
                          <Box
                            p="6"
                            style={{
                              background: 'var(--blue-a3)',
                              borderRadius: 12,
                              textAlign: 'center',
                            }}
                          >
                            {section.image_url && (
                              <Box mb="4">
                                <img
                                  src={section.image_url}
                                  alt={section.title || 'Hero image'}
                                  style={{
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                    maxHeight: 400,
                                    objectFit: 'cover',
                                  }}
                                />
                              </Box>
                            )}
                            {section.title && (
                              <Heading size="7" mb="3">
                                {section.title}
                              </Heading>
                            )}
                            {section.content && (
                              <Text size="4" style={{ whiteSpace: 'pre-wrap' }}>
                                {section.content}
                              </Text>
                            )}
                          </Box>
                        )}

                        {section.section_type === 'problem' && (
                          <Box p="4" style={{ background: 'var(--red-a2)' }}>
                            <Heading size="5" mb="3" color="red">
                              {section.title || 'The Problem'}
                            </Heading>
                            {section.content && (
                              <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                                {section.content}
                              </Text>
                            )}
                            {section.image_url && (
                              <Box mt="4">
                                <img
                                  src={section.image_url}
                                  alt={section.title || 'Problem image'}
                                  style={{
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        )}

                        {section.section_type === 'solution' && (
                          <Box p="4" style={{ background: 'var(--blue-a2)' }}>
                            <Heading size="5" mb="3" color="blue">
                              {section.title || 'Our Solution'}
                            </Heading>
                            {section.content && (
                              <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                                {section.content}
                              </Text>
                            )}
                            {section.image_url && (
                              <Box mt="4">
                                <img
                                  src={section.image_url}
                                  alt={section.title || 'Solution image'}
                                  style={{
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        )}

                        {section.section_type === 'benefits' && (
                          <Box p="4" style={{ background: 'var(--green-a2)' }}>
                            <Heading size="5" mb="3" color="green">
                              {section.title || 'Benefits'}
                            </Heading>
                            {section.content && (
                              <Text size="3" style={{ whiteSpace: 'pre-wrap' }}>
                                {section.content}
                              </Text>
                            )}
                            {section.image_url && (
                              <Box mt="4">
                                <img
                                  src={section.image_url}
                                  alt={section.title || 'Benefits image'}
                                  style={{
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        )}

                        {section.section_type === 'testimonial' && (
                          <Box
                            p="4"
                            style={{
                              background: 'var(--gray-a2)',
                              borderLeft: '4px solid var(--blue-9)',
                              borderRadius: 4,
                            }}
                          >
                            {section.title && (
                              <Heading size="4" mb="2">
                                {section.title}
                              </Heading>
                            )}
                            {section.content && (
                              <Text size="3" style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                "{section.content}"
                              </Text>
                            )}
                            {section.image_url && (
                              <Box mt="4">
                                <img
                                  src={section.image_url}
                                  alt={section.title || 'Testimonial image'}
                                  style={{
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ))}
                </Box>
              )}

            {/* Equipment Groups (for technical offers) */}
            {offer.offer_type === 'technical' &&
              offer.groups &&
              offer.groups.length > 0 && (
              <Box mb="6">
                <Heading size="4" mb="4">
                  Equipment
                </Heading>
                {offer.groups.map((group) => (
                  <Box key={group.id} mb="4">
                    <Heading size="3" mb="3">
                      {group.group_name}
                    </Heading>
                    <Box as="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--gray-a6)' }}>
                          <Text as="th" size="2" weight="bold" style={{ textAlign: 'left', padding: '8px' }}>
                            Item
                          </Text>
                          <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                            Quantity
                          </Text>
                          <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                            Unit Price
                          </Text>
                          <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                            Total
                          </Text>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items?.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--gray-a4)' }}>
                            <Text as="td" size="2" style={{ padding: '8px' }}>
                              {item.item?.name || 'Unknown Item'}
                              {item.is_internal ? (
                                <Text size="1" color="gray" ml="2">
                                  (Internal)
                                </Text>
                              ) : (
                                <Text size="1" color="gray" ml="2">
                                  (External)
                                </Text>
                              )}
                            </Text>
                            <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                              {item.quantity}
                            </Text>
                            <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                              {formatCurrency(item.unit_price)}
                            </Text>
                            <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                              {formatCurrency(item.total_price)}
                            </Text>
                          </tr>
                        ))}
                      </tbody>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Crew Items (for technical offers) */}
            {offer.offer_type === 'technical' &&
              offer.crew_items &&
              offer.crew_items.length > 0 && (
              <Box mb="6">
                <Heading size="4" mb="4">
                  Crew
                </Heading>
                <Box as="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gray-a6)' }}>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'left', padding: '8px' }}>
                        Role
                      </Text>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                        Count
                      </Text>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'left', padding: '8px' }}>
                        Dates
                      </Text>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                        Total
                      </Text>
                    </tr>
                  </thead>
                  <tbody>
                    {offer.crew_items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--gray-a4)' }}>
                        <Text as="td" size="2" style={{ padding: '8px' }}>
                          {item.role_title}
                        </Text>
                        <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                          {item.crew_count}
                        </Text>
                        <Text as="td" size="2" style={{ padding: '8px' }}>
                          {formatDate(item.start_date)} - {formatDate(item.end_date)}
                        </Text>
                        <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                          {formatCurrency(item.total_price)}
                        </Text>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            )}

            {/* Transport Items (for technical offers) */}
            {offer.offer_type === 'technical' &&
              offer.transport_items &&
              offer.transport_items.length > 0 && (
              <Box mb="6">
                <Heading size="4" mb="4">
                  Transportation
                </Heading>
                <Box as="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gray-a6)' }}>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'left', padding: '8px' }}>
                        Vehicle
                      </Text>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'left', padding: '8px' }}>
                        Dates
                      </Text>
                      <Text as="th" size="2" weight="bold" style={{ textAlign: 'right', padding: '8px' }}>
                        Total
                      </Text>
                    </tr>
                  </thead>
                  <tbody>
                    {offer.transport_items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--gray-a4)' }}>
                        <Text as="td" size="2" style={{ padding: '8px' }}>
                          {item.vehicle?.name || item.vehicle_name}
                          {item.is_internal ? (
                            <Text size="1" color="gray" ml="2">
                              (Internal)
                            </Text>
                          ) : (
                            <Text size="1" color="gray" ml="2">
                              (External)
                            </Text>
                          )}
                        </Text>
                        <Text as="td" size="2" style={{ padding: '8px' }}>
                          {formatDate(item.start_date)} - {formatDate(item.end_date)}
                        </Text>
                        <Text as="td" size="2" style={{ textAlign: 'right', padding: '8px' }}>
                          {formatCurrency(item.total_price)}
                        </Text>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            )}

            <Separator my="6" />

            {/* Pricing Summary */}
            <Box mb="6">
              <Heading size="4" mb="4">
                Pricing Summary
              </Heading>
              <Flex direction="column" gap="2">
                <Flex justify="between">
                  <Text>Days of use:</Text>
                  <Text weight="medium">{offer.days_of_use}</Text>
                </Flex>
                <Flex justify="between">
                  <Text>Equipment Subtotal:</Text>
                  <Text>{formatCurrency(offer.equipment_subtotal)}</Text>
                </Flex>
                <Flex justify="between">
                  <Text>Crew Subtotal:</Text>
                  <Text>{formatCurrency(offer.crew_subtotal)}</Text>
                </Flex>
                <Flex justify="between">
                  <Text>Transport Subtotal:</Text>
                  <Text>{formatCurrency(offer.transport_subtotal)}</Text>
                </Flex>
                <Separator my="2" />
                <Flex justify="between">
                  <Text>Subtotal:</Text>
                  <Text>{formatCurrency(offer.total_before_discount)}</Text>
                </Flex>
                {offer.discount_percent > 0 && (
                  <Flex justify="between">
                    <Text>Discount ({offer.discount_percent}%):</Text>
                    <Text color="green">
                      -{formatCurrency(offer.total_before_discount - offer.total_after_discount)}
                    </Text>
                  </Flex>
                )}
                <Flex justify="between">
                  <Text>After Discount:</Text>
                  <Text weight="medium">{formatCurrency(offer.total_after_discount)}</Text>
                </Flex>
                <Flex justify="between">
                  <Text>VAT ({offer.vat_percent}%):</Text>
                  <Text>
                    {formatCurrency(offer.total_with_vat - offer.total_after_discount)}
                  </Text>
                </Flex>
                <Separator my="2" />
                <Flex justify="between">
                  <Text size="4" weight="bold">
                    Total:
                  </Text>
                  <Text size="4" weight="bold">
                    {formatCurrency(offer.total_with_vat)}
                  </Text>
                </Flex>
              </Flex>
            </Box>

            <Separator my="6" />

            {/* Acceptance Section */}
            {isAccepted && (
              <Box
                p="4"
                style={{
                  background: 'var(--green-a3)',
                  borderRadius: 8,
                  border: '1px solid var(--green-a6)',
                }}
              >
                <Heading size="4" mb="2" color="green">
                  Offer Accepted
                </Heading>
                {offer.accepted_by_name && (
                  <Text size="2" color="gray">
                    Accepted by {offer.accepted_by_name}
                    {offer.accepted_by_email && ` (${offer.accepted_by_email})`}
                  </Text>
                )}
                <Text size="2" color="gray" mt="1">
                  Accepted on {formatDate(offer.accepted_at)}
                </Text>
              </Box>
            )}

            {!isAccepted && showAcceptForm && (
              <Box mb="6">
                <Heading size="4" mb="4">
                  Accept Offer
                </Heading>
                <Flex direction="column" gap="3">
                  <TextField.Root
                    placeholder="Your full name"
                    value={acceptanceForm.name}
                    onChange={(e) =>
                      setAcceptanceForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                  <TextField.Root
                    type="email"
                    placeholder="Your email address"
                    value={acceptanceForm.email}
                    onChange={(e) =>
                      setAcceptanceForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                  <TextField.Root
                    type="tel"
                    placeholder="Your phone number"
                    value={acceptanceForm.phone}
                    onChange={(e) =>
                      setAcceptanceForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                  <Flex gap="2">
                    <Button
                      onClick={() => acceptMutation.mutate()}
                      disabled={
                        !acceptanceForm.name ||
                        !acceptanceForm.email ||
                        !acceptanceForm.phone ||
                        acceptMutation.isPending
                      }
                    >
                      {acceptMutation.isPending ? 'Accepting...' : 'Confirm Acceptance'}
                    </Button>
                    <Button
                      variant="soft"
                      onClick={() => setShowAcceptForm(false)}
                      disabled={acceptMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            )}

            {canAccept && (
              <Flex justify="center" mt="6">
                <Button size="3" onClick={() => setShowAcceptForm(true)}>
                  Accept Offer
                </Button>
              </Flex>
            )}
          </Box>
        </Box>
      </Card>
    </Box>
  )
}

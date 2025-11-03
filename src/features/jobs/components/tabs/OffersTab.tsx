// src/features/jobs/components/tabs/OffersTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { Copy, Eye, Lock, Plus, Trash, Edit, Calendar, Download } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import {
  jobOffersQuery,
  duplicateOffer,
  deleteOffer,
  lockOffer,
  createBookingsFromOffer,
  exportOfferPDF,
} from '../../api/offerQueries'
import TechnicalOfferEditor from '../dialogs/TechnicalOfferEditor'
import PrettyOfferEditor from '../dialogs/PrettyOfferEditor'
import type { JobOffer, OfferType } from '../../types'

function getOfferStatusBadgeColor(status: JobOffer['status']) {
  switch (status) {
    case 'draft':
      return 'gray'
    case 'sent':
      return 'blue'
    case 'viewed':
      return 'purple'
    case 'accepted':
      return 'green'
    case 'rejected':
      return 'red'
    case 'superseded':
      return 'orange'
    default:
      return 'gray'
  }
}

function getOfferTypeLabel(type: OfferType) {
  return type === 'technical' ? 'Technical' : 'Pretty'
}

export default function OffersTab({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [deleteOpen, setDeleteOpen] = React.useState<JobOffer | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(
    null,
  )

  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: offers = [], isLoading } = useQuery({
    ...jobOffersQuery(jobId),
  })

  const deleteOfferMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer deleted', 'The offer has been deleted.')
      setDeleteOpen(null)
    },
    onError: (err: any) => {
      toastError('Failed to delete offer', err?.message || 'Please try again.')
    },
  })

  const duplicateOfferMutation = useMutation({
    mutationFn: duplicateOffer,
    onSuccess: (newOfferId) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success(
        'Offer duplicated',
        'A new version of the offer has been created.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to duplicate offer',
        err?.message || 'Please try again.',
      )
    },
  })

  const lockOfferMutation = useMutation({
    mutationFn: lockOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer locked', 'The offer has been locked and sent.')
    },
    onError: (err: any) => {
      toastError('Failed to lock offer', err?.message || 'Please try again.')
    },
  })

  // Get current user ID for booking creation
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const createBookingsMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      await createBookingsFromOffer(offerId, user.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      // Invalidate calendar queries to show new bookings
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      success(
        'Bookings created',
        'Time periods and reservations have been created from the offer.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to create bookings',
        err?.message || 'Please try again.',
      )
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => {
      success('PDF exported', 'The offer has been exported as PDF.')
    },
    onError: (err: any) => {
      toastError('Failed to export PDF', err?.message || 'Please try again.')
    },
  })

  const [editorType, setEditorType] = React.useState<'technical' | 'pretty'>(
    'technical',
  )

  const handleCreateTechnicalOffer = () => {
    setEditingOfferId(null)
    setEditorType('technical')
    setEditorOpen(true)
  }

  const handleCreatePrettyOffer = () => {
    setEditingOfferId(null)
    setEditorType('pretty')
    setEditorOpen(true)
  }

  const handleEditOffer = (offer: JobOffer) => {
    if (offer.locked || offer.status !== 'draft') {
      toastError(
        'Cannot edit offer',
        'Only draft offers can be edited. Locked or sent offers cannot be modified.',
      )
      return
    }
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleViewOffer = (offer: JobOffer) => {
    // For now, view is the same as edit, but in read-only mode
    // In the future, this could open a read-only viewer
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleDuplicateOffer = (offer: JobOffer) => {
    duplicateOfferMutation.mutate(offer.id)
  }

  const handleLockOffer = (offer: JobOffer) => {
    lockOfferMutation.mutate(offer.id)
  }

  const handleCreateBookings = (offer: JobOffer) => {
    if (!user?.id) {
      toastError('Authentication required', 'Please log in to create bookings.')
      return
    }
    createBookingsMutation.mutate(offer.id)
  }

  const handleExportPDF = (offer: JobOffer) => {
    exportPdfMutation.mutate(offer.id)
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
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Box>
      <Flex mb="3" justify="between" align="center">
        <Heading size="3">Offers</Heading>
        {!isReadOnly && (
          <Flex gap="2">
            <Button
              size="2"
              variant="outline"
              onClick={handleCreateTechnicalOffer}
            >
              <Plus width={16} height={16} /> Create Technical Offer
            </Button>
            <Button size="2" onClick={handleCreatePrettyOffer}>
              <Plus width={16} height={16} /> Create Pretty Offer
            </Button>
          </Flex>
        )}
      </Flex>

      {isLoading ? (
        <Text>Loading offers...</Text>
      ) : offers.length === 0 ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="3" color="gray">
            No offers yet
          </Text>
          <Text size="2" color="gray" mt="2">
            Create your first offer to get started
          </Text>
        </Box>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Version</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {offers.map((offer) => (
              <Table.Row key={offer.id}>
                <Table.Cell>
                  <Flex align="center" gap="2">
                    <Text>v{offer.version_number}</Text>
                    {offer.locked && (
                      <Lock width={14} height={14} color="var(--orange-9)" />
                    )}
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="soft">
                    {getOfferTypeLabel(offer.offer_type)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    radius="full"
                    color={getOfferStatusBadgeColor(offer.status)}
                    highContrast
                  >
                    {offer.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text weight="medium">{offer.title}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text>{formatCurrency(offer.total_with_vat)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{formatDate(offer.created_at)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    {offer.offer_type === 'technical' ? (
                      <>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => handleViewOffer(offer)}
                        >
                          <Eye width={14} height={14} /> View
                        </Button>
                        {!isReadOnly && !offer.locked && (
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => {
                              setEditorType('technical')
                              handleEditOffer(offer)
                            }}
                          >
                            <Edit width={14} height={14} /> Edit
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => {
                            setEditorType('pretty')
                            handleViewOffer(offer)
                          }}
                        >
                          <Eye width={14} height={14} /> View
                        </Button>
                        {!isReadOnly && !offer.locked && (
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => {
                              setEditorType('pretty')
                              handleEditOffer(offer)
                            }}
                          >
                            <Edit width={14} height={14} /> Edit
                          </Button>
                        )}
                      </>
                    )}
                    {!isReadOnly && (
                      <>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => handleDuplicateOffer(offer)}
                          disabled={duplicateOfferMutation.isPending}
                        >
                          <Copy width={14} height={14} />
                          Duplicate
                        </Button>
                        {!offer.locked && (
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => handleLockOffer(offer)}
                            disabled={lockOfferMutation.isPending}
                          >
                            <Lock width={14} height={14} /> Lock & Send
                          </Button>
                        )}
                        {offer.status === 'accepted' && (
                          <Button
                            size="1"
                            variant="soft"
                            color="green"
                            onClick={() => handleCreateBookings(offer)}
                            disabled={createBookingsMutation.isPending}
                          >
                            <Calendar width={14} height={14} /> Create Bookings
                          </Button>
                        )}
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => handleExportPDF(offer)}
                          disabled={exportPdfMutation.isPending}
                        >
                          <Download width={14} height={14} /> Export PDF
                        </Button>
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={() => setDeleteOpen(offer)}
                        >
                          <Trash width={14} height={14} />
                        </Button>
                      </>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteOpen && (
        <Dialog.Root
          open={!!deleteOpen}
          onOpenChange={(v) => !v && setDeleteOpen(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Offer?</Dialog.Title>
            <Separator my="3" />
            <Text size="2">
              Are you sure you want to delete this offer? This action cannot be
              undone.
            </Text>
            <Box
              mt="3"
              p="3"
              style={{
                background: 'var(--gray-a2)',
                borderRadius: 8,
              }}
            >
              <Flex direction="column" gap="1">
                <Text size="2">
                  <strong>Title:</strong> {deleteOpen.title}
                </Text>
                <Text size="2">
                  <strong>Type:</strong>{' '}
                  {getOfferTypeLabel(deleteOpen.offer_type)}
                </Text>
                <Text size="2">
                  <strong>Status:</strong> {deleteOpen.status}
                </Text>
                <Text size="2">
                  <strong>Version:</strong> {deleteOpen.version_number}
                </Text>
              </Flex>
            </Box>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" disabled={deleteOfferMutation.isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                onClick={() => deleteOfferMutation.mutate(deleteOpen.id)}
                disabled={deleteOfferMutation.isPending}
              >
                {deleteOfferMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Offer Editor */}
      {editorOpen && editorType === 'technical' && (
        <TechnicalOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
        />
      )}
      {editorOpen && editorType === 'pretty' && (
        <PrettyOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
        />
      )}
    </Box>
  )
}

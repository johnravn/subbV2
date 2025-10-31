import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  SegmentedControl,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, NavArrowDown, NavArrowRight, Trash, Truck } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { FixedTimePeriodEditor } from '@features/calendar/components/reservations/TimePeriodPicker'
import BookVehicleDialog, {
  EditVehicleBookingDialog,
} from '../dialogs/BookVehicleDialog'
import type { ExternalReqStatus, ReservedVehicleRow } from '../../types'

export default function TransportTab({ jobId }: { jobId: string }) {
  const [bookVehOpen, setBookVehOpen] = React.useState(false)
  const [editingBooking, setEditingBooking] = React.useState<{
    id: string
    external_status: ExternalReqStatus | null
    external_note: string | null
  } | null>(null)
  const [deletingBooking, setDeletingBooking] = React.useState<string | null>(
    null,
  )
  const { companyId } = useCompany()
  const canBook = !!companyId

  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [expandedOwners, setExpandedOwners] = React.useState<Set<string>>(
    new Set(),
  )
  const [expandedInternal, setExpandedInternal] = React.useState(false)
  const [ownerNotes, setOwnerNotes] = React.useState<Map<string, string>>(
    new Map(),
  )

  const { data } = useQuery({
    queryKey: ['jobs.transport', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: rErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
      if (rErr) throw rErr
      const resIds = timePeriods.map((r) => r.id)
      if (!resIds.length) return [] as Array<ReservedVehicleRow>
      const { data: rows, error } = await supabase
        .from('reserved_vehicles')
        .select(
          `
          id, time_period_id, vehicle_id, external_status, external_note,
          vehicle:vehicle_id (
            id, name, external_owner_id, deleted,
            external_owner:external_owner_id ( id, name )
          )
        `,
        )
        .in('time_period_id', resIds)
      if (error) throw error

      // Filter out rows where vehicle is deleted
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const filteredRows = (rows || []).filter((row: any) => {
        const vehicle = row.vehicle
        // Handle both array and object formats from Supabase
        const vehicleObj = Array.isArray(vehicle) ? vehicle[0] : vehicle
        return !vehicleObj?.deleted
      })

      return filteredRows as unknown as Array<ReservedVehicleRow>
    },
  })

  // Group vehicles by external owner
  const { internalVehicles, ownerGroups } = React.useMemo(() => {
    const internal: Array<ReservedVehicleRow> = []
    const groups = new Map<string, Array<ReservedVehicleRow>>()

    for (const row of data ?? []) {
      const vehicle = row.vehicle as any
      const ownerId = vehicle?.external_owner_id

      if (!ownerId) {
        internal.push(row)
      } else {
        const ownerVehicles = groups.get(ownerId) || []
        ownerVehicles.push(row)
        groups.set(ownerId, ownerVehicles)
      }
    }

    return { internalVehicles: internal, ownerGroups: groups }
  }, [data])

  // Sync ownerNotes when data changes
  React.useEffect(() => {
    setOwnerNotes((prevNotes) => {
      const newNotes = new Map<string, string>()
      for (const [ownerId, vehicles] of ownerGroups.entries()) {
        const currentNote = vehicles[0]?.external_note ?? ''
        const editedNote = prevNotes.get(ownerId)
        if (editedNote !== undefined && editedNote !== currentNote) {
          newNotes.set(ownerId, editedNote)
        }
      }
      return newNotes
    })
  }, [ownerGroups])

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(ownerId)) {
        next.delete(ownerId)
      } else {
        next.add(ownerId)
      }
      return next
    })
  }

  const handleUpdateOwnerVehicles = async (
    ownerVehicles: Array<ReservedVehicleRow>,
    updates: {
      external_status?: ExternalReqStatus
      external_note?: string
    },
  ) => {
    try {
      const vehicleIds = ownerVehicles.map((r) => r.id)
      const { error: updateErr } = await supabase
        .from('reserved_vehicles')
        .update(updates)
        .in('id', vehicleIds)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      success('Updated', 'All vehicles for this owner updated')
    } catch (e: any) {
      showError('Failed to update', e?.message || 'Please try again.')
    }
  }

  const deleteBooking = async (bookingId: string) => {
    try {
      // First, get the time_period_id to check if we should delete it
      const { data: booking, error: fetchErr } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id')
        .eq('id', bookingId)
        .single()
      if (fetchErr) throw fetchErr

      // Check if any other vehicles use this time period
      const { data: otherBookings, error: checkErr } = await supabase
        .from('reserved_vehicles')
        .select('id')
        .eq('time_period_id', booking.time_period_id)
        .neq('id', bookingId)
      if (checkErr) throw checkErr

      // Delete the booking
      const { error: deleteErr } = await supabase
        .from('reserved_vehicles')
        .delete()
        .eq('id', bookingId)
      if (deleteErr) throw deleteErr

      // If no other bookings use this time period, delete it
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!otherBookings || otherBookings.length === 0) {
        const { error: tpDeleteErr } = await supabase
          .from('time_periods')
          .delete()
          .eq('id', booking.time_period_id)
        if (tpDeleteErr) throw tpDeleteErr
      }

      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Deleted', 'Vehicle booking deleted')
      setDeletingBooking(null)
    } catch (e: any) {
      showError('Failed to delete', e?.message || 'Please try again.')
    }
  }

  return (
    <Box>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">Transportation</Heading>
        <Button
          size="2"
          disabled={!canBook}
          onClick={() => setBookVehOpen(true)}
        >
          <Truck /> Book vehicle
        </Button>
        {canBook && (
          <BookVehicleDialog
            open={bookVehOpen}
            onOpenChange={setBookVehOpen}
            jobId={jobId}
            companyId={companyId}
          />
        )}
      </Box>

      {/* Internal Vehicles */}
      {internalVehicles.length > 0 && (
        <Box
          mb="4"
          style={{
            border: '1px solid var(--gray-a5)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--gray-a1)',
          }}
        >
          {/* Internal Header */}
          <Box
            p="3"
            style={{
              background: 'var(--gray-a2)',
              cursor: 'pointer',
              borderBottom: expandedInternal
                ? '1px solid var(--gray-a5)'
                : 'none',
            }}
            onClick={() => setExpandedInternal(!expandedInternal)}
          >
            <Flex align="center" gap="3">
              {expandedInternal ? (
                <NavArrowDown width={18} height={18} />
              ) : (
                <NavArrowRight width={18} height={18} />
              )}
              <Text weight="medium">Internal vehicles</Text>
              <Text size="2" color="gray">
                ({internalVehicles.length}{' '}
                {internalVehicles.length === 1 ? 'vehicle' : 'vehicles'})
              </Text>
            </Flex>
          </Box>

          {/* Expanded Details */}
          {expandedInternal && (
            <Box
              p="3"
              style={{
                background: 'var(--gray-a1)',
                borderTop: '1px solid var(--gray-a4)',
              }}
            >
              <Flex direction="column" gap="3">
                {/* Time Period Editor */}
                {internalVehicles.length > 0 && (
                  <Box>
                    <Text size="1" weight="medium" mb="1">
                      Time Period
                    </Text>
                    {(() => {
                      // Get time period from first internal vehicle
                      // Since each booking creates its own time period, we show the first one
                      // Users can edit individual time periods if they differ
                      const firstTimePeriod =
                        internalVehicles[0]?.time_period_id
                      if (!firstTimePeriod) {
                        return (
                          <Box
                            p="2"
                            style={{
                              border: '1px dashed var(--amber-a6)',
                              borderRadius: 8,
                              background: 'var(--amber-a2)',
                            }}
                          >
                            <Text size="2" color="amber">
                              No time period set
                            </Text>
                          </Box>
                        )
                      }

                      // Check if all internal vehicles share the same time period
                      const allSamePeriod = internalVehicles.every(
                        (v) => v.time_period_id === firstTimePeriod,
                      )

                      return (
                        <>
                          <FixedTimePeriodEditor
                            jobId={jobId}
                            timePeriodId={firstTimePeriod}
                          />
                          {!allSamePeriod && (
                            <Text size="1" color="amber" mt="1">
                              Note: Internal vehicles use different time
                              periods. Editing will only update this time
                              period.
                            </Text>
                          )}
                        </>
                      )
                    })()}
                  </Box>
                )}

                {/* Vehicles Table */}
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Vehicle</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={{ width: '120px' }}>
                        Actions
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {internalVehicles.map((r) => (
                      <Table.Row key={r.id}>
                        <Table.Cell>
                          {(r.vehicle as any)?.name ?? '—'}
                        </Table.Cell>
                        <Table.Cell>
                          <Flex gap="2">
                            <IconButton
                              size="1"
                              variant="ghost"
                              onClick={() =>
                                setEditingBooking({
                                  id: r.id,
                                  external_status: null,
                                  external_note: null,
                                })
                              }
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="1"
                              variant="ghost"
                              color="red"
                              onClick={() => setDeletingBooking(r.id)}
                            >
                              <Trash />
                            </IconButton>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Flex>
            </Box>
          )}
        </Box>
      )}

      {/* External Vehicles by Owner */}
      {ownerGroups.size === 0 && internalVehicles.length === 0 && (
        <Box
          p="4"
          style={{
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text color="gray">No vehicles</Text>
        </Box>
      )}

      {Array.from(ownerGroups.entries()).map(([ownerId, ownerVehicles]) => {
        const firstRow = ownerVehicles[0]
        const vehicle = firstRow.vehicle as any
        const owner = Array.isArray(vehicle?.external_owner)
          ? vehicle?.external_owner[0]
          : vehicle?.external_owner
        const ownerName = owner?.name ?? ownerId
        const currentStatus = firstRow.external_status as ExternalReqStatus
        const currentNote = firstRow.external_note ?? ''
        const currentTimePeriod = firstRow.time_period_id
        const isExpanded = expandedOwners.has(ownerId)
        const editedNote = ownerNotes.get(ownerId) ?? currentNote
        const noteChanged = editedNote !== currentNote

        return (
          <Box
            key={ownerId}
            mb="4"
            style={{
              border: '1px solid var(--gray-a5)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--gray-a1)',
            }}
          >
            {/* Owner Header */}
            <Box
              p="3"
              style={{
                background: 'var(--gray-a2)',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid var(--gray-a5)' : 'none',
              }}
              onClick={() => toggleOwner(ownerId)}
            >
              <Flex align="center" justify="between">
                <Flex align="center" gap="3">
                  {isExpanded ? (
                    <NavArrowDown width={18} height={18} />
                  ) : (
                    <NavArrowRight width={18} height={18} />
                  )}
                  <Text weight="medium">{ownerName}</Text>
                  <Text size="2" color="gray">
                    ({ownerVehicles.length}{' '}
                    {ownerVehicles.length === 1 ? 'vehicle' : 'vehicles'})
                  </Text>
                </Flex>
                <Box onClick={(e) => e.stopPropagation()}>
                  <StatusBadge
                    value={currentStatus}
                    onChange={(v) =>
                      handleUpdateOwnerVehicles(ownerVehicles, {
                        external_status: v,
                      })
                    }
                  />
                </Box>
              </Flex>
            </Box>

            {/* Expanded Details */}
            {isExpanded && (
              <Box
                p="3"
                style={{
                  background: 'var(--gray-a1)',
                  borderTop: '1px solid var(--gray-a4)',
                }}
              >
                <Flex direction="column" gap="3">
                  <Box>
                    <Text size="1" weight="medium" mb="1">
                      Time Period
                    </Text>
                    {currentTimePeriod ? (
                      <FixedTimePeriodEditor
                        jobId={jobId}
                        timePeriodId={currentTimePeriod}
                      />
                    ) : (
                      <Box
                        p="2"
                        style={{
                          border: '1px dashed var(--amber-a6)',
                          borderRadius: 8,
                          background: 'var(--amber-a2)',
                        }}
                      >
                        <Text size="2" color="amber">
                          No time period set
                        </Text>
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <Text size="1" weight="medium" mb="1">
                      Note
                    </Text>
                    <TextField.Root
                      placeholder="Add note for all vehicles from this owner…"
                      value={editedNote}
                      onChange={(e) => {
                        const newNotes = new Map(ownerNotes)
                        newNotes.set(ownerId, e.target.value)
                        setOwnerNotes(newNotes)
                      }}
                    >
                      {noteChanged && (
                        <TextField.Slot side="right">
                          <Button
                            size="2"
                            variant="ghost"
                            onClick={() => {
                              handleUpdateOwnerVehicles(ownerVehicles, {
                                external_note: editedNote,
                              })
                              const newNotes = new Map(ownerNotes)
                              newNotes.delete(ownerId)
                              setOwnerNotes(newNotes)
                            }}
                          >
                            Save
                          </Button>
                        </TextField.Slot>
                      )}
                    </TextField.Root>
                  </Box>
                </Flex>

                {/* Vehicles Table */}
                <Box mt="3">
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Vehicle</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell style={{ width: '120px' }}>
                          Actions
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {ownerVehicles.map((r) => (
                        <Table.Row key={r.id}>
                          <Table.Cell>
                            {(r.vehicle as any)?.name ?? '—'}
                          </Table.Cell>
                          <Table.Cell>
                            <Flex gap="2">
                              <IconButton
                                size="1"
                                variant="ghost"
                                onClick={() =>
                                  setEditingBooking({
                                    id: r.id,
                                    external_status: r.external_status,
                                    external_note: r.external_note,
                                  })
                                }
                              >
                                <Edit />
                              </IconButton>
                              <IconButton
                                size="1"
                                variant="ghost"
                                color="red"
                                onClick={() => setDeletingBooking(r.id)}
                              >
                                <Trash />
                              </IconButton>
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Box>
            )}
          </Box>
        )
      })}

      {/* Edit Dialog */}
      {editingBooking && (
        <EditVehicleBookingDialog
          open={!!editingBooking}
          onOpenChange={(open) => !open && setEditingBooking(null)}
          row={editingBooking}
          jobId={jobId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingBooking && (
        <Dialog.Root
          open={!!deletingBooking}
          onOpenChange={(open) => !open && setDeletingBooking(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Vehicle Booking?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to delete this vehicle booking? The
              associated time period will also be deleted if no other vehicles
              use it.
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button variant="soft" onClick={() => setDeletingBooking(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => deleteBooking(deletingBooking)}
              >
                Delete
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

function StatusBadge({
  value,
  onChange,
}: {
  value: ExternalReqStatus
  onChange: (v: ExternalReqStatus) => void
}) {
  return (
    <SegmentedControl.Root
      size="2"
      value={value}
      onValueChange={(v) => onChange(v as ExternalReqStatus)}
    >
      <SegmentedControl.Item value="planned">Planned</SegmentedControl.Item>
      <SegmentedControl.Item value="requested">Requested</SegmentedControl.Item>
      <SegmentedControl.Item value="confirmed">Confirmed</SegmentedControl.Item>
    </SegmentedControl.Root>
  )
}

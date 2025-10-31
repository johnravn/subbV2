import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { toEventInputs } from '@features/calendar/components/domain'
import InspectorCalendar from '@features/calendar/components/InspectorCalendar'
import { vehicleCalendarQuery } from '@features/calendar/api/queries'
import { markVehicleDeleted, vehicleDetailQuery } from '../api/queries'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'
import type { EventInput } from '@fullcalendar/core'

export default function VehicleInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()
  const { error: toastError, success } = useToast()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [calendarOffset, setCalendarOffset] = React.useState(0)
  const [accumulatedEvents, setAccumulatedEvents] = React.useState<
    Array<EventInput>
  >([])

  const enabled = Boolean(companyId && id)
  const { data, isLoading, isError, error } = useQuery({
    ...vehicleDetailQuery({ companyId: companyId ?? '', id: id ?? '' }),
    enabled,
  })

  // Get current date in ISO format for filtering future events
  const now = React.useMemo(() => new Date().toISOString(), [])

  // Track the last processed offset to prevent duplicate processing
  const lastProcessedOffsetRef = React.useRef<number>(-1)

  // Fetch calendar events for this vehicle with pagination
  const { data: calendarRecords = [], isLoading: isLoadingCalendar } = useQuery(
    {
      ...vehicleCalendarQuery({
        companyId: companyId ?? '',
        vehicleId: id ?? '',
        limit: 5,
        offset: calendarOffset,
        fromDate: now, // Only future events
      }),
      enabled: enabled && !!id,
    },
  )

  // Reset when vehicle changes
  React.useEffect(() => {
    setAccumulatedEvents([])
    setCalendarOffset(0)
    lastProcessedOffsetRef.current = -1
  }, [id])

  // Accumulate events as we load more pages - only process once per offset
  React.useEffect(() => {
    // Skip if loading or if we've already processed this offset
    if (
      isLoadingCalendar ||
      lastProcessedOffsetRef.current === calendarOffset
    ) {
      return
    }

    // Mark this offset as processed
    lastProcessedOffsetRef.current = calendarOffset

    if (calendarRecords.length > 0) {
      const newEvents = toEventInputs(calendarRecords)

      if (calendarOffset === 0) {
        // First page - replace
        setAccumulatedEvents(newEvents)
      } else {
        // Subsequent pages - append (use functional update to avoid stale closure)
        setAccumulatedEvents((prev) => {
          // Prevent duplicates by checking IDs
          const existingIds = new Set(prev.map((e) => e.id))
          const uniqueNew = newEvents.filter(
            (e) => e.id && !existingIds.has(e.id),
          )
          return [...prev, ...uniqueNew]
        })
      }
    } else if (calendarOffset === 0) {
      // No events on first page - reset
      setAccumulatedEvents([])
    }
  }, [calendarRecords, calendarOffset, isLoadingCalendar])

  // Determine if there are more events to load
  const hasMoreEvents = calendarRecords.length === 5

  const handleLoadNext = React.useCallback(() => {
    setCalendarOffset((prev) => prev + 5)
  }, [])

  const del = useMutation({
    mutationFn: async () => {
      if (!companyId || !id) throw new Error('Missing ids')
      return markVehicleDeleted({ companyId, id })
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicles-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicle-detail'],
          exact: false,
        }),
      ])
      success('Deleted', 'Vehicle was marked as deleted.')
      setDeleteOpen(false)
    },
    onError: (e: any) =>
      toastError('Failed to delete', e?.message ?? 'Please try again.'),
  })

  // ---- Early returns BEFORE any non-hook logic ----
  if (!id) return <Text color="gray">Select a vehicle.</Text>
  if (!enabled) return <Text color="gray">Preparing…</Text>
  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  // ---- Safe to use 'data' now; no hooks below this line ----
  const v = data
  const imageUrl = v.image_path
    ? supabase.storage.from('vehicle_images').getPublicUrl(v.image_path).data
        .publicUrl
    : null

  const fuelColor: React.ComponentProps<typeof Badge>['color'] =
    v.fuel === 'electric' ? 'green' : v.fuel === 'diesel' ? 'orange' : 'blue'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {v.name}
          </Text>
          <Text as="div" size="2" color="gray">
            {v.registration_no ?? '—'}
            {' · '}
            <Badge variant="soft" color={fuelColor}>
              {v.fuel ?? '—'}
            </Badge>
            {' · '}
            {v.internally_owned ? (
              <Badge variant="soft" color="indigo">
                Internal
              </Badge>
            ) : (
              <Badge variant="soft" color="violet">
                {v.external_owner_name ?? 'External'}
              </Badge>
            )}
          </Text>
        </div>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
            <Edit />
          </Button>
          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Image */}
      <div
        style={{
          border: '1px solid var(--gray-a6)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
          padding: 10,
          maxWidth: 300,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={v.name}
            style={{
              width: '100%',
              // maxHeight: 280,
              // maxWidth: 280,
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              height: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gray-10)',
            }}
          >
            No image
          </div>
        )}
      </div>

      {/* Meta */}
      <Flex direction="column" gap="2">
        <Field
          label="Owner"
          value={
            v.internally_owned
              ? 'Internal (your company)'
              : (v.external_owner_name ?? 'External')
          }
        />
        <Field
          label="Created"
          value={new Date(v.created_at).toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
        <Field label="Notes" value={v.notes || '—'} />
      </Flex>

      <InspectorCalendar
        events={accumulatedEvents}
        calendarHref={`/calendar?vehicleId=${id}`}
        onCreate={(e) => console.log('create in inspector', e)}
        onUpdate={(eventId, patch) => console.log('update', eventId, patch)}
        onDelete={(eventId) => console.log('delete', eventId)}
        hasMore={hasMoreEvents}
        onLoadNext={handleLoadNext}
        showPagination={true}
      />

      {/* Edit dialog */}
      <AddEditVehicleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          id: v.id,
          name: v.name,
          registration_no: v.registration_no ?? '',
          fuel: v.fuel ?? null,
          internally_owned: v.internally_owned,
          external_owner_id: v.external_owner_id,
          image_path: v.image_path ?? null,
          notes: v.notes ?? '',
        }}
        onSaved={() => {
          // invalidate done in dialog
        }}
      />

      {/* Delete confirm */}
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete vehicle?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will mark <b>{v.name}</b> as deleted. You can restore in the DB
            if needed.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                variant="solid"
                onClick={() => del.mutate()}
                disabled={del.isPending}
              >
                {del.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  )
}

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

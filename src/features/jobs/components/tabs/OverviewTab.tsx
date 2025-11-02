import * as React from 'react'
import {
  AlertDialog,
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Skeleton,
  Text,
  TextArea,
} from '@radix-ui/themes'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { Edit } from 'iconoir-react'
import AddressDialog from '../dialogs/AddressDialog'
import type { JobDetail } from '../../types'

export type OverviewTabHandle = {
  checkUnsavedChanges: (proceed: () => void) => void
}

const OverviewTab = React.forwardRef<OverviewTabHandle, { job: JobDetail }>(
  ({ job }, ref) => {
    const { companyRole } = useAuthz()
    const isReadOnly = companyRole === 'freelancer'
    const qc = useQueryClient()
    const addr = job.address
      ? [
          job.address.address_line,
          job.address.zip_code,
          job.address.city,
          job.address.country,
        ]
          .filter(Boolean)
          .join(', ')
      : ''

    const { success, error } = useToast()

    const { data: authUser } = useQuery({
      queryKey: ['auth', 'user'],
      queryFn: async () => {
        const { data, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        return data.user
      },
    })

    const [notes, setNotes] = React.useState(job.description)
    const [editOpen, setEditOpen] = React.useState(false)
    const [saveBeforeLeaveOpen, setSaveBeforeLeaveOpen] = React.useState(false)
    const [pendingNavigation, setPendingNavigation] = React.useState<
      (() => void) | null
    >(null)

    // Reset notes when job changes
    React.useEffect(() => {
      setNotes(job.description)
      setPendingNavigation(null)
      setSaveBeforeLeaveOpen(false)
    }, [job.id, job.description])

    const initialNotes = job.description
    const hasUnsavedChanges = initialNotes !== notes

    // Expose function to check for unsaved changes when parent tries to change tabs
    React.useImperativeHandle(
      ref,
      () => ({
        checkUnsavedChanges: (proceed: () => void) => {
          if (hasUnsavedChanges) {
            setPendingNavigation(() => proceed)
            setSaveBeforeLeaveOpen(true)
          } else {
            proceed()
          }
        },
      }),
      [hasUnsavedChanges],
    )

    // Handle beforeunload for page navigation
    React.useEffect(() => {
      if (!hasUnsavedChanges || isReadOnly) return

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }, [hasUnsavedChanges, isReadOnly])

    const mut = useMutation({
      mutationFn: async () => {
        if (!authUser?.id) throw new Error('Not Authenticated')

        const { error: linkErr } = await supabase
          .from('jobs')
          .update({ description: notes })
          .eq('id', job.id)
        if (linkErr) throw linkErr
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['jobs-detail', job.id] })
        success('Saved', 'Notes saved on selected job.')
        // If there was a pending navigation, allow it now
        if (pendingNavigation) {
          const proceed = pendingNavigation
          setPendingNavigation(null)
          setSaveBeforeLeaveOpen(false)
          proceed()
        }
      },
      onError: (e: any) => {
        error('Save failed', e?.message ?? 'Please try again.')
      },
    })

    const handleSaveAndLeave = () => {
      if (pendingNavigation) {
        mut.mutate()
      }
    }

    const handleDiscardAndLeave = () => {
      setNotes(initialNotes)
      if (pendingNavigation) {
        const proceed = pendingNavigation
        setPendingNavigation(null)
        setSaveBeforeLeaveOpen(false)
        proceed()
      }
    }

    return (
      <Box>
        <Box>
          <Heading size="3">General</Heading>
          <Separator size="4" mb="3" />
          <KV label="Project lead">
            {job.project_lead?.display_name ?? '—'}
            <span style={{ color: 'var(--gray-11)' }}>
              {job.project_lead?.email ? ` (${job.project_lead.email})` : ''}
            </span>
          </KV>
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <KV label="Customer">{job.customer?.name ?? '—'}</KV>
            <KV label="Customer VAT">
              <Flex align={'center'} gap={'2'}>
                {fmtVAT((job as any).customer?.vat_number)}
                <CopyIconButton text={(job as any).customer?.vat_number} />
              </Flex>
            </KV>
          </Grid>
          <Grid columns={{ initial: '1', sm: '3' }} gap="4">
            <KV label="Contact">{job.customer_contact?.name ?? '—'}</KV>
            <KV label="Email">
              {job.customer_contact?.email ? (
                <a
                  href={`mailto:${job.customer_contact.email}`}
                  style={{ color: 'inherit' }}
                >
                  {job.customer_contact.email}
                </a>
              ) : (
                '—'
              )}
            </KV>
            <KV label="Phone">
              {job.customer_contact?.phone ? (
                <a
                  href={`tel:${job.customer_contact.phone}`}
                  style={{ color: 'inherit' }}
                >
                  {prettyPhone(job.customer_contact.phone)}
                </a>
              ) : (
                '—'
              )}
            </KV>
          </Grid>
          <Separator size="4" mb="2" />
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <KV label="Start">
              <Code>{fmt(job.start_at)}</Code>
            </KV>
            <KV label="End">
              <Code>{fmt(job.end_at)}</Code>
            </KV>
          </Grid>
        </Box>
        <Box>
          <Heading size="3">Notes</Heading>
          <Separator size="4" mb="3" />
          {isReadOnly ? (
            <Text style={{ whiteSpace: 'pre-wrap' }}>{notes || '—'}</Text>
          ) : (
            <Box>
              <TextArea
                value={notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes here"
                rows={6}
                resize="vertical"
              />
              {initialNotes != notes && (
                <Flex gap="2" mt="2" justify="end">
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => {
                      setNotes(initialNotes)
                    }}
                    disabled={mut.isPending}
                  >
                    Discard
                  </Button>
                  <Button
                    size="2"
                    variant="solid"
                    onClick={() => mut.mutate()}
                    disabled={mut.isPending}
                  >
                    {mut.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </Flex>
              )}
            </Box>
          )}
        </Box>
        <Box>
          <Flex align={'center'} gap={'2'} mt={'1'}>
            <Heading size="3">Location</Heading>
            {!isReadOnly && job.address && (
              <IconButton variant="ghost" onClick={() => setEditOpen(true)}>
                <Edit fontSize={'0.8rem'} />
              </IconButton>
            )}
            <AddressDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              companyId={job.company_id}
              mode="edit"
              initialData={job}
            />
          </Flex>
          <Separator size="4" mb="3" />
          {job.address ? (
            <Grid columns={{ initial: '1', sm: '2' }} gap="4">
              <Box>
                <KV label="Name">
                  <Flex align={'center'} gap={'2'}>
                    {job.address.name || '—'}
                  </Flex>
                </KV>
                <KV label="Address">{job.address.address_line || '—'}</KV>
                <Grid columns={'2'} gap={'4'}>
                  <KV label="Zip code">{job.address.zip_code || '-'}</KV>
                  <KV label="City">{job.address.city || '-'}</KV>
                </Grid>
                <KV label="Country">{job.address.country || '—'}</KV>
              </Box>
              {addr && (
                <Box
                  mb="3"
                  style={{
                    maxWidth: 400,
                    height: '100%',
                    overflow: 'hidden',
                    borderRadius: 8,
                  }}
                >
                  <MapWithSkeleton query={addr} zoom={14} />
                </Box>
              )}
            </Grid>
          ) : (
            !isReadOnly && (
              <Button size="3" variant="soft" onClick={() => setEditOpen(true)}>
                Add location
              </Button>
            )
          )}
        </Box>

        {/* Save before leave dialog */}
        <AlertDialog.Root
          open={saveBeforeLeaveOpen}
          onOpenChange={setSaveBeforeLeaveOpen}
        >
          <AlertDialog.Content maxWidth="480px">
            <AlertDialog.Title>Save changes?</AlertDialog.Title>
            <AlertDialog.Description size="2">
              You have unsaved changes to the notes. Do you want to save them
              before leaving?
            </AlertDialog.Description>
            <Flex gap="3" justify="end" mt="4">
              <AlertDialog.Cancel>
                <Button
                  variant="soft"
                  onClick={() => {
                    setSaveBeforeLeaveOpen(false)
                    setPendingNavigation(null)
                  }}
                >
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <Button
                variant="soft"
                color="red"
                onClick={handleDiscardAndLeave}
                disabled={mut.isPending}
              >
                Discard
              </Button>
              <Button
                variant="solid"
                onClick={handleSaveAndLeave}
                disabled={mut.isPending}
              >
                {mut.isPending ? 'Saving…' : 'Save and leave'}
              </Button>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </Box>
    )
  },
)

OverviewTab.displayName = 'OverviewTab'

export default OverviewTab

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Text style={{ display: 'block' }} size="2" color="gray">
        {label}
      </Text>
      <Text>{children}</Text>
    </div>
  )
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return (
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ` ${hours}:${minutes}`
  )
}

function MapWithSkeleton({ query, zoom }: { query: string; zoom?: number }) {
  const [isLoading, setIsLoading] = React.useState(true)

  return (
    <Box style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      {isLoading && (
        <Skeleton
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            width: '100%',
            height: '100%',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        <iframe
          title="Google Maps location"
          src={buildMapUrl(query, zoom)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          style={{
            border: 0,
            width: '100%',
            height: '100%',
            borderRadius: 8,
          }}
        />
      </div>
    </Box>
  )
}

function buildMapUrl(query: string, zoom?: number) {
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_API_KEY as
    | string
    | undefined
  if (!mapsKey) return ''

  const url = new URL('https://www.google.com/maps/embed/v1/place')
  url.searchParams.set('q', query)
  if (zoom != null) url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('key', mapsKey)
  return url.toString()
}

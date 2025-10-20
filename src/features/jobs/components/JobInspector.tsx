import * as React from 'react'
import { Badge, Box, Button, Flex, Heading, Tabs, Text } from '@radix-ui/themes'
import { Edit } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { useQuery } from '@tanstack/react-query'
import { jobDetailQuery } from '../api/queries'
import OverviewTab from './tabs/OverviewTab'
import EquipmentTab from './tabs/EquipmentTab'
import CrewTab from './tabs/CrewTab'
import TransportTab from './tabs/TransportTab'
import TimelineTab from './tabs/TimelineTab'
import ContactsTab from './tabs/ContactsTab'
import JobDialog from './dialogs/JobDialog'
import type { JobDetail } from '../types'

const ORDER: Array<JobDetail['status']> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'invoiced',
  'paid',
]

export default function JobInspector({ id }: { id: string | null }) {
  // ✅ hooks first
  const [editOpen, setEditOpen] = React.useState(false)
  const [statusTimelineOpen, setStatusTimelineOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    ...jobDetailQuery({ jobId: id ?? '__none__' }),
    enabled: !!id, // won't run until we have an id, but the hook is still called every render
  })

  // now you can early return safely since hooks above already ran
  if (!id) return <Text color="gray">Select a job to see details.</Text>
  if (isLoading || !data) return <Text>Loading…</Text>

  const job = data

  return (
    <Box>
      <Box
        mb="3"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Heading size="4">{job.title}</Heading>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge color="blue" radius="full" highContrast>
            {job.status}
          </Badge>
          <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
            <Edit width={16} height={16} /> Edit job
          </Button>
          <JobDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            companyId={job.company_id}
            mode="edit"
            initialData={job}
            // optional: refresh detail after save (on top of your invalidations)
            // onSaved={() => queryClient.invalidateQueries({ queryKey: ['jobs-detail', job.id] })}
          />
        </div>
      </Box>

      <Tabs.Root defaultValue="overview">
        <Tabs.List wrap="wrap">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
          <Tabs.Trigger value="crew">Crew</Tabs.Trigger>
          <Tabs.Trigger value="transport">Transportation</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
          <Tabs.Trigger value="contacts">Contacts</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" mt={'10px'}>
          <OverviewTab job={job} />
        </Tabs.Content>
        <Tabs.Content value="equipment" mt={'10px'}>
          <EquipmentTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="crew" mt={'10px'}>
          <CrewTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="transport" mt={'10px'}>
          <TransportTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="timeline" mt={'10px'}>
          <TimelineTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="contacts" mt={'10px'}>
          <ContactsTab jobId={job.id} companyId={job.company_id} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

function StatusTimeline(job: JobDetail, open: boolean) {
  return (
    <Box mt="4">
      <Heading size="3" mb="2">
        Status timeline
      </Heading>
      <Flex gap="2" wrap="wrap" align="center">
        {ORDER.map((s, i) => {
          const active = s === job.status
          const past = ORDER.indexOf(s) <= ORDER.indexOf(job.status)
          return (
            <Flex key={s} align="center" gap="2">
              <Badge
                color={active ? 'blue' : 'gray'}
                variant={active ? 'solid' : 'soft'}
                highContrast
              >
                {makeWordPresentable(s)}
              </Badge>
              {i < ORDER.length - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 1,
                    background: 'var(--gray-6)',
                  }}
                />
              )}
            </Flex>
          )
        })}
      </Flex>
    </Box>
  )
}

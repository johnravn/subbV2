import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Heading,
  Separator,
  Tabs,
  Text,
} from '@radix-ui/themes'
import { Edit } from 'iconoir-react'
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

export default function JobInspector({ id }: { id: string | null }) {
  const { data, isLoading } = useQuery({
    ...jobDetailQuery({ jobId: id ?? '__none__' }),
    enabled: !!id,
  })

  if (!id) return <Text color="gray">Select a job to see details.</Text>
  if (isLoading || !data) return <Text>Loading…</Text>

  const [editOpen, setEditOpen] = React.useState(false)

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

        <Tabs.Content value="overview">
          <Separator my="3" />
          <OverviewTab job={job} />
        </Tabs.Content>
        <Tabs.Content value="equipment">
          <Separator my="3" />
          <EquipmentTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="crew">
          <Separator my="3" />
          <CrewTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="transport">
          <Separator my="3" />
          <TransportTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="timeline">
          <Separator my="3" />
          <TimelineTab jobId={job.id} />
        </Tabs.Content>
        <Tabs.Content value="contacts">
          <Separator my="3" />
          <ContactsTab jobId={job.id} companyId={job.company_id} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Heading, Table, Text } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Edit, Plus } from 'iconoir-react'
import AddContactDialog, {
  EditContactDialog,
} from '../dialogs/AddContactDialog'

export default function ContactsTab({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}) {
  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState<{
    link: any
    contact: any
  } | null>(null)
  const { data } = useQuery({
    queryKey: ['jobs.contacts', jobId],
    queryFn: async () => {
      const [{ data: jc, error: e1 }, { data: res, error: e2 }] =
        await Promise.all([
          supabase
            .from('job_contacts')
            .select(
              `
            contact_id, role, notes,
            contact:contact_id ( id, name, email, phone, title, company_text )
          `,
            )
            .eq('job_id', jobId),
          supabase.from('time_periods').select('id').eq('job_id', jobId),
        ])
      if (e1) throw e1
      if (e2) throw e2
      const resIds = res.map((r) => r.id)
      let crew: Array<{ name: string; email: string }> = []
      if (resIds.length) {
        const { data: rows, error } = await supabase
          .from('reserved_crew')
          .select('user:user_id ( display_name, email )')
          .in('time_period_id', resIds)
        if (error) throw error
        crew = rows.map((r: any) => ({
          name: r.user?.display_name ?? '—',
          email: r.user?.email ?? '—',
        }))
      }
      return { jobContacts: jc, crew }
    },
  })

  return (
    <Box>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Heading size="3">Contacts</Heading>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="2" onClick={() => setAddOpen(true)}>
            <Plus /> Add contact
          </Button>
          <Button
            size="2"
            variant="soft"
            disabled={!data?.jobContacts.length}
            onClick={() => {
              // example: edit first row (you’ll likely add an action cell to pick row)
              const r = data!.jobContacts[0]
              setEditOpen({
                link: {
                  contact_id: r.contact_id,
                  role: r.role,
                  notes: r.notes,
                },
                contact: r.contact,
              })
            }}
          >
            <Edit /> Edit contact
          </Button>

          <AddContactDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            jobId={jobId}
            companyId={companyId}
          />

          {editOpen && (
            <EditContactDialog
              open={!!editOpen}
              onOpenChange={(v) => !v && setEditOpen(null)}
              jobId={jobId}
              link={editOpen.link}
              contact={editOpen.contact}
            />
          )}
        </div>
      </div>

      <Heading size="2" mb="2">
        From job
      </Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Phone</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Company text</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.jobContacts ?? []).map((r: any) => (
            <Table.Row key={r.contact_id}>
              <Table.Cell>{r.contact?.name ?? '—'}</Table.Cell>
              <Table.Cell>{r.contact?.email ?? '—'}</Table.Cell>
              <Table.Cell>{r.contact?.phone ?? '—'}</Table.Cell>
              <Table.Cell>{r.contact?.title ?? '—'}</Table.Cell>
              <Table.Cell>{r.contact?.company_text ?? '—'}</Table.Cell>
              <Table.Cell>{r.role ?? '—'}</Table.Cell>
            </Table.Row>
          ))}
          {(data?.jobContacts ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text color="gray">No job contacts</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

      <Heading size="2" mb="2" mt="4">
        Crew involved
      </Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.crew ?? []).map((c, i) => (
            <Table.Row key={i}>
              <Table.Cell>{c.name}</Table.Cell>
              <Table.Cell>{c.email}</Table.Cell>
            </Table.Row>
          ))}
          {(data?.crew ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={2}>
                <Text color="gray">No crew</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

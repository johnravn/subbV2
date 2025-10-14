import * as React from 'react'
import { Badge, Box, Flex, Grid, Heading, Text } from '@radix-ui/themes'
import MapEmbed from '@shared/maps/MapEmbed'
import type { JobDetail } from '../../types'

const ORDER: Array<JobDetail['status']> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
]

export default function OverviewTab({ job }: { job: JobDetail }) {
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

  return (
    <Box>
      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <Box>
          <Heading size="3" mb="2">
            General
          </Heading>
          <KV label="Project lead">
            {job.project_lead?.display_name ?? '—'}
            <span style={{ color: 'var(--gray-11)' }}>
              {job.project_lead?.email ? ` (${job.project_lead?.email})` : ''}
            </span>
          </KV>
          <KV label="Customer">{job.customer?.name ?? '—'}</KV>
          <KV label="Customer email">{(job as any).customer?.email ?? '—'}</KV>
          <KV label="Customer phone">{(job as any).customer?.phone ?? '—'}</KV>
          <KV label="Start">{fmt(job.start_at)}</KV>
          <KV label="End">{fmt(job.end_at)}</KV>
          <KV label="Load-in">{fmt(job.load_in_at)}</KV>
          <KV label="Load-out">{fmt(job.load_out_at)}</KV>
        </Box>
        <Box>
          <Heading size="3" mb="2">
            Location
          </Heading>
          <Text as="div" mb="2">
            {addr || '—'}
          </Text>
          {addr && (
            <Box
              style={{
                maxWidth: 520,
                height: 240,
                overflow: 'hidden',
                borderRadius: 8,
              }}
            >
              <MapEmbed query={addr} zoom={15} />
            </Box>
          )}
        </Box>
      </Grid>

      <Box mt="4">
        <Heading size="3" mb="2">
          Notes
        </Heading>
        <Text as="p" color="gray">
          {job.description || '—'}
        </Text>
      </Box>

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
                  {s}
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
    </Box>
  )
}

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
  return iso ? new Date(iso).toLocaleString() : '—'
}

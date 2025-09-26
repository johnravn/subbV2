// src/pages/Home.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { Bell, Calendar, CheckCircle, Package } from 'iconoir-react'

export default function HomePage() {
  return (
    <Box p="4" style={{ width: '100%' }}>
      <Heading size="8" mb="1">
        Welcome
      </Heading>
      <Text color="gray">Here’s a quick overview of your operation today.</Text>

      <Grid
        columns={{ initial: '1', md: '2' }} // 1 col mobile, 2 cols desktop
        gap="4"
        mt="5"
        width="100%"
      >
        <DashboardCard
          title="Inventory Snapshot"
          icon={<Package width={18} height={18} />}
          footer={
            <Button size="2" variant="soft">
              View inventory
            </Button>
          }
        >
          <KPI label="Items" value="1,284" />
          <KPI label="Low stock" value="12" />
          <KPI label="Backordered" value="3" />
        </DashboardCard>

        <DashboardCard
          title="Crew Today"
          icon={<CheckCircle width={18} height={18} />}
          footer={
            <Button size="2" variant="soft">
              Open crew board
            </Button>
          }
        >
          <KPI label="On shift" value="14" />
          <KPI label="Available" value="5" />
          <KPI label="Sick/Leave" value="2" />
        </DashboardCard>

        <DashboardCard
          title="Upcoming Jobs"
          icon={<Calendar width={18} height={18} />}
          footer={
            <Button size="2" variant="soft">
              See schedule
            </Button>
          }
        >
          <ListItem
            primary="Install – Site A"
            secondary="Today · 10:00–14:00 · 3 crew"
          />
          <Separator my="2" />
          <ListItem
            primary="Maintenance – Site B"
            secondary="Tomorrow · 08:00–12:00 · 2 crew"
          />
        </DashboardCard>

        <DashboardCard
          title="Alerts & Notifications"
          icon={<Bell width={18} height={18} />}
          footer={
            <Button size="2" variant="soft">
              Review all
            </Button>
          }
        >
          <ListItem
            primary="Clamp-01 low stock"
            secondary="4 left at Warehouse A"
            tone="warning"
          />
          <Separator my="2" />
          <ListItem
            primary="Overlap in Crew 2"
            secondary="Check schedule for 13:00–15:00"
            tone="warning"
          />
        </DashboardCard>
      </Grid>
    </Box>
  )
}

/* ---------- Reusable bits ---------- */

function DashboardCard({
  title,
  icon,
  children,
  footer,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card size="3">
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <IconBadge>{icon}</IconBadge>
            <Heading size="4">{title}</Heading>
          </Flex>
        </Flex>

        <Box>{children}</Box>

        {footer && (
          <>
            <Separator my="2" />
            <Flex justify="end">{footer}</Flex>
          </>
        )}
      </Flex>
    </Card>
  )
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Flex align="center" justify="between">
      <Text color="gray">{label}</Text>
      <Text weight="bold">{value}</Text>
    </Flex>
  )
}

function ListItem({
  primary,
  secondary,
  tone,
}: {
  primary: string
  secondary?: string
  tone?: 'warning' | 'default'
}) {
  const color = tone === 'warning' ? 'orange' : undefined
  return (
    <Box>
      <Text weight="medium" color={color as any}>
        {primary}
      </Text>
      {secondary && (
        <Text as="div" size="2" color={color ? 'orange' : 'gray'}>
          {secondary}
        </Text>
      )}
    </Box>
  )
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="32px"
      height="32px"
      style={{
        borderRadius: 8,
        background: 'var(--accent-3)',
        color: 'var(--accent-11)',
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}

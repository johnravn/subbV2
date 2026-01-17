import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  SegmentedControl,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { createTimeEntry, timeEntriesQuery } from '../api/timeEntries'
import TimeEntriesTable from '../components/TimeEntriesTable'
import { formatMonthInput, getRange } from '../lib/timeEntryRange'
import type { RangeOption } from '../lib/timeEntryRange'

export default function LoggingPage() {
  const { companyId } = useCompany()
  const { userId } = useAuthz()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [range, setRange] = React.useState<RangeOption>('month')
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    formatMonthInput(new Date()),
  )
  const { from, to, label } = React.useMemo(
    () => getRange(range, selectedMonth),
    [range, selectedMonth],
  )

  const { startAt: defaultStartAt, endAt: defaultEndAt } = React.useMemo(
    () => getDefaultTimes(),
    [],
  )
  const [title, setTitle] = React.useState('')
  const [jobNumber, setJobNumber] = React.useState('')
  const [note, setNote] = React.useState('')
  const [startAt, setStartAt] = React.useState(defaultStartAt)
  const [endAt, setEndAt] = React.useState(defaultEndAt)
  const pickedHours = React.useMemo(
    () => formatHoursBetween(startAt, endAt),
    [startAt, endAt],
  )

  const enabled = Boolean(companyId && userId)
  const { data: entries = [], isLoading } = useQuery({
    ...timeEntriesQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
      from,
      to,
    }),
    enabled,
  })

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error('Missing company or user')
      if (!title.trim()) {
        throw new Error('Title is required')
      }
      if (!startAt || !endAt) {
        throw new Error('Start and end time are required')
      }
      if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
        throw new Error('End time must be after start time')
      }

      await createTimeEntry({
        company_id: companyId,
        user_id: userId,
        title: title.trim(),
        job_number: jobNumber.trim() || null,
        note: note.trim() || null,
        start_at: startAt,
        end_at: endAt,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['time_entries', companyId, userId, from, to],
      })
      await qc.invalidateQueries({
        queryKey: ['time_entries', companyId, 'all', from, to],
      })
      const { startAt: resetStart, endAt: resetEnd } = getDefaultTimes()
      setTitle('')
      setJobNumber('')
      setNote('')
      setStartAt(resetStart)
      setEndAt(resetEnd)
      success('Saved', 'Time entry added')
    },
    onError: (e: any) => {
      error('Failed to save', e?.message || 'Please try again.')
    },
  })

  const handleStartChange = React.useCallback(
    (value: string) => {
      setStartAt(value)
      if (!value) return
      if (!endAt) {
        setEndAt(value)
        return
      }

      const startDate = new Date(value)
      const endDate = new Date(endAt)
      endDate.setFullYear(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      )
      const nextEndAt = endDate.toISOString()
      if (new Date(nextEndAt).getTime() < startDate.getTime()) {
        setEndAt(startDate.toISOString())
      } else {
        setEndAt(nextEndAt)
      }
    },
    [endAt],
  )

  const entryForm = (
    <>
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
        <Heading size="5">Logging</Heading>
      </Flex>
      <Separator size="4" mb="4" />

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Title
          </Text>
          <TextField.Root
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Time entry title"
            autoFocus
          />
        </label>
        <label>
          <Text as="div" size="2" mb="1" weight="medium">
            Job number
          </Text>
          <TextField.Root
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <DateTimePicker
          label="Start"
          value={startAt}
          onChange={handleStartChange}
        />
        <DateTimePicker
          label="End"
          value={endAt}
          onChange={(value) => setEndAt(value)}
        />
      </Box>

      <Box mt="4">
        <Text as="div" size="2" mb="1" weight="medium">
          Note
        </Text>
        <TextArea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional notes"
          style={{ minHeight: 60, width: '100%', display: 'block' }}
        />
      </Box>

      <Flex justify="between" align="center" mt="4" wrap="wrap" gap="2">
        <Text size="4" weight="bold">
          {pickedHours}
        </Text>
        <Button
          onClick={() => createEntry.mutate()}
          disabled={createEntry.isPending || !title.trim()}
        >
          {createEntry.isPending ? 'Saving…' : 'Add entry'}
        </Button>
      </Flex>
    </>
  )

  const totalHours = React.useMemo(() => {
    const total = entries.reduce((acc, entry) => {
      const start = new Date(entry.start_at).getTime()
      const end = new Date(entry.end_at).getTime()
      const durationMs = Math.max(0, end - start)
      return acc + durationMs
    }, 0)
    return total / (1000 * 60 * 60)
  }, [entries])

  const entriesTable = (
    <>
      <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
        <Heading size="4">Entries</Heading>
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2" color="gray">
            {entries.length} total
          </Text>
          <SegmentedControl.Root
            value={range}
            onValueChange={(value) => setRange(value as RangeOption)}
          >
            <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
            <SegmentedControl.Item value="year">
              This year
            </SegmentedControl.Item>
            <SegmentedControl.Item value="last-year">
              Last year
            </SegmentedControl.Item>
          </SegmentedControl.Root>
          {range === 'month' && (
            <TextField.Root
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ minWidth: 160 }}
            />
          )}
        </Flex>
      </Flex>
      <Text size="2" color="gray" mb="3">
        Showing entries for {label}
      </Text>
      <Separator size="4" mb="3" />

      <TimeEntriesTable entries={entries} isLoading={isLoading} />

      <Flex justify="end" mt="3">
        <Text size="4" weight="bold">
          Total: {totalHours.toFixed(2)} hours
        </Text>
      </Flex>
    </>
  )

  // 50/50 split; same responsive pattern as you use elsewhere
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Resize state: track left panel width as percentage (default 50% for 1fr/1fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      setLeftPanelWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (!companyId) return <div>No company selected.</div>

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <section style={{ minHeight: 0 }}>
        <Grid columns="1fr" gap="4" align="stretch" style={{ minHeight: 0 }}>
          <Card size="3" style={{ minHeight: 0 }}>
            {entryForm}
          </Card>
          <Card size="3" style={{ overflowX: 'auto', minHeight: 0 }}>
            {entriesTable}
          </Card>
        </Grid>
      </section>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <section style={{ height: '100%', minHeight: 0 }}>
      <Flex
        ref={containerRef}
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* LEFT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '320px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {entryForm}
          </Box>
        </Card>

        {/* RESIZER */}
        <Box
          className="section-resizer"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '6px',
            height: '20%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px',
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
              e.currentTarget.style.cursor = 'col-resize'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* RIGHT */}
        <Card
          size="3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '320px',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'auto',
            }}
          >
            {entriesTable}
          </Box>
        </Card>
      </Flex>
    </section>
  )
}

function getDefaultTimes() {
  const start = new Date()
  const minutes = start.getMinutes()
  start.setMinutes(0, 0, 0)
  if (minutes >= 30) {
    start.setHours(start.getHours() + 1)
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function formatHoursBetween(startAt: string, endAt: string) {
  if (!startAt || !endAt) return '--'
  const start = new Date(startAt)
  const end = new Date(endAt)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const hours = durationMs / (1000 * 60 * 60)
  return `${hours.toFixed(2)} hours`
}

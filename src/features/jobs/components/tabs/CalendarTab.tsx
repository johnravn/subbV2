import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box } from '@radix-ui/themes'
import FullCalendar from '@fullcalendar/react'
import '@shared/calendar/fullcalendar.radix.css'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { supabase } from '@shared/api/supabase'
import type { EventInput } from '@fullcalendar/core'
import type { TimePeriodLite } from '../../types'

export default function CalendarTab({ jobId }: { jobId: string }) {
  // Fetch job to get duration
  const { data: job } = useQuery({
    queryKey: ['jobs-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_at, end_at')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Fetch time periods
  const { data: timePeriods = [] } = useQuery({
    queryKey: ['jobs', jobId, 'time_periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
        .order('start_at', { ascending: true })
      if (error) throw error
      return data as Array<TimePeriodLite>
    },
  })

  // Convert time periods to calendar events
  const events: Array<EventInput> = React.useMemo(() => {
    return timePeriods.map((tp) => {
      const c = getRadixColorsForPeriod(tp.title)
      return {
        id: tp.id,
        title: tp.title || '(untitled)',
        start: tp.start_at,
        end: tp.end_at,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: c.text,
        extendedProps: {
          timePeriodId: tp.id,
        },
      }
    })
  }, [timePeriods])

  // Default to the custom Job view (relevant days)

  // Set initial date to job start
  const initialDate = job && job.start_at ? new Date(job.start_at) : new Date()

  // Compute relevant-days config for a separate "Job" view
  const jobRelevantConfig = React.useMemo(() => {
    if (!job || !job.start_at || !job.end_at) return null
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    const durationDays =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (durationDays > 365) return null // avoid extremely long spans

    // Build list of day indices (0=Sun..6=Sat) to show
    const daysToShow: Array<number> = []
    const cur = new Date(start)
    // include last day fully
    while (cur <= end) {
      daysToShow.push(cur.getDay())
      cur.setDate(cur.getDate() + 1)
    }
    // Unique
    const uniqueDays = Array.from(new Set(daysToShow))
    const allDays = [0, 1, 2, 3, 4, 5, 6]
    const hiddenDays = allDays.filter((d) => !uniqueDays.includes(d))

    // visibleRange to exactly the job span (end is exclusive → add 1 day)
    const range = {
      start: new Date(start.getFullYear(), start.getMonth(), start.getDate())
        .toISOString()
        .split('T')[0],
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
        .toISOString()
        .split('T')[0],
    }

    return { hiddenDays, visibleRange: range }
  }, [job])

  const [currentView, setCurrentView] = React.useState<string>('job')

  return (
    <Box className="jobCalendar" style={{ height: 'calc(100vh - 220px)' }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="job"
        initialDate={initialDate}
        events={events}
        views={{ job: { type: 'timeGridWeek' } }}
        buttonText={{ job: 'Job' }}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,job',
        }}
        firstDay={1}
        height="100%"
        contentHeight="100%"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        allDaySlot={false}
        expandRows={true}
        nowIndicator={true}
        datesSet={(arg) => setCurrentView(arg.view.type)}
        editable={false}
        selectable={false}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
          hour12: false,
        }}
        // Limit visible date range to job duration
        validRange={
          job && job.start_at && job.end_at
            ? {
                start: new Date(job.start_at).toISOString().split('T')[0],
                end: new Date(
                  new Date(job.end_at).getTime() + 24 * 60 * 60 * 1000,
                )
                  .toISOString()
                  .split('T')[0],
              }
            : undefined
        }
        // Relevant days only in the custom "Job" view
        hiddenDays={
          currentView === 'job' && jobRelevantConfig
            ? jobRelevantConfig.hiddenDays
            : undefined
        }
        visibleRange={
          currentView === 'job' && jobRelevantConfig
            ? jobRelevantConfig.visibleRange
            : undefined
        }
      />
    </Box>
  )
}

// Helper to assign colors to time periods
function getRadixColorsForPeriod(title: string | null): {
  bg: string
  border: string
  text: string
} {
  const t = (title || '').toLowerCase()

  // Use Radix alpha tokens for soft backgrounds and strong text for contrast
  if (t.includes('job duration'))
    return {
      bg: 'var(--blue-a4)',
      border: 'var(--blue-a7)',
      text: 'var(--blue-12)',
    }
  if (t.includes('equipment'))
    return {
      bg: 'var(--violet-a4)',
      border: 'var(--violet-a7)',
      text: 'var(--violet-12)',
    }
  if (t.includes('crew'))
    return {
      bg: 'var(--green-a4)',
      border: 'var(--green-a7)',
      text: 'var(--green-12)',
    }
  if (t.includes('vehicle') || t.includes('transport'))
    return {
      bg: 'var(--amber-a4)',
      border: 'var(--amber-a7)',
      text: 'var(--amber-12)',
    }
  if (t.includes('setup') || t.includes('load in'))
    return {
      bg: 'var(--cyan-a4)',
      border: 'var(--cyan-a7)',
      text: 'var(--cyan-12)',
    }
  if (t.includes('teardown') || t.includes('load out'))
    return {
      bg: 'var(--red-a4)',
      border: 'var(--red-a7)',
      text: 'var(--red-12)',
    }
  if (t.includes('show') || t.includes('event'))
    return {
      bg: 'var(--pink-a4)',
      border: 'var(--pink-a7)',
      text: 'var(--pink-12)',
    }

  // Default (e.g., external owner equipment periods)
  return {
    bg: 'var(--indigo-a4)',
    border: 'var(--indigo-a7)',
    text: 'var(--indigo-12)',
  }
}

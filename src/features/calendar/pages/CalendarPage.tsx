// import CompanyCalendarContainer from '@shared/scheduler/CompanyCalendarContainer'

// export default function CalendarPage() {
//   return (
//     <section>
//       <CompanyCalendarContainer />
//     </section>
//   )
// }

// src/pages/CalendarPage.tsx
import * as React from 'react'
import CompanyCalendarPro from '@features/calendar/components/CompanyCalendarPro'
import { toEventInputs } from '@features/calendar/components/domain'
import type { CalendarRecord } from '@features/calendar/components/domain'
import type { EventInput } from '@fullcalendar/core'

const seed: Array<CalendarRecord> = [
  {
    id: 'j1',
    title: 'Job: Concert build',
    start: '2025-10-27T08:30:00',
    end: '2025-10-27T12:00:00',
    kind: 'job',
    status: 'confirmed',
    ref: { jobId: 'job_1' },
  },
  {
    id: 'i1',
    title: 'Item: Mixer booked',
    start: '2025-10-27T07:00:00',
    end: '2025-10-28T10:00:00',
    kind: 'item',
    ref: { itemId: 'item_42', jobId: 'job_1' },
  },
  {
    id: 'v1',
    title: 'Vehicle: Van #2',
    start: '2025-10-28T07:30:00',
    end: '2025-10-28T18:00:00',
    kind: 'vehicle',
    ref: { vehicleId: 'veh_2', jobId: 'job_1' },
  },
  {
    id: 'c1',
    title: 'Crew: Anna (FOH)',
    start: '2025-10-28T13:00:00',
    end: '2025-10-28T22:00:00',
    kind: 'crew',
    ref: { userId: 'user_anna', jobId: 'job_1' },
  },
]

export default function CalendarPage() {
  const [events, setEvents] = React.useState(toEventInputs(seed))

  const onCreate = (e: {
    title: string
    start: string
    end?: string
    allDay: boolean
    context?: any
  }) => {
    const id = 'tmp_' + Math.random().toString(36).slice(2, 9)
    setEvents((prev) => [
      ...prev,
      {
        id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        extendedProps: { kind: e.context?.suggestedKind ?? 'job' },
      },
    ])
  }
  const onUpdate = (id: string, patch: Partial<EventInput>) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === id
          ? {
              ...ev,
              ...patch,
              extendedProps: {
                ...(ev.extendedProps ?? {}),
                ...(patch.extendedProps ?? {}),
              },
            }
          : ev,
      ),
    )
  }
  const onDelete = (id: string) =>
    setEvents((prev) => prev.filter((ev) => ev.id !== id))

  return (
    <CompanyCalendarPro
      events={events}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      defaultKinds={['job']} // default = jobs this month
    />
  )
}

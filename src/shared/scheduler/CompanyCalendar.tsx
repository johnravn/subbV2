// src/features/calendar/CompanyCalendar.tsx
import * as React from 'react'
import { Card } from '@radix-ui/themes'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import '@shared/styles/CompanyCalendar.css'
import interactionPlugin from '@fullcalendar/interaction'
import enLocale from '@fullcalendar/core/locales/en-gb'
import { renderEvent } from './renderEvent'
import type {
  DateSelectArg,
  EventClickArg,
  EventInput,
} from '@fullcalendar/core'

type Props = {
  events?: Array<EventInput> // You can hydrate from your API
  onCreateEvent?: (e: {
    title: string
    start: string
    end: string
    allDay: boolean
  }) => void
  onUpdateEvent?: (id: string, patch: Partial<EventInput>) => void
  onDeleteEvent?: (id: string) => void
}

export default function CompanyCalendar({
  events = [],
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: Props) {
  const calendarRef = React.useRef<FullCalendar | null>(null)

  function handleSelect(selection: DateSelectArg) {
    // Minimal UX: prompt — replace with a Radix Dialog (see below)
    const title = window.prompt('Event title?')
    if (title && onCreateEvent) {
      onCreateEvent({
        title,
        start: selection.startStr,
        end: selection.endStr,
        allDay: selection.allDay,
      })
    }
  }

  function handleEventClick(clickInfo: EventClickArg) {
    const { id, title } = clickInfo.event
    const action = window.prompt(
      `Edit title or type "delete" to remove:`,
      title || '',
    )
    if (!action) return
    if (action.toLowerCase() === 'delete') {
      onDeleteEvent?.(id)
    } else {
      onUpdateEvent?.(id, { title: action })
    }
  }

  return (
    <Card style={{ padding: 12 }}>
      <div className="companyCalendar">
        <FullCalendar
          ref={calendarRef as any}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          initialView="timeGridWeek"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          height="auto"
          weekends
          nowIndicator
          stickyHeaderDates
          selectable
          selectMirror
          editable
          eventResizableFromStart
          eventDurationEditable
          eventStartEditable
          select={handleSelect}
          eventClick={handleEventClick}
          events={events}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
          }}
          eventContent={renderEvent}
          slotMinTime="06:00:00"
          //   slotMaxTime="20:00:00"
          scrollTime="08:00:00"
          expandRows
          forceEventDuration={false}
          timeZone="Europe/Oslo"
          locale={enLocale}
          dayMaxEventRows
          // Better a11y on dark backgrounds in Radix Themes
          eventDisplay="block"
        />
      </div>
    </Card>
  )
}

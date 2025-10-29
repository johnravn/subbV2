// src/features/calendar/InspectorCalendar.tsx
import * as React from 'react'
import { Box, Flex, IconButton, Link as RLink, Text } from '@radix-ui/themes'
import { ArrowRight, Calendar, List } from 'iconoir-react'
import FullCalendar from '@fullcalendar/react'
import nbLocale from '@fullcalendar/core/locales/nb'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  DateSelectArg,
  EventClickArg,
  EventInput,
} from '@fullcalendar/core'

type Props = {
  events: Array<EventInput>
  calendarHref: string // link to your full calendar route
  onCreate?: (e: {
    title: string
    start: string
    end?: string
    allDay: boolean
  }) => void
  onUpdate?: (id: string, patch: Partial<EventInput>) => void
  onDelete?: (id: string) => void
}

export default function InspectorCalendar({
  events,
  calendarHref,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [listMode, setListMode] = React.useState(false)

  function handleSelect(sel: DateSelectArg) {
    const title = window.prompt('New booking title?')
    if (!title) return
    onCreate?.({
      title,
      start: sel.startStr,
      end: sel.endStr,
      allDay: sel.allDay,
    })
  }

  function handleEventClick(arg: EventClickArg) {
    const { id, title } = arg.event
    const action = window.prompt('Edit title, or type "delete"', title || '')
    if (!action) return
    if (action.toLowerCase() === 'delete') onDelete?.(id)
    else onUpdate?.(id, { title: action })
  }

  return (
    <Box
      className="companyCalendar"
      p="2"
      style={{ background: 'transparent' }}
    >
      <Flex align="center" justify="between" mb="2">
        <Text weight="bold">Schedule</Text>
        <Flex gap="2" align="center">
          <IconButton
            size="1"
            variant={listMode ? 'soft' : 'solid'}
            onClick={() => setListMode(false)}
            title="3-day view"
          >
            <Calendar />
          </IconButton>
          <IconButton
            size="1"
            variant={listMode ? 'solid' : 'soft'}
            onClick={() => setListMode(true)}
            title="List view"
          >
            <List />
          </IconButton>
          <RLink href={calendarHref}>
            <Flex align="center" gap="1">
              <Text>Open calendar</Text>
              <ArrowRight />
            </Flex>
          </RLink>
        </Flex>
      </Flex>

      {!listMode ? (
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridThreeDay"
          headerToolbar={false}
          views={{
            timeGridThreeDay: {
              type: 'timeGrid',
              duration: { days: 3 },
              buttonText: '3 days',
            },
          }}
          height="420px"
          timeZone="Europe/Oslo"
          locale={nbLocale}
          selectable
          selectMirror
          select={handleSelect}
          eventClick={handleEventClick}
          events={events}
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          eventDisplay="block"
        />
      ) : (
        <FullCalendar
          plugins={[listPlugin]}
          initialView="listWeek"
          headerToolbar={false}
          timeZone="Europe/Oslo"
          locale={nbLocale}
          events={events}
          height="auto"
          listDayFormat={{ weekday: 'short', day: '2-digit', month: 'short' }}
          listDaySideFormat={false}
          noEventsContent="No bookings"
          // limit to 5 rows visually; show "See more" under
        />
      )}

      {/* “See more” for list mode (client-side count) */}
      {listMode && (
        <SeeMoreFooter events={events} calendarHref={calendarHref} />
      )}
    </Box>
  )
}

function SeeMoreFooter({
  events,
  calendarHref,
}: {
  events: Array<EventInput>
  calendarHref: string
}) {
  // Very small heuristic: we can't read FullCalendar's internal list count easily,
  // so we just compare total events in the active week and show a link if > 5.
  const moreThanFive = events.length > 5
  if (!moreThanFive) return null
  return (
    <Flex justify="center" mt="2">
      <RLink href={calendarHref} target="_blank">
        <Flex align="center" gap="1">
          <Text>See more</Text>
          <ArrowRight />
        </Flex>
      </RLink>
    </Flex>
  )
}

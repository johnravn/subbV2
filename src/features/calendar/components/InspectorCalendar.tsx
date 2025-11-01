// src/features/calendar/InspectorCalendar.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Link as RLink,
  Text,
} from '@radix-ui/themes'
import { ArrowRight, Calendar, List } from 'iconoir-react'
import FullCalendar from '@fullcalendar/react'
import nbLocale from '@fullcalendar/core/locales/nb'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
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
  // Pagination props for list view
  hasMore?: boolean // whether there are more events to load
  onLoadNext?: () => void // callback to load next page
  showPagination?: boolean // whether to show pagination controls
}

type ListPeriod = 'day' | 'week' | 'month'

export default function InspectorCalendar({
  events,
  calendarHref,
  onCreate,
  onUpdate,
  onDelete,
  hasMore = false,
  onLoadNext,
  showPagination = false,
}: Props) {
  const [listMode, setListMode] = React.useState(false)
  const [listPeriod, setListPeriod] = React.useState<ListPeriod>('month')
  const calendarRef = React.useRef<any>(null)

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

  // Render event in list mode to show job name instead of time period name
  function renderListEvent(arg: EventContentArg) {
    const jobTitle = (arg.event.extendedProps as any)?.jobTitle as
      | string
      | undefined
    // Use job title if available, otherwise fall back to event title
    const displayTitle = jobTitle || arg.event.title || 'Event'
    return <span>{displayTitle}</span>
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
            type="button"
            size="1"
            variant={listMode ? 'soft' : 'solid'}
            onClick={() => setListMode(false)}
            title="3-day view"
          >
            <Calendar />
          </IconButton>
          <IconButton
            type="button"
            size="1"
            variant={listMode ? 'solid' : 'soft'}
            onClick={() => setListMode(true)}
            title="List view"
          >
            <List />
          </IconButton>
          {listMode && (
            <Flex gap="1" align="center" style={{ marginLeft: '8px' }}>
              <Button
                type="button"
                size="1"
                variant={listPeriod === 'day' ? 'solid' : 'soft'}
                onClick={() => {
                  setListPeriod('day')
                  calendarRef.current?.getApi()?.changeView('listDay')
                }}
              >
                Day
              </Button>
              <Button
                type="button"
                size="1"
                variant={listPeriod === 'week' ? 'solid' : 'soft'}
                onClick={() => {
                  setListPeriod('week')
                  calendarRef.current?.getApi()?.changeView('listWeek')
                }}
              >
                Week
              </Button>
              <Button
                type="button"
                size="1"
                variant={listPeriod === 'month' ? 'solid' : 'soft'}
                onClick={() => {
                  setListPeriod('month')
                  calendarRef.current?.getApi()?.changeView('listMonth')
                }}
              >
                Month
              </Button>
            </Flex>
          )}
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
          key="timegrid"
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
        <>
          <FullCalendar
            ref={calendarRef}
            key={`list-${listPeriod}`}
            plugins={[listPlugin]}
            initialView={
              listPeriod === 'day'
                ? 'listDay'
                : listPeriod === 'week'
                  ? 'listWeek'
                  : 'listMonth'
            }
            initialDate={new Date()}
            headerToolbar={false}
            timeZone="Europe/Oslo"
            locale={nbLocale}
            events={events}
            height="auto"
            eventContent={renderListEvent}
            // Removed validRange to allow viewing past reservations
            listDayFormat={{ weekday: 'short', day: '2-digit', month: 'short' }}
            listDaySideFormat={false}
            noEventsContent="No bookings"
          />
          {/* Pagination footer for list mode */}
          {showPagination && hasMore && onLoadNext && (
            <Flex justify="center" mt="2">
              <Button size="2" variant="soft" onClick={onLoadNext}>
                <Text>Next 5</Text>
                <ArrowRight />
              </Button>
            </Flex>
          )}
        </>
      )}
    </Box>
  )
}

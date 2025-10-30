// src/features/calendar/CompanyCalendarPro.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  IconButton,
  RadioGroup,
  Select,
  Separator,
  Switch,
  Text,
  TextField,
} from '@radix-ui/themes'
import FullCalendar from '@fullcalendar/react'
import '@shared/calendar/fullcalendar.radix.css'
import enLocale from '@fullcalendar/core/locales/en-gb'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, List } from 'iconoir-react'
import { applyCalendarFilter } from './domain'
import type { CalendarFilter, CalendarKind } from './domain'
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core'

type Props = {
  events: Array<EventInput>
  onCreate?: (e: {
    title: string
    start: string
    end?: string
    allDay: boolean
    context?: any
  }) => void
  onUpdate?: (id: string, patch: Partial<EventInput>) => void
  onDelete?: (id: string) => void
  defaultKinds?: Array<CalendarKind>
  // Optional: controlled filter from outside
  initialScope?: CalendarFilter['scope']
}

export default function CompanyCalendarPro({
  events,
  onCreate,
  onUpdate,
  onDelete,
  defaultKinds = ['job'],
  initialScope,
}: Props) {
  // UI state
  const [kinds, setKinds] = React.useState<Array<CalendarKind>>(defaultKinds)
  const [scopeKind, setScopeKind] = React.useState<'none' | CalendarKind>(
    'none',
  )
  const [scopeId, setScopeId] = React.useState<string>('')
  const [query, setQuery] = React.useState('')
  const [listMode, setListMode] = React.useState(false)

  // turn scopeKind + scopeId into a scope object
  const scope = React.useMemo(() => {
    if (initialScope) return initialScope
    if (scopeKind === 'none' || !scopeId) return undefined
    return {
      jobId: scopeKind === 'job' ? scopeId : undefined,
      itemId: scopeKind === 'item' ? scopeId : undefined,
      vehicleId: scopeKind === 'vehicle' ? scopeId : undefined,
      userId: scopeKind === 'crew' ? scopeId : undefined,
    }
  }, [initialScope, scopeKind, scopeId])

  const filtered = React.useMemo(
    () => applyCalendarFilter(events, { kinds, scope, text: query }),
    [events, kinds, scope, query],
  )

  function handleSelect(sel: DateSelectArg) {
    const title = window.prompt('New booking title?')
    if (!title) return
    onCreate?.({
      title,
      start: sel.startStr,
      end: sel.endStr,
      allDay: sel.allDay,
      context: { suggestedKind: kinds.length === 1 ? kinds[0] : undefined },
    })
  }

  function handleEventClick(arg: EventClickArg) {
    const { id, title } = arg.event
    const action = window.prompt('Edit title, or type "delete"', title || '')
    if (!action) return
    if (action.toLowerCase() === 'delete') onDelete?.(id)
    else onUpdate?.(id, { title: action })
  }

  // Small event UI (time · title · kind badge)
  function renderEvent(arg: EventContentArg) {
    const kind = (arg.event.extendedProps as any)?.kind as
      | CalendarKind
      | undefined
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {arg.timeText && (
          <span style={{ fontWeight: 600, fontSize: 12 }}>{arg.timeText}</span>
        )}
        <span
          style={{
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {arg.event.title}
        </span>
        {kind && (
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--accent-4)',
              color: 'var(--accent-11)',
              marginLeft: 'auto',
            }}
          >
            {kind}
          </span>
        )}
      </div>
    )
  }

  return (
    <Box
      className="companyCalendar"
      p="3"
      style={{ background: 'transparent' }}
    >
      {/* Controls */}
      <Flex align="center" wrap="wrap" gap="3" mb="2">
        {/* Kind filter */}
        <Flex align="center" gap="2">
          <Text weight="bold" size="2">
            Show:
          </Text>
          <ToggleKind
            label="Jobs"
            value="job"
            kinds={kinds}
            setKinds={setKinds}
          />
          <ToggleKind
            label="Items"
            value="item"
            kinds={kinds}
            setKinds={setKinds}
          />
          <ToggleKind
            label="Vehicles"
            value="vehicle"
            kinds={kinds}
            setKinds={setKinds}
          />
          <ToggleKind
            label="Crew"
            value="crew"
            kinds={kinds}
            setKinds={setKinds}
          />
        </Flex>

        <Separator orientation="vertical" />

        {/* Scope */}
        <Flex align="center" gap="2">
          <Text weight="bold" size="2">
            Scope:
          </Text>
          <Select.Root
            value={scopeKind}
            onValueChange={(v) => setScopeKind(v as any)}
          >
            <Select.Trigger placeholder="Scope kind" />
            <Select.Content>
              <Select.Item value="none">None</Select.Item>
              <Select.Item value="job">Job</Select.Item>
              <Select.Item value="item">Item</Select.Item>
              <Select.Item value="vehicle">Vehicle</Select.Item>
              <Select.Item value="crew">Crew</Select.Item>
            </Select.Content>
          </Select.Root>
          <TextField.Root
            placeholder="ID…"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          />
        </Flex>

        <Separator orientation="vertical" />

        {/* Search */}
        <TextField.Root
          placeholder="Search title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <Separator orientation="vertical" />

        {/* View toggle */}
        <Flex align="center" gap="2">
          <IconButton
            variant={listMode ? 'soft' : 'solid'}
            onClick={() => setListMode(false)}
            title="Calendar view"
          >
            <Calendar />
          </IconButton>
          <IconButton
            variant={listMode ? 'solid' : 'soft'}
            onClick={() => setListMode(true)}
            title="List view"
          >
            <List />
          </IconButton>
          <Text size="1" color="gray">
            Default shows Jobs this month
          </Text>
        </Flex>
      </Flex>

      {/* Calendar or List */}
      {!listMode ? (
        <FullCalendar
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
            interactionPlugin,
          ]}
          initialView="dayGridMonth"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          timeZone="Europe/Oslo"
          locale={enLocale}
          selectable
          selectMirror
          editable
          eventResizableFromStart
          eventDurationEditable
          eventStartEditable
          select={handleSelect}
          eventClick={handleEventClick}
          eventContent={renderEvent}
          events={filtered}
          height="auto"
          dayMaxEventRows
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          eventDisplay="block"
        />
      ) : (
        <FullCalendar
          plugins={[listPlugin]}
          initialView="listMonth"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'listDay,listWeek,listMonth',
          }}
          timeZone="Europe/Oslo"
          locale={enLocale}
          events={filtered}
          height="auto"
          noEventsContent="No bookings found"
        />
      )}

      {/* Optional create button for mobile-only flows */}
      <Flex justify="end" mt="2">
        <Button
          onClick={() => {
            const title = window.prompt('New booking title?')
            if (!title) return
            const start = new Date().toISOString().slice(0, 16)
            onCreate?.({ title, start, allDay: false })
          }}
        >
          Create booking
        </Button>
      </Flex>
    </Box>
  )
}

function ToggleKind({
  label,
  value,
  kinds,
  setKinds,
}: {
  label: string
  value: CalendarKind
  kinds: Array<CalendarKind>
  setKinds: React.Dispatch<React.SetStateAction<Array<CalendarKind>>>
}) {
  const checked = kinds.includes(value)
  return (
    <Flex align="center" gap="1">
      <Switch
        checked={checked}
        onCheckedChange={(c) =>
          setKinds((prev) =>
            c
              ? Array.from(new Set([...prev, value]))
              : prev.filter((k) => k !== value),
          )
        }
      />
      <Text size="2">{label}</Text>
    </Flex>
  )
}

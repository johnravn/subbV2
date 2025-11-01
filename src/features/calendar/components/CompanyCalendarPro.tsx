// src/features/calendar/CompanyCalendarPro.tsx
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  Flex,
  IconButton,
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
import { supabase } from '@shared/api/supabase'
import { applyCalendarFilter } from './domain'
import type { CalendarFilter, CalendarKind } from './domain'
import type { EventContentArg, EventInput } from '@fullcalendar/core'

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
  // Hide the create booking button
  hideCreateButton?: boolean
  // Control list mode externally
  initialListMode?: boolean
  onListModeChange?: (listMode: boolean) => void
}

export default function CompanyCalendarPro({
  events,
  onCreate,
  onUpdate,
  onDelete,
  defaultKinds = ['job'],
  initialScope,
  hideCreateButton = false,
  initialListMode = false,
  onListModeChange,
}: Props) {
  // UI state
  const [kinds, setKinds] = React.useState<Array<CalendarKind>>(defaultKinds)
  const [scopeKind, setScopeKind] = React.useState<'none' | CalendarKind>(
    'none',
  )
  const [scopeId, setScopeId] = React.useState<string>('')
  const [query, setQuery] = React.useState('')
  const [internalListMode, setInternalListMode] =
    React.useState(initialListMode)

  // Use external control if provided, otherwise use internal state
  const listMode =
    onListModeChange !== undefined ? initialListMode : internalListMode
  const setListMode = React.useCallback(
    (value: boolean) => {
      if (onListModeChange) {
        onListModeChange(value)
      } else {
        setInternalListMode(value)
      }
    },
    [onListModeChange],
  )

  // Sync internal state with external prop changes
  React.useEffect(() => {
    if (onListModeChange === undefined) {
      setInternalListMode(initialListMode)
    }
  }, [initialListMode, onListModeChange])

  // When hideCreateButton is true, sync kinds with defaultKinds since user can't control it
  React.useEffect(() => {
    if (hideCreateButton) {
      setKinds(defaultKinds)
    }
  }, [hideCreateButton, defaultKinds])

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

  const filtered = React.useMemo(() => {
    // When hideCreateButton is true, events are already filtered by parent
    // Only apply additional filters if controls are visible
    if (hideCreateButton) {
      return events
    }
    return applyCalendarFilter(events, { kinds, scope, text: query })
  }, [events, kinds, scope, query, hideCreateButton])

  // Removed handleSelect and handleEventClick - no prompts needed

  // Helper function for initials
  function getInitials(displayOrEmail: string | null): string {
    if (!displayOrEmail) return '?'
    const base = displayOrEmail.trim()
    const parts = base.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    if (base.includes('@')) return base[0].toUpperCase()
    return base.slice(0, 2).toUpperCase()
  }

  // Get colors for events based on category (from CalendarTab.tsx)
  function getRadixColorsForPeriod(
    title: string | null,
    category?: 'program' | 'equipment' | 'crew' | 'transport' | null,
  ): {
    bg: string
    border: string
    text: string
  } {
    const t = (title || '').toLowerCase()

    // Use Radix alpha tokens for less transparent backgrounds (a6 instead of a4)
    if (t.includes('job duration'))
      return {
        bg: 'var(--blue-a6)',
        border: 'var(--blue-a8)',
        text: 'var(--blue-12)',
      }
    if (category === 'equipment' || t.includes('equipment'))
      return {
        bg: 'var(--violet-a6)',
        border: 'var(--violet-a8)',
        text: 'var(--violet-12)',
      }
    if (category === 'crew' || t.includes('crew'))
      return {
        bg: 'var(--green-a6)',
        border: 'var(--green-a8)',
        text: 'var(--green-12)',
      }
    if (
      category === 'transport' ||
      t.includes('vehicle') ||
      t.includes('transport')
    )
      return {
        bg: 'var(--amber-a6)',
        border: 'var(--amber-a8)',
        text: 'var(--amber-12)',
      }
    if (category === 'program' || t.includes('show') || t.includes('event'))
      return {
        bg: 'var(--pink-a6)',
        border: 'var(--pink-a8)',
        text: 'var(--pink-12)',
      }
    if (t.includes('setup') || t.includes('load in'))
      return {
        bg: 'var(--cyan-a6)',
        border: 'var(--cyan-a8)',
        text: 'var(--cyan-12)',
      }
    if (t.includes('teardown') || t.includes('load out'))
      return {
        bg: 'var(--red-a6)',
        border: 'var(--red-a8)',
        text: 'var(--red-12)',
      }

    // Default (e.g., external owner equipment periods)
    return {
      bg: 'var(--indigo-a6)',
      border: 'var(--indigo-a8)',
      text: 'var(--indigo-12)',
    }
  }

  // Small event UI (time · title · kind badge · project lead)
  function renderEvent(arg: EventContentArg) {
    const kind = (arg.event.extendedProps as any)?.kind as
      | CalendarKind
      | undefined
    const projectLead = (arg.event.extendedProps as any)?.projectLead as
      | {
          user_id: string
          display_name: string | null
          email: string
          avatar_url: string | null
        }
      | null
      | undefined
    // Get avatar URL if available
    const avatarUrl = projectLead?.avatar_url
      ? supabase.storage.from('avatars').getPublicUrl(projectLead.avatar_url)
          .data.publicUrl
      : null

    const leadName = projectLead
      ? projectLead.display_name || projectLead.email
      : null

    const jobTitle = (arg.event.extendedProps as any)?.jobTitle as
      | string
      | undefined

    // Combine job title with event title
    const displayTitle = jobTitle
      ? `${jobTitle} - ${arg.event.title}`
      : arg.event.title

    return (
      <div
        style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}
      >
        {arg.timeText && (
          <span style={{ fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
            {arg.timeText}
          </span>
        )}
        <span
          style={{
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayTitle}
        </span>
        {projectLead && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <Avatar
              size="1"
              radius="full"
              src={avatarUrl ?? undefined}
              fallback={getInitials(leadName)}
              style={{ border: '1px solid var(--gray-a6)' }}
            />
            {leadName && (
              <span
                style={{
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 80,
                }}
              >
                {leadName}
              </span>
            )}
          </div>
        )}
        {kind && (
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--accent-4)',
              color: 'var(--accent-11)',
              flexShrink: 0,
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
      {/* Controls - only show if hideCreateButton is false (for backward compatibility) */}
      {!hideCreateButton && (
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
              type="button"
              variant={listMode ? 'soft' : 'solid'}
              onClick={() => setListMode(false)}
              title="Calendar view"
            >
              <Calendar />
            </IconButton>
            <IconButton
              type="button"
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
      )}

      {/* Calendar or List */}
      {!listMode ? (
        <FullCalendar
          key="calendar"
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
          selectable={false}
          editable={false}
          select={undefined}
          eventClick={undefined}
          eventContent={renderEvent}
          events={filtered.map((event) => {
            const category = (event.extendedProps as any)?.category
            const title = event.title || ''
            const colors = getRadixColorsForPeriod(title, category)
            return {
              ...event,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              textColor: colors.text,
            }
          })}
          height="auto"
          dayMaxEventRows
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          eventDisplay="block"
        />
      ) : (
        <FullCalendar
          key="list"
          plugins={[listPlugin]}
          initialView="listMonth"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'listDay,listWeek,listMonth',
          }}
          timeZone="Europe/Oslo"
          locale={enLocale}
          eventContent={renderEvent}
          events={filtered.map((event) => {
            const eventCategory = (event.extendedProps as any)?.category
            const title = event.title || ''
            const colors = getRadixColorsForPeriod(title, eventCategory)
            return {
              ...event,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              textColor: colors.text,
            }
          })}
          height="auto"
          noEventsContent="No bookings found"
        />
      )}

      {/* Optional create button for mobile-only flows */}
      {!hideCreateButton && (
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
      )}
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

// src/features/calendar/domain.ts
import type { EventInput } from '@fullcalendar/core'

/** What kinds of things can appear in the calendar */
export type CalendarKind = 'job' | 'item' | 'vehicle' | 'crew'

/** Common shape we can normalize DB records into before turning into FullCalendar EventInput */
export type CalendarRecord = {
  id: string
  title: string
  start: string // ISO
  end?: string | null // ISO
  allDay?: boolean
  kind: CalendarKind
  // Optional “who/what” the booking is for (used for filters)
  ref?: {
    jobId?: string
    itemId?: string
    vehicleId?: string
    userId?: string // crew
  }
  status?:
    | 'draft'
    | 'planned'
    | 'requested'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'canceled'
    | 'invoiced'
    | 'paid'
  notes?: string
  location?: string
  meta?: Record<string, unknown>
}

/** Convert our normalized records to FullCalendar EventInput[] */
export function toEventInputs(rows: Array<CalendarRecord>): Array<EventInput> {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    start: r.start,
    end: r.end ?? undefined,
    allDay: r.allDay,
    extendedProps: {
      kind: r.kind,
      ref: r.ref,
      status: r.status,
      notes: r.notes,
      location: r.location,
      ...r.meta,
    },
  }))
}

/** Basic client-side filtering */
export type CalendarFilter = {
  kinds?: Array<CalendarKind> // e.g. ['job'] or ['item', 'vehicle']
  scope?: {
    // limit to a specific entity
    jobId?: string
    itemId?: string
    vehicleId?: string
    userId?: string
  }
  text?: string // free search on title
}

export function applyCalendarFilter(
  events: Array<EventInput>,
  f: CalendarFilter | undefined,
) {
  if (!f) return events
  const kinds = f.kinds?.length ? new Set(f.kinds) : null
  const { jobId, itemId, vehicleId, userId } = f.scope ?? {}
  const q = f.text?.toLowerCase().trim()

  return events.filter((e) => {
    const xp = (e.extendedProps ?? {}) as any
    const okKind = kinds ? kinds.has(xp.kind) : true
    const okJob = jobId ? xp.ref?.jobId === jobId : true
    const okItem = itemId ? xp.ref?.itemId === itemId : true
    const okVeh = vehicleId ? xp.ref?.vehicleId === vehicleId : true
    const okUser = userId ? xp.ref?.userId === userId : true
    const okText = q ? (e.title?.toLowerCase().includes(q) ?? false) : true
    return okKind && okJob && okItem && okVeh && okUser && okText
  })
}

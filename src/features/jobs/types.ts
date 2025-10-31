// src/features/jobs/types.ts

export type UUID = string

/* ---------- Job core ---------- */

export type JobStatus =
  | 'draft'
  | 'planned'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'invoiced'
  | 'paid'

export type JobListRow = {
  id: UUID
  company_id: UUID
  title: string
  status: JobStatus
  start_at: string | null
  end_at: string | null
  customer?: {
    id: UUID
    name: string | null
  } | null
  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export type AddressListRow = {
  id: UUID
  company_id: UUID
  name: string | null
  address_line: string
  zip_code: string
  city: string
  country: string
  deleted: boolean
  is_personal: boolean
}

export type JobDetail = {
  id: UUID
  company_id: UUID
  title: string
  description: string | null
  status: JobStatus
  start_at: string | null
  end_at: string | null
  load_in_at: string | null
  load_out_at: string | null

  project_lead_user_id: UUID | null
  customer_id: UUID | null
  customer_contact_id: UUID | null
  job_address_id: UUID | null

  customer?: {
    id: UUID
    name: string | null
    email: string | null
    phone: string | null
    vat_number: string | null
  } | null

  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null

  customer_contact?: {
    user_id: UUID
    name: string | null
    email: string | null
    phone: string | null
    title: string | null
  } | null

  address?: {
    id: UUID
    name: string
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

/* ---------- Equipment tab ---------- */

export type ExternalReqStatus = 'planned' | 'requested' | 'confirmed'

export type ItemLite = {
  id: string
  name: string
  category_id?: string | null
  brand_id?: string | null
  model?: string | null
  total_quantity?: number | null
  active?: boolean
  internally_owned?: boolean
  external_owner_id?: string | null
  notes?: string | null

  // Joined relations (optional)
  category?: {
    id: string
    name: string
  } | null

  brand?: {
    id: string
    name: string
  } | null

  // Optional price info if joined in your query
  price?: number | null
}

/**
 * Supabase may type nested single relations as an array when the FK
 * isn't inferred. Allow both shapes so UI can normalize.
 */
export type ReservedItemRow = {
  id: UUID
  time_period_id: UUID
  item_id: UUID
  quantity: number
  source_group_id: UUID | null
  source_kind: 'direct' | 'group'
  external_status: ExternalReqStatus | null
  external_note: string | null
  forced: boolean
  start_at: string | null // line override (ISO) - nullable => inherits header
  end_at: string | null // line override (ISO)
  item:
    | { id: UUID; name: string; external_owner_id: UUID | null }
    | Array<{ id: UUID; name: string; external_owner_id: UUID | null }>
  source_group?:
    | {
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }
    | Array<{
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }>
    | null
}

export type TimePeriodStatus =
  | 'tentative'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'

export type TimePeriodLite = {
  id: UUID
  job_id: UUID | null
  company_id: UUID
  title: string | null
  start_at: string // ISO
  end_at: string // ISO
  category?: 'program' | 'equipment' | 'crew' | 'transport' | null
}

/* ---------- Crew tab ---------- */

export type CrewReqStatus = 'planned' | 'requested' | 'declined' | 'accepted'

export type ReservedCrewRow = {
  id: UUID
  time_period_id: UUID
  user_id: UUID
  notes: string | null
  status: CrewReqStatus
  start_at: string | null
  end_at: string | null
  user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
}

/* ---------- Transport tab ---------- */

export type ReservedVehicleRow = {
  id: UUID
  time_period_id: UUID
  vehicle_id: UUID
  external_status: ExternalReqStatus | null
  external_note: string | null
  vehicle?: {
    id: UUID
    name: string
    external_owner_id: UUID | null
  } | null
}

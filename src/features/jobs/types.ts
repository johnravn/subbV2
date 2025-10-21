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
  customer?: {
    id: UUID
    name: string | null
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
  id: UUID
  name: string
  external_owner_id: UUID | null
}

/**
 * Supabase may type nested single relations as an array when the FK
 * isn’t inferred. Allow both shapes so UI can normalize.
 */
export type ReservedItemRow = {
  id: UUID
  reservation_id: UUID
  item_id: UUID
  quantity: number
  source_group_id: UUID | null
  source_kind: 'direct' | 'group'
  external_status: ExternalReqStatus | null
  external_note: string | null
  forced: boolean | null
  item?: ItemLite | Array<ItemLite> | null
}

/* ---------- Crew tab ---------- */

export type CrewReqStatus = 'planned' | 'requested' | 'declined' | 'accepted'

export type ReservedCrewRow = {
  id: UUID
  reservation_id: UUID
  user_id: UUID
  assignment: string | null
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
  reservation_id: UUID
  vehicle_id: UUID
  external_status: ExternalReqStatus | null
  external_note: string | null
  vehicle?: {
    id: UUID
    name: string
    external_owner_id: UUID | null
  } | null
}

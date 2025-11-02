import { supabase } from '@shared/api/supabase'
import type {
  AddressListRow,
  JobDetail,
  JobListRow,
  TimePeriodLite,
} from '../types'

function escapeForPostgrestOr(value: string) {
  // PostgREST uses commas and parentheses to separate conditions.
  // Strip or space them out so user input can't break the expression.
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function jobsIndexQuery({
  companyId,
  search,
  selectedDate,
  customerId,
  status,
  sortBy = 'start_at',
  sortDir = 'desc',
}: {
  companyId: string
  search: string
  selectedDate?: string
  customerId?: string | null
  status?: string | null
  sortBy?: 'title' | 'start_at' | 'status' | 'customer_name'
  sortDir?: 'asc' | 'desc'
}) {
  return {
    queryKey: [
      'company',
      companyId,
      'jobs-index',
      search,
      selectedDate,
      customerId,
      status,
      sortBy,
      sortDir,
    ],
    queryFn: async (): Promise<Array<JobListRow>> => {
      let q = supabase
        .from('jobs')
        .select(
          `
          id, company_id, title, status, start_at, end_at,
          customer:customer_id ( id, name ),
          project_lead:project_lead_user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('company_id', companyId)

      // Server-side filters
      if (customerId) {
        q = q.eq('customer_id', customerId)
      }
      if (status) {
        q = q.eq('status', status)
      }

      // Note: We don't filter server-side when searching because we need to search
      // customer name (joined relation) which PostgREST doesn't support.
      // All filtering is done client-side to support title, customer, and date search.

      // Sorting
      if (sortBy === 'customer_name') {
        // For customer name, we need to sort by the joined relation
        // PostgREST doesn't support sorting by joined columns directly,
        // so we'll sort client-side or use a different approach
        q = q.order('start_at', { ascending: sortDir === 'asc' })
      } else {
        q = q.order(sortBy, { ascending: sortDir === 'asc' })
      }

      const { data, error } = await q
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      let results = (data || []) as unknown as Array<JobListRow>

      // Filter by selected date (jobs in progress on that date)
      if (selectedDate) {
        const selected = new Date(selectedDate)
        selected.setHours(0, 0, 0, 0)
        const selectedDateStr = selected.toISOString().split('T')[0]

        results = results.filter((job) => {
          if (!job.start_at) return false

          const startDate = new Date(job.start_at)
          startDate.setHours(0, 0, 0, 0)
          const startDateStr = startDate.toISOString().split('T')[0]

          // If no end_at, check if selected date >= start date
          const jobEndAt = job.end_at
          if (!jobEndAt) {
            return selectedDateStr >= startDateStr
          }

          const endDate = new Date(jobEndAt)
          endDate.setHours(0, 0, 0, 0)
          const endDateStr = endDate.toISOString().split('T')[0]

          // Job is in progress if selected date is between start and end (inclusive)
          return (
            selectedDateStr >= startDateStr && selectedDateStr <= endDateStr
          )
        })
      }

      // Client-side filtering across title, customer name, project lead name, and date
      // (PostgREST doesn't support filtering on joined columns like customer.name)
      if (search.trim()) {
        const searchLower = search.trim().toLowerCase()
        results = results.filter((job) => {
          const customerMatch =
            job.customer?.name?.toLowerCase().includes(searchLower) ?? false
          const titleMatch = job.title.toLowerCase().includes(searchLower)
          const dateMatch =
            job.start_at?.toLowerCase().includes(searchLower) ?? false
          const projectLeadMatch =
            job.project_lead?.display_name
              ?.toLowerCase()
              .includes(searchLower) ??
            job.project_lead?.email?.toLowerCase().includes(searchLower) ??
            false
          return customerMatch || titleMatch || dateMatch || projectLeadMatch
        })
      }

      // Client-side sort for customer_name
      if (sortBy === 'customer_name') {
        results = [...results].sort((a, b) => {
          const aName = a.customer?.name ?? ''
          const bName = b.customer?.name ?? ''
          const comparison = aName.localeCompare(bName)
          return sortDir === 'asc' ? comparison : -comparison
        })
      }

      return results
    },
    staleTime: 10_000,
  }
}

// Simple query to get customers for dropdown filter
export function customersForFilterQuery(companyId: string) {
  return {
    queryKey: ['company', companyId, 'customers-for-filter'] as const,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []) as Array<{ id: string; name: string }>
    },
    staleTime: 60_000,
  }
}

export function addressIndexQuery({
  companyId,
  search,
}: {
  companyId: string
  search: string
}) {
  return {
    queryKey: ['address', companyId, 'address-index', search],
    queryFn: async (): Promise<Array<AddressListRow>> => {
      let q = supabase
        .from('addresses')
        .select(
          `
            id, company_id, name, address_line, zip_code, city, country,
            created_at, updated_at, deleted, is_personal
          `,
        )
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(100)

      q = q.or('deleted.is.null,deleted.eq.false')

      if (search.trim()) {
        // 1) Escape LIKE wildcards that users may type
        const likeSafe = escapePgLike(search.trim())
        // 2) Escape PostgREST .or() separators and parens in the *filter string*
        const orSafe = escapeForPostgrestOr(likeSafe)

        // 3) Use % (Postgres wildcard), not *
        const orFilter = [
          `name.ilike.%${orSafe}%`,
          `address_line.ilike.%${orSafe}%`,
          `zip_code.ilike.%${orSafe}%`,
          `city.ilike.%${orSafe}%`,
          `country.ilike.%${orSafe}%`,
        ].join(',')

        q = q.or(orFilter)
      }

      const { data, error } = await q
      if (error) throw error
      return data as unknown as Array<AddressListRow>
    },
    staleTime: 10_000,
  }
}

/** Escape % and _ which are wildcards in LIKE/ILIKE */
function escapePgLike(input: string) {
  return input.replace(/[%_]/g, (m) => '\\' + m)
}

export function jobDetailQuery({ jobId }: { jobId: string }) {
  return {
    queryKey: ['jobs-detail', jobId],
    queryFn: async (): Promise<JobDetail | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id, company_id, title, description, status, start_at, end_at,
          project_lead_user_id, customer_id, customer_contact_id, job_address_id,
          customer:customer_id ( id, name, email, phone, vat_number ),
          project_lead:project_lead_user_id ( user_id, display_name, email ),
          customer_contact:customer_contact_id ( id, name, email, phone, title ),
          address:job_address_id ( id, name, address_line, zip_code, city, country )
        `,
        )
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as JobDetail | null
    },
  }
}

// Time Periods for a job
export function jobTimePeriodsQuery({ jobId }: { jobId: string }) {
  return {
    queryKey: ['jobs', jobId, 'time_periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_periods')
        .select('id, company_id, job_id, title, start_at, end_at, category')
        .eq('job_id', jobId)
        .order('start_at', { ascending: true })
      if (error) throw error
      return data as Array<TimePeriodLite>
    },
  }
}

// Create/update time period
export async function upsertTimePeriod(payload: {
  id?: string
  job_id: string
  company_id: string
  title: string
  start_at: string // ISO
  end_at: string // ISO
  category?: 'program' | 'equipment' | 'crew' | 'transport'
}) {
  if (payload.id) {
    const { error } = await supabase
      .from('time_periods')
      .update({
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        // Don't update category on edit (preserve existing)
      })
      .eq('id', payload.id)
    if (error) throw error
    return payload.id
  } else {
    const { data, error } = await supabase
      .from('time_periods')
      .insert({
        job_id: payload.job_id,
        company_id: payload.company_id,
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
        category: payload.category ?? 'program',
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }
}

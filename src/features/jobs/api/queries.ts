import { supabase } from '@shared/api/supabase'
import type {
  AddressListRow,
  JobDetail,
  JobListRow,
  JobStatus,
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
  status,
}: {
  companyId: string
  search: string
  status: JobStatus | 'all'
}) {
  return {
    queryKey: ['company', companyId, 'jobs-index', search, status],
    queryFn: async (): Promise<Array<JobListRow>> => {
      let q = supabase
        .from('jobs')
        .select(
          `
          id, company_id, title, status, start_at,
          customer:customer_id ( id, name )
        `,
        )
        .eq('company_id', companyId)
        .order('start_at', { ascending: false })
      if (search) q = q.ilike('title', `%${search}%`)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Array<JobListRow>
    },
    staleTime: 10_000,
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
        .select('id, company_id, job_id, title, start_at, end_at')
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
}) {
  if (payload.id) {
    const { error } = await supabase
      .from('time_periods')
      .update({
        title: payload.title,
        start_at: payload.start_at,
        end_at: payload.end_at,
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
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }
}

import { supabase } from '@shared/api/supabase'
import type { JobDetail, JobListRow, JobStatus } from '../types'

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
          customer:customer_id ( id, name, email, phone ),
          project_lead:project_lead_user_id ( user_id, display_name, email ),
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

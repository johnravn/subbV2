import { supabase } from '@shared/api/supabase'
import type {
  CreateMatterInput,
  CreateVoteInput,
  Matter,
  MatterMessage,
  MatterRecipient,
  MatterResponse,
} from '../types'

export function mattersIndexQuery(companyId: string) {
  return {
    queryKey: ['matters', 'index', companyId],
    queryFn: async (): Promise<Array<Matter>> => {
      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      // Get all matters where user is a recipient (with read status)
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)

      if (recError) throw recError

      // Get all matter IDs where user is recipient or creator
      const recipientMatterIds = new Set<string>(
        (recipientMatters || []).map((r) => r.matter_id as string),
      )

      // Track which matters are unread
      const unreadMatterIds = new Set<string>(
        (recipientMatters || [])
          .filter((r) => !r.viewed_at)
          .map((r) => r.matter_id as string),
      )

      // Now fetch matters that:
      // 1. Belong to the company
      // 2. User is either creator OR recipient
      let q = supabase
        .from('matters' as any)
        .select(
          `
          id,
          company_id,
          created_by_user_id,
          matter_type,
          title,
          content,
          job_id,
          time_period_id,
          is_anonymous,
          allow_custom_responses,
          created_at,
          updated_at,
          created_by:created_by_user_id ( user_id, display_name, email, avatar_url ),
          job:job_id ( id, title ),
          time_period:time_period_id ( id, title )
        `,
        )
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      const { data: allMatters, error } = await q
      if (error) throw error

      // Filter to only matters where user is creator or recipient
      const filteredMatters = (allMatters || []).filter(
        (m) => m.created_by_user_id === user.id || recipientMatterIds.has(m.id),
      )

      if (filteredMatters.length === 0) return []

      const matterIds = filteredMatters.map((m) => m.id)

      // Get recipient and response counts for these matters
      const [recipientsData, responsesData] = await Promise.all([
        supabase
          .from('matter_recipients' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
        supabase
          .from('matter_responses' as any)
          .select('matter_id')
          .in('matter_id', matterIds),
      ])

      if (recipientsData.error) throw recipientsData.error
      if (responsesData.error) throw responsesData.error

      const recipientCounts = new Map<string, number>()
      const responseCounts = new Map<string, number>()

      for (const r of recipientsData.data || []) {
        recipientCounts.set(
          r.matter_id as string,
          (recipientCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      for (const r of responsesData.data || []) {
        responseCounts.set(
          r.matter_id as string,
          (responseCounts.get(r.matter_id as string) || 0) + 1,
        )
      }

      return filteredMatters.map((m) => ({
        ...m,
        recipient_count: recipientCounts.get(m.id) || 0,
        response_count: responseCounts.get(m.id) || 0,
        // Matter is unread if user is a recipient and hasn't viewed it
        // Matters created by user are always considered "read"
        is_unread:
          m.created_by_user_id !== user.id && unreadMatterIds.has(m.id),
      })) as Array<Matter>
    },
  }
}

export function matterDetailQuery(matterId: string) {
  return {
    queryKey: ['matters', 'detail', matterId],
    queryFn: async (): Promise<Matter | null> => {
      const { data, error } = await supabase
        .from('matters' as any)
        .select(
          `
          id,
          company_id,
          created_by_user_id,
          matter_type,
          title,
          content,
          job_id,
          time_period_id,
          is_anonymous,
          allow_custom_responses,
          created_at,
          updated_at,
          created_by:created_by_user_id ( user_id, display_name, email, avatar_url ),
          job:job_id ( id, title ),
          time_period:time_period_id ( id, title )
        `,
        )
        .eq('id', matterId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      if (!data) return null

      // Get my response if logged in
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let myResponse: MatterResponse | null = null

      if (user) {
        const { data: responseData } = await supabase
          .from('matter_responses' as any)
          .select(
            `
            id,
            matter_id,
            user_id,
            response,
            created_at,
            updated_at,
            user:user_id ( user_id, display_name, email, avatar_url )
          `,
          )
          .eq('matter_id', matterId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (responseData) {
          myResponse = responseData as unknown as MatterResponse
        }
      }

      return {
        ...(data as any),
        my_response: myResponse,
      } as Matter
    },
  }
}

export function matterRecipientsQuery(matterId: string) {
  return {
    queryKey: ['matters', 'recipients', matterId],
    queryFn: async (): Promise<Array<MatterRecipient>> => {
      // Fetch recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('matter_recipients' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          status,
          viewed_at,
          responded_at,
          created_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (recipientsError) throw recipientsError

      // Fetch responses for this matter
      const { data: responsesData, error: responsesError } = await supabase
        .from('matter_responses' as any)
        .select('id, matter_id, user_id, response, created_at, updated_at')
        .eq('matter_id', matterId)

      if (responsesError) throw responsesError

      // Create a map of user_id -> response for quick lookup
      const responseMap = new Map<string, any>()
      if (responsesData) {
        for (const response of responsesData) {
          responseMap.set(response.user_id as string, {
            id: response.id,
            response: response.response,
            created_at: response.created_at,
            updated_at: response.updated_at,
          })
        }
      }

      // Merge responses with recipients
      const recipients = (recipientsData || []).map((r: any) => ({
        ...r,
        response: responseMap.get(r.user_id) || null,
      }))

      return recipients as unknown as Array<MatterRecipient>
    },
  }
}

export function matterResponsesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'responses', matterId],
    queryFn: async (): Promise<Array<MatterResponse>> => {
      const { data, error } = await supabase
        .from('matter_responses' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          response,
          created_at,
          updated_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as Array<MatterResponse>
    },
  }
}

export function matterMessagesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'messages', matterId],
    queryFn: async (): Promise<Array<MatterMessage>> => {
      const { data, error } = await supabase
        .from('matter_messages' as any)
        .select(
          `
          id,
          matter_id,
          user_id,
          content,
          created_at,
          updated_at,
          user:user_id ( user_id, display_name, email, avatar_url )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as unknown as Array<MatterMessage>
    },
  }
}

export async function createMatter(input: CreateMatterInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create the matter
  const { data: matter, error: matterError } = await supabase
    .from('matters' as any)
    .insert({
      company_id: input.company_id,
      created_by_user_id: user.id,
      matter_type: input.matter_type,
      title: input.title.trim(),
      content: input.content?.trim() || null,
      job_id: input.job_id || null,
      time_period_id: input.time_period_id || null,
      is_anonymous: input.is_anonymous ?? false,
      allow_custom_responses: input.allow_custom_responses ?? true,
    })
    .select('id')
    .single()

  if (matterError) throw matterError
  if (!matter) throw new Error('Failed to create matter')

  // Create recipients
  if (input.recipient_user_ids.length > 0) {
    const recipients = input.recipient_user_ids.map((userId) => ({
      matter_id: matter.id,
      user_id: userId,
      status: 'pending' as const,
    }))

    const { error: recipientsError } = await supabase
      .from('matter_recipients' as any)
      .insert(recipients)

    if (recipientsError) throw recipientsError
  }

  // Upload files if provided
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const timestamp = Date.now()
      const filename = `${timestamp}.${ext}`
      const path = `${matter.id}/${filename}`

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('matter_files')
        .upload(path, file, {
          upsert: false,
          cacheControl: '3600',
        })

      if (uploadErr) throw uploadErr

      // Insert file metadata
      const { error: fileErr } = await supabase
        .from('matter_files' as any)
        .insert({
          matter_id: matter.id,
          filename: file.name,
          path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by_user_id: user.id,
        })

      if (fileErr) throw fileErr
    }
  }

  return matter.id
}

export async function createVote(input: CreateVoteInput): Promise<string> {
  return createMatter({
    ...input,
    matter_type: 'vote',
    is_anonymous: input.is_anonymous ?? false,
    allow_custom_responses: input.allow_custom_responses ?? true,
    files: input.files,
  })
}

export async function sendCrewInvites(
  jobId: string,
  timePeriodId: string,
  companyId: string,
): Promise<string> {
  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  // Get time period info
  const { data: timePeriod, error: tpError } = await supabase
    .from('time_periods')
    .select('id, title, start_at, end_at')
    .eq('id', timePeriodId)
    .single()

  if (tpError) throw tpError

  // Get crew for this role that haven't been invited yet (status is 'planned')
  const { data: crew, error: crewError } = await supabase
    .from('reserved_crew')
    .select('user_id')
    .eq('time_period_id', timePeriodId)
    .eq('status', 'planned')

  if (crewError) throw crewError

  if (!crew || crew.length === 0) {
    throw new Error('No crew members to invite (add crew members first)')
  }

  const userIds = crew.map((c) => c.user_id as string)

  const roleTitle = timePeriod.title || 'Role'
  const startDate = timePeriod.start_at
    ? new Date(timePeriod.start_at as string).toLocaleDateString()
    : ''
  const endDate = timePeriod.end_at
    ? new Date(timePeriod.end_at as string).toLocaleDateString()
    : ''

  const title = `Crew invitation: ${roleTitle}`
  const content = `You have been invited to work on "${job.title}" as ${roleTitle}${startDate && endDate ? ` from ${startDate} to ${endDate}` : ''}.`

  // Create the matter
  const matterId = await createMatter({
    company_id: companyId,
    matter_type: 'crew_invite',
    title,
    content,
    job_id: jobId,
    time_period_id: timePeriodId,
    recipient_user_ids: userIds,
  })

  // Update reserved_crew status to 'requested'
  const { error: updateError } = await supabase
    .from('reserved_crew')
    .update({ status: 'requested' as const })
    .eq('time_period_id', timePeriodId)
    .eq('status', 'planned')
    .in('user_id', userIds)

  if (updateError) throw updateError

  return matterId
}

export async function respondToMatter(
  matterId: string,
  response: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmedResponse = response.trim().toLowerCase()

  // Upsert response
  const { error: responseError } = await supabase
    .from('matter_responses' as any)
    .upsert(
      {
        matter_id: matterId,
        user_id: user.id,
        response: response.trim(),
      },
      {
        onConflict: 'matter_id,user_id',
      },
    )

  if (responseError) throw responseError

  // Determine recipient status based on response
  // For votes: 'approved' -> 'accepted', 'rejected' -> 'declined', otherwise -> 'responded'
  let recipientStatus: 'accepted' | 'declined' | 'responded' = 'responded'
  if (trimmedResponse === 'approved') {
    recipientStatus = 'accepted'
  } else if (trimmedResponse === 'rejected') {
    recipientStatus = 'declined'
  }

  // Update recipient status
  const { data: updatedRecipients, error: recipientError } = await supabase
    .from('matter_recipients' as any)
    .update({
      status: recipientStatus as any,
      responded_at: new Date().toISOString(),
    })
    .eq('matter_id', matterId)
    .eq('user_id', user.id)
    .select()

  if (recipientError) throw recipientError

  // If no rows were updated, recipient might not exist - try to create it
  // This shouldn't normally happen, but handle gracefully
  if (!updatedRecipients || updatedRecipients.length === 0) {
    const { error: createError } = await supabase
      .from('matter_recipients' as any)
      .insert({
        matter_id: matterId,
        user_id: user.id,
        status: recipientStatus as any,
        responded_at: new Date().toISOString(),
      })

    if (createError) {
      // If creation also fails, throw the error
      throw new Error(
        `Failed to update recipient status: ${createError.message}`,
      )
    }
  }
}

export async function sendMessage(
  matterId: string,
  content: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('matter_messages' as any).insert({
    matter_id: matterId,
    user_id: user.id,
    content: content.trim(),
  })

  if (error) throw error
}

export async function markMatterAsViewed(matterId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('matter_recipients' as any)
    .update({
      status: 'viewed' as any,
      viewed_at: new Date().toISOString(),
    })
    .eq('matter_id', matterId)
    .eq('user_id', user.id)

  if (error) throw error
}

export function matterFilesQuery(matterId: string) {
  return {
    queryKey: ['matters', 'files', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matter_files' as any)
        .select(
          `
          id,
          matter_id,
          filename,
          path,
          mime_type,
          size_bytes,
          title,
          note,
          uploaded_by_user_id,
          created_at,
          uploaded_by:uploaded_by_user_id ( user_id, display_name, email )
        `,
        )
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as unknown as Array<import('../types').MatterFile>
    },
  }
}

export function unreadMattersCountQuery(companyId: string) {
  return {
    queryKey: ['matters', 'unread-count', companyId],
    queryFn: async (): Promise<number> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return 0

      // Get all matters where user is a recipient
      const { data: recipientMatters, error: recError } = await supabase
        .from('matter_recipients' as any)
        .select('matter_id, viewed_at')
        .eq('user_id', user.id)
        .is('viewed_at', null) // Only unread ones

      if (recError) throw recError

      // Get the matter IDs for unread matters
      const unreadMatterIds =
        recipientMatters?.map((r) => r.matter_id as string) || []

      if (unreadMatterIds.length === 0) return 0

      // Filter to only matters in the current company
      const { data: companyMatters, error: matterError } = await supabase
        .from('matters' as any)
        .select('id')
        .eq('company_id', companyId)
        .in('id', unreadMatterIds)

      if (matterError) throw matterError

      return companyMatters?.length || 0
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  }
}

export async function deleteMatter(matterId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify user is the creator
  const { data: matter, error: matterError } = await supabase
    .from('matters' as any)
    .select('created_by_user_id')
    .eq('id', matterId)
    .single()

  if (matterError) throw matterError
  if (!matter) throw new Error('Matter not found')
  if (matter.created_by_user_id !== user.id) {
    throw new Error('Only the creator can delete this matter')
  }

  // Get all files associated with this matter before deleting
  const { data: matterFiles, error: filesError } = await supabase
    .from('matter_files' as any)
    .select('path')
    .eq('matter_id', matterId)

  if (filesError) throw filesError

  // Delete files from storage if any exist
  if (matterFiles && matterFiles.length > 0) {
    const paths = matterFiles.map((f) => f.path)
    const { error: storageError } = await supabase.storage
      .from('matter_files')
      .remove(paths)

    if (storageError) throw storageError
  }

  // Delete the matter (cascade will handle related database records)
  const { error: deleteError } = await supabase
    .from('matters' as any)
    .delete()
    .eq('id', matterId)

  if (deleteError) throw deleteError
}

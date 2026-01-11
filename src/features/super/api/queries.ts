// src/features/super/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type UserIndexRow = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  created_at: string
}

export function usersIndexQuery() {
  return {
    queryKey: ['users', 'index'] as const,
    queryFn: async (): Promise<Array<UserIndexRow>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          created_at
        `,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      return data as Array<UserIndexRow>
    },
  }
}

export type UserDetail = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  bio: string | null
  locale: string | null
  timezone: string | null
  avatar_url: string | null
  created_at: string
  preferences: {
    date_of_birth?: string
    drivers_license?: string
    licenses?: Array<string>
    certificates?: Array<string>
    notes?: string
  } | null
  primary_address_id: string | null
  primary_address: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

export function userDetailQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'detail', userId] as const,
    queryFn: async (): Promise<UserDetail | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          bio,
          locale,
          timezone,
          avatar_url,
          created_at,
          preferences,
          primary_address_id,
          primary_address:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error

      if (!data) return null

      // Normalize the address relation
      const address =
        (Array.isArray((data as any).primary_address)
          ? (data as any).primary_address[0]
          : (data as any).primary_address) ?? null

      return {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        phone: data.phone ?? null,
        superuser: data.superuser,
        bio: data.bio ?? null,
        locale: data.locale ?? null,
        timezone: data.timezone ?? null,
        avatar_url: data.avatar_url ?? null,
        created_at: data.created_at,
        preferences: (data.preferences ?? null) as {
          date_of_birth?: string
          drivers_license?: string
          licenses?: Array<string>
          certificates?: Array<string>
          notes?: string
        } | null,
        primary_address_id: data.primary_address_id ?? null,
        primary_address: address,
      }
    },
  }
}

export type UserCompanyMembership = {
  company_id: string
  company_name: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
}

export function userCompanyMembershipsQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'companies', userId] as const,
    queryFn: async (): Promise<Array<UserCompanyMembership>> => {
      const { data, error } = await supabase
        .from('company_users')
        .select(
          `
          company_id,
          role,
          companies (
            id,
            name
          )
        `,
        )
        .eq('user_id', userId)

      if (error) throw error

      return data.map((row) => ({
        company_id: row.company_id,
        company_name: (row.companies as any).name,
        role: row.role,
      }))
    },
  }
}

// Get all users in a company with their roles
export type CompanyUserRow = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
  superuser: boolean
}

export function companyUsersQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['companies', companyId, 'users'] as const,
    queryFn: async (): Promise<Array<CompanyUserRow>> => {
      // Step 1: Get company_users for this company
      const { data: companyUsersData, error: cuError } = await supabase
        .from('company_users')
        .select('user_id, role')
        .eq('company_id', companyId)

      if (cuError) throw cuError

      if (!companyUsersData || companyUsersData.length === 0) return []

      // Step 2: Get profiles for all these user_ids
      const userIds = companyUsersData.map((cu) => cu.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(
          'user_id, email, display_name, first_name, last_name, superuser',
        )
        .in('user_id', userIds)

      if (profilesError) throw profilesError

      // Step 3: Combine the data
      const profilesMap = new Map(
        (profilesData ?? []).map((p) => [p.user_id, p]),
      )

      const result = companyUsersData
        .map((cu) => {
          const profile = profilesMap.get(cu.user_id)
          return {
            user_id: cu.user_id,
            email: profile?.email ?? '',
            display_name: profile?.display_name ?? null,
            first_name: profile?.first_name ?? null,
            last_name: profile?.last_name ?? null,
            role: cu.role,
            superuser: profile?.superuser ?? false,
          }
        })
        .filter((row) => row.email) // Filter out rows with no email (shouldn't happen, but safety)
        .sort((a, b) => {
          // Sort by role first, then by email
          if (a.role !== b.role) {
            return a.role.localeCompare(b.role)
          }
          return a.email.localeCompare(b.email)
        })

      return result
    },
  }
}

// Assign user to company with role (for superusers)
export async function assignUserToCompany({
  companyId,
  userId,
  role,
}: {
  companyId: string
  userId: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Use the existing RPC function
  const { data, error } = await supabase.rpc('set_company_user_role', {
    p_company_id: companyId,
    p_target_user_id: userId,
    p_new_role: role,
    p_actor_user_id: actorId,
  })
  if (error) throw error
  return data
}

// Remove user from company (for superusers)
export async function removeUserFromCompany({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  const { error } = await supabase
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * Generate dummy company with comprehensive test data for testing purposes.
 * Creates:
 * - Company with timestamp-based fake name
 * - 200 items with different categories, brands, and groups
 * - 8 item groups with items assigned
 * - 3 vehicles
 * - 4 customers with contacts
 * - 30 jobs spread across time (1 month back, 2 months forward)
 * - One job currently in_progress
 * - Addresses for jobs
 * - Time periods with reserved items
 *
 * Note: Crew members cannot be created programmatically without admin API.
 * The current user is added as owner and can serve as crew for testing.
 */
export async function createDummyCompany() {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const currentUserId = auth.user.id
  if (!currentUserId) throw new Error('Not authenticated')

  // Verify user is a superuser (required to create companies and company_users)
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('superuser')
    .eq('user_id', currentUserId)
    .maybeSingle()

  if (profileErr) throw profileErr
  if (!profile?.superuser) {
    throw new Error(
      'Only superusers can create dummy companies. Please ensure you are logged in as a superuser.',
    )
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const fakeName = `[DUMMY] Test Company ${timestamp}`

  // 1. Create company (superusers can insert companies)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: fakeName,
      general_email: `dummy-${timestamp}@test.com`,
      address: '123 Test Street, Test City, 12345, Test Country',
      vat_number: `TEST-VAT-${timestamp.slice(-8)}`,
    })
    .select('id')
    .single()

  if (companyError) throw companyError
  if (!company) throw new Error('Failed to create company')
  const companyId = company.id

  // 2. Add current user as owner FIRST (required for RLS policies on other tables)
  // Superusers can insert company_users via RLS policy
  const { error: companyUserError } = await supabase
    .from('company_users')
    .insert({
      company_id: companyId,
      user_id: currentUserId,
      role: 'owner',
    })

  if (companyUserError) {
    throw new Error(
      `Failed to add user as owner: ${companyUserError.message}. This may be an RLS policy issue.`,
    )
  }

  // 3. Create company_expansions (now that user is owner, RLS allows it via INSERT policy)
  const { error: expansionsError } = await supabase
    .from('company_expansions')
    .insert({
      company_id: companyId,
      accounting_api_read_only: false,
      latest_feed_open_to_freelancers: false,
      crew_rate_per_day: 2500,
      crew_rate_per_hour: 350,
      vehicle_daily_rate: 1500,
      vehicle_distance_rate: 5.5,
      fixed_rate_per_day: 0.8, // Must be between 0 and 1 (it's a multiplier/factor, not a rate)
      fixed_rate_start_day: 3,
    })

  if (expansionsError) throw expansionsError

  // 4. Create categories
  const categoryNames = [
    'Audio Equipment',
    'Video Equipment',
    'Lighting',
    'Power Distribution',
    'Cables & Connectors',
    'Staging',
    'Rigging',
    'Tools',
  ]
  const { data: categories } = await supabase
    .from('item_categories')
    .insert(
      categoryNames.map((name) => ({
        company_id: companyId,
        name,
      })),
    )
    .select('id, name')

  const categoryMap = new Map((categories || []).map((c) => [c.name, c.id]))

  // 5. Create brands
  // Note: item_brands has a global UNIQUE constraint on name, so we need unique names
  const baseBrandNames = ['BrandX', 'TechPro', 'PowerMax', 'Elite', 'Standard']
  const brandNames = baseBrandNames.map(
    (name) => `${name} ${timestamp.slice(-8)}`,
  )
  const { data: brands, error: brandsError } = await supabase
    .from('item_brands')
    .insert(
      brandNames.map((name) => ({
        company_id: companyId,
        name,
      })),
    )
    .select('id, name')

  if (brandsError) throw brandsError
  if (!brands || brands.length === 0) {
    throw new Error('Failed to create brands')
  }

  const brandMap = new Map(brands.map((b) => [b.name, b.id]))

  // 6. Create 200 items
  const itemNames = [
    'Microphone',
    'Speaker',
    'Mixer',
    'Amplifier',
    'Cable',
    'Stand',
    'Light Fixture',
    'LED Panel',
    'Power Strip',
    'Adapter',
    'Transmitter',
    'Receiver',
    'Monitor',
    'Dimmer',
    'Controller',
    'Lens',
    'Camera',
    'Tripod',
    'Battery',
    'Charger',
  ]

  const items: Array<{
    company_id: string
    name: string
    category_id: string | null
    brand_id: string | null
    model: string | null
    total_quantity: number
    active: boolean
    allow_individual_booking: boolean
    internally_owned: boolean
    external_owner_id: string | null
    notes: string | null
  }> = []

  for (let i = 0; i < 200; i++) {
    const baseName = itemNames[i % itemNames.length]
    const variant = Math.floor(i / itemNames.length)
    const name = variant > 0 ? `${baseName} ${variant + 1}` : baseName
    const categoryIndex = i % categoryNames.length
    const categoryName = categoryNames[categoryIndex]
    const brandIndex = i % brandNames.length
    const brandName = brandNames[brandIndex]

    // All items are internally owned for dummy data (simpler and avoids constraint issues)
    items.push({
      company_id: companyId,
      name: `${name} #${i + 1}`,
      category_id: categoryMap.get(categoryName) ?? null,
      brand_id: brandMap.get(brandName) ?? null,
      model: `Model-${(i % 10) + 1}`,
      total_quantity: Math.floor(Math.random() * 50) + 1,
      active: Math.random() > 0.1, // 90% active
      allow_individual_booking: Math.random() > 0.3,
      internally_owned: true,
      external_owner_id: null, // Must be null when internally_owned is true
      notes: i % 5 === 0 ? `Test item ${i + 1} notes` : null,
    })
  }

  const { data: createdItems, error: itemsError } = await supabase
    .from('items')
    .insert(items)
    .select('id, allow_individual_booking')

  if (itemsError) throw itemsError
  if (!createdItems || createdItems.length === 0) {
    throw new Error('Failed to create items')
  }

  const itemIds = createdItems.map((i) => i.id)
  // Track which items allow individual booking (needed for reserved_items)
  // Only items with allow_individual_booking = true can be reserved with source_kind = 'direct'
  const bookableItemIds = createdItems
    .filter((i) => i.allow_individual_booking === true)
    .map((i) => i.id)

  // Log for debugging
  if (bookableItemIds.length === 0) {
    console.warn(
      `Warning: No items allow individual booking. Created ${itemIds.length} items, but none can be reserved directly.`,
    )
  }

  // 7. Create item groups
  const groupNames = [
    'Basic Audio Setup',
    'Full Stage Package',
    'Lighting Rig',
    'Video Production Kit',
    'Complete Sound System',
    'Portable Setup',
    'Large Event Package',
    'Small Event Package',
  ]

  const { data: groups, error: groupsError } = await supabase
    .from('item_groups')
    .insert(
      groupNames.map((name, idx) => ({
        company_id: companyId,
        name,
        category_id:
          categories && idx < categories.length
            ? categories[idx].id
            : (categories?.[0]?.id ?? null),
        active: true,
        internally_owned: true,
        external_owner_id: null, // Must be null when internally_owned is true
        group_type: 'group' as const,
      })),
    )
    .select('id')

  if (groupsError) throw groupsError

  const groupIds = (groups || []).map((g) => g.id)

  // 8. Add items to groups (some items in some groups)
  if (itemIds.length > 0 && groupIds.length > 0) {
    const groupItems: Array<{
      group_id: string
      item_id: string
      quantity: number
    }> = []

    // Add 5-10 items to each group
    groupIds.forEach((groupId) => {
      const itemsPerGroup = Math.floor(Math.random() * 6) + 5
      const shuffled = [...itemIds].sort(() => Math.random() - 0.5)
      shuffled.slice(0, itemsPerGroup).forEach((itemId) => {
        groupItems.push({
          group_id: groupId,
          item_id: itemId,
          quantity: Math.floor(Math.random() * 3) + 1,
        })
      })
    })

    if (groupItems.length > 0) {
      await supabase.from('group_items').insert(groupItems)
    }
  }

  // 9. Create vehicles (3)
  const vehicleNames = ['Van A', 'Truck B', 'Car C']
  const vehicleCategories = ['van_medium', 'C1', 'passenger_car_small'] as const

  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .insert(
      vehicleNames.slice(0, 3).map((name, idx) => ({
        company_id: companyId,
        name,
        vehicle_category: vehicleCategories[idx], // Correct column name
        active: true,
        deleted: false,
        internally_owned: true,
        external_owner_id: null, // Must be null when internally_owned is true
      })),
    )
    .select('id')

  if (vehiclesError) throw vehiclesError

  const vehicleIds = (vehicles || []).map((v) => v.id)

  // 10. Create crew (2-3 users) - we need to create auth users first
  // For dummy data, we'll create profiles that reference existing users or create minimal ones
  // Since we can't create auth users programmatically without admin API,
  // we'll just create company_users for existing users or note that crew needs manual setup
  // For now, we'll skip actual crew user creation and just note it in the function

  // 11. Create customers with contacts
  const customerNames = [
    'Test Customer A',
    'Test Customer B',
    'Test Customer C',
    'Test Partner D',
  ]

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .insert(
      customerNames.map((name, idx) => ({
        company_id: companyId,
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '-')}@test.com`,
        phone: `+1234567890${idx}`,
        address: `${idx + 100} Customer Street, Test City`,
        is_partner: idx === 3,
        notes: `Dummy customer ${idx + 1}`,
      })),
    )
    .select('id, name')

  if (customersError) throw customersError

  const customerIds = (customers || []).map((c) => c.id)

  // Create contacts for customers
  let contactIds: Array<string> = []
  if (customerIds.length > 0 && customers) {
    const contacts: Array<{
      company_id: string
      customer_id: string
      name: string
      email: string | null
      phone: string | null
      title: string | null
    }> = []

    customerIds.forEach((customerId, idx) => {
      contacts.push({
        company_id: companyId,
        customer_id: customerId,
        name: `Contact Person ${idx + 1}`,
        email: `contact${idx + 1}@test.com`,
        phone: `+123456789${idx}`,
        title: ['Manager', 'Director', 'Coordinator', 'Lead'][idx] ?? null,
      })
    })

    const { data: createdContacts, error: contactsError } = await supabase
      .from('contacts')
      .insert(contacts)
      .select('id')

    if (contactsError) throw contactsError

    contactIds = (createdContacts || []).map((c) => c.id)
  }

  // 12. Create 30 jobs spread across time (1 month back, 2 months forward)
  const oneMonthAgo = new Date(now)
  oneMonthAgo.setMonth(now.getMonth() - 1)
  const twoMonthsForward = new Date(now)
  twoMonthsForward.setMonth(now.getMonth() + 2)

  type JobStatus =
    | 'draft'
    | 'planned'
    | 'requested'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'canceled'
    | 'invoiced'
    | 'paid'

  // Job statuses for future jobs (not used, kept for reference)
  // const jobStatuses: Array<JobStatus> = [
  //   'draft',
  //   'planned',
  //   'requested',
  //   'confirmed',
  //   'in_progress',
  //   'completed',
  // ]

  const jobs: Array<{
    company_id: string
    title: string
    status: JobStatus
    start_at: string
    end_at: string
    description: string | null
    customer_id: string | null
    customer_contact_id: string | null
    project_lead_user_id: string | null
  }> = []
  const timeRange = twoMonthsForward.getTime() - oneMonthAgo.getTime()

  // Create one job that's in_progress now
  const inProgressStart = new Date(now)
  inProgressStart.setHours(now.getHours() - 2)
  const inProgressEnd = new Date(now)
  inProgressEnd.setHours(now.getHours() + 6)

  jobs.push({
    company_id: companyId,
    title: `[IN PROGRESS] Current Job - ${timestamp}`,
    status: 'in_progress',
    start_at: inProgressStart.toISOString(),
    end_at: inProgressEnd.toISOString(),
    description: 'This is a job currently in progress for testing',
    customer_id: customerIds[0] ?? null,
    customer_contact_id: contactIds[0] ?? null,
    project_lead_user_id: currentUserId,
  })

  // Create 29 more jobs spread across the time range
  for (let i = 0; i < 29; i++) {
    const randomOffset = Math.random() * timeRange
    const jobStart = new Date(oneMonthAgo.getTime() + randomOffset)
    const jobDuration = (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000 // 1-6 days
    const jobEnd = new Date(jobStart.getTime() + jobDuration)

    // Determine status based on time
    let status: JobStatus
    if (jobEnd < now) {
      status = Math.random() > 0.9 ? 'canceled' : 'completed'
    } else if (jobStart > now) {
      const futureStatuses: Array<JobStatus> = [
        'draft',
        'planned',
        'requested',
        'confirmed',
      ]
      status = futureStatuses[Math.floor(Math.random() * 4)]
    } else {
      status = 'confirmed'
    }

    jobs.push({
      company_id: companyId,
      title: `Test Job ${i + 1} - ${jobStart.toISOString().split('T')[0]}`,
      status,
      start_at: jobStart.toISOString(),
      end_at: jobEnd.toISOString(),
      description: `Dummy job ${i + 1} for testing purposes`,
      customer_id:
        customerIds[Math.floor(Math.random() * customerIds.length)] ?? null,
      customer_contact_id:
        contactIds[Math.floor(Math.random() * contactIds.length)] ?? null,
      project_lead_user_id: currentUserId,
    })
  }

  const { data: createdJobs, error: jobsError } = await supabase
    .from('jobs')
    .insert(jobs)
    .select('id, start_at, end_at, status')

  if (jobsError) throw jobsError

  const jobIds = (createdJobs || []).map((j) => j.id)

  // 13. Create addresses for jobs
  if (jobIds.length > 0) {
    const addresses: Array<{
      company_id: string
      name: string
      address_line: string
      zip_code: string
      city: string
      country: string
      is_personal: boolean
    }> = []

    jobIds.forEach((_, idx) => {
      addresses.push({
        company_id: companyId,
        name: `Job Address ${idx + 1}`,
        address_line: `${100 + idx} Event Street`,
        zip_code: `${10000 + idx}`,
        city: 'Test City',
        country: 'Test Country',
        is_personal: false,
      })
    })

    const { data: createdAddresses, error: addressesError } = await supabase
      .from('addresses')
      .insert(addresses)
      .select('id')

    if (addressesError) throw addressesError

    const addressIds = (createdAddresses || []).map((a) => a.id)

    // Link addresses to jobs
    if (addressIds.length === jobIds.length) {
      await Promise.all(
        jobIds.map((jobId, idx) =>
          supabase
            .from('jobs')
            .update({ job_address_id: addressIds[idx] })
            .eq('id', jobId),
        ),
      )
    }
  }

  // 14. Create time periods for some jobs (equipment periods)
  // Only create time periods if we have bookable items (items that allow individual booking)
  if (jobIds.length > 0 && bookableItemIds.length > 0) {
    const timePeriods: Array<{
      company_id: string
      job_id: string
      title: string
      start_at: string
      end_at: string
      category: 'equipment' | 'crew' | 'transport' | 'program'
      notes: string | null
    }> = []

    // Create time periods for about half of the jobs
    const jobsWithPeriods = (createdJobs || []).slice(
      0,
      Math.floor(jobIds.length / 2),
    )

    jobsWithPeriods.forEach((job) => {
      // Only create time periods for jobs with valid start/end times
      if (job.start_at && job.end_at) {
        timePeriods.push({
          company_id: companyId,
          job_id: job.id,
          title: 'Equipment Period',
          start_at: job.start_at,
          end_at: job.end_at,
          category: 'equipment',
          notes: 'Test equipment time period',
        })
      }
    })

    if (timePeriods.length > 0) {
      const { data: createdPeriods } = await supabase
        .from('time_periods')
        .insert(timePeriods)
        .select('id, job_id')

      // Add some reserved items to time periods
      // Note: Only items with allow_individual_booking = true can be reserved with source_kind = 'direct'
      // (enforced by trg_reserved_items_enforce trigger)
      if (createdPeriods && bookableItemIds.length > 0) {
        const reservedItems: Array<{
          time_period_id: string
          item_id: string
          quantity: number
          source_kind: 'direct'
          forced: boolean
        }> = []

        createdPeriods.forEach((period) => {
          // Add 3-8 items to each period (but only bookable ones)
          const itemsCount = Math.min(
            Math.floor(Math.random() * 6) + 3,
            bookableItemIds.length,
          )
          const shuffled = [...bookableItemIds].sort(() => Math.random() - 0.5)
          shuffled.slice(0, itemsCount).forEach((itemId) => {
            reservedItems.push({
              time_period_id: period.id,
              item_id: itemId,
              quantity: Math.floor(Math.random() * 5) + 1,
              source_kind: 'direct',
              forced: false,
            })
          })
        })

        if (reservedItems.length > 0) {
          const { error: reservedItemsError } = await supabase
            .from('reserved_items')
            .insert(reservedItems)

          if (reservedItemsError) {
            throw new Error(
              `Failed to create reserved_items: ${reservedItemsError.message}. This may be due to items not allowing individual booking or time period validation issues.`,
            )
          }
        }
      }
    }
  }

  return {
    companyId,
    companyName: fakeName,
    itemsCreated: itemIds.length,
    groupsCreated: groupIds.length,
    vehiclesCreated: vehicleIds.length,
    customersCreated: customerIds.length,
    jobsCreated: jobIds.length,
  }
}

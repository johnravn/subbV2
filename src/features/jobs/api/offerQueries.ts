// src/features/jobs/api/offerQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type {
  JobOffer,
  OfferDetail,
  OfferAcceptance,
  OfferEquipmentGroup,
  OfferEquipmentItem,
  OfferCrewItem,
  OfferTransportItem,
  OfferPrettySection,
  OfferType,
  OfferStatus,
  PrettySectionType,
} from '../types'
import {
  calculateOfferTotals,
  generateSecureToken,
} from '../utils/offerCalculations'
import { exportOfferAsPDF } from '../utils/offerPdfExport'

// Query functions for offer management

/**
 * Get all offers for a job
 */
export function jobOffersQuery(jobId: string) {
  return queryOptions<Array<JobOffer>>({
    queryKey: ['job-offers', jobId] as const,
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Array<JobOffer>
    },
  })
}

/**
 * Get detailed offer with all items and groups
 */
export function offerDetailQuery(offerId: string) {
  return queryOptions<OfferDetail | null>({
    queryKey: ['offer-detail', offerId] as const,
    queryFn: async (): Promise<OfferDetail | null> => {
      // Fetch main offer
      const { data: offer, error: offerError } = await supabase
        .from('job_offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle()

      if (offerError) throw offerError
      if (!offer) return null

      // Fetch equipment groups
      const { data: groups, error: groupsError } = await supabase
        .from('offer_equipment_groups')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (groupsError) throw groupsError

      // Fetch equipment items for each group
      const groupsWithItems = await Promise.all(
        (groups || []).map(async (group: OfferEquipmentGroup) => {
          const { data: items, error: itemsError } = await supabase
            .from('offer_equipment_items')
            .select(
              `
              *,
              item:item_id (
                id,
                name,
                externally_owned,
                external_owner_id
              )
            `,
            )
            .eq('offer_group_id', group.id)
            .order('sort_order', { ascending: true })

          if (itemsError) throw itemsError

          return {
            ...group,
            items: (items || []) as Array<OfferEquipmentItem>,
          }
        }),
      )

      // Fetch crew items
      const { data: crewItems, error: crewError } = await supabase
        .from('offer_crew_items')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (crewError) throw crewError

      // Fetch transport items
      // Note: We fetch vehicles separately to avoid PostgREST relationship ambiguity
      // when multiple relationships exist for vehicle_id
      const { data: transportItemsRaw, error: transportError } = await supabase
        .from('offer_transport_items')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (transportError) throw transportError

      // Fetch vehicles separately if any transport items have vehicle_id
      const vehicleIds = (transportItemsRaw || [])
        .map((item: any) => item.vehicle_id)
        .filter((id): id is string => id !== null && id !== undefined)

      let vehicleMap = new Map<
        string,
        { id: string; name: string; external_owner_id: string | null }
      >()
      if (vehicleIds.length > 0) {
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, name, external_owner_id')
          .in('id', vehicleIds)

        if (vehiclesError) throw vehiclesError
        if (vehicles) {
          vehicles.forEach((v) => {
            vehicleMap.set(v.id, v)
          })
        }
      }

      // Combine transport items with vehicle data
      const transportItems = (transportItemsRaw || []).map((item: any) => ({
        ...item,
        vehicle: item.vehicle_id
          ? vehicleMap.get(item.vehicle_id) || null
          : null,
      }))

      // Fetch pretty sections (if this is a pretty offer)
      let prettySections: Array<OfferPrettySection> | undefined
      if (offer.offer_type === 'pretty') {
        const { data: sections, error: sectionsError } = await supabase
          .from('offer_pretty_sections')
          .select('*')
          .eq('offer_id', offerId)
          .order('sort_order', { ascending: true })

        if (sectionsError) throw sectionsError
        prettySections = (sections || []) as Array<OfferPrettySection>
      }

      return {
        ...offer,
        groups: groupsWithItems,
        crew_items: (crewItems || []) as Array<OfferCrewItem>,
        transport_items: (transportItems || []) as Array<OfferTransportItem>,
        pretty_sections: prettySections,
      } as OfferDetail
    },
  })
}

/**
 * Public access to offer via access token
 */
export function publicOfferQuery(accessToken: string) {
  return queryOptions<OfferDetail | null>({
    queryKey: ['public-offer', accessToken] as const,
    queryFn: async (): Promise<OfferDetail | null> => {
      // Fetch main offer
      const { data: offer, error: offerError } = await supabase
        .from('job_offers')
        .select('*')
        .eq('access_token', accessToken)
        .maybeSingle()

      if (offerError) throw offerError
      if (!offer || offer.status === 'draft') return null

      // Use detail query to fetch all related data
      const { data: offerDetail } = await supabase
        .from('job_offers')
        .select(
          `
          *,
          groups:offer_equipment_groups (
            *,
            items:offer_equipment_items (
              *,
              item:item_id (
                id,
                name,
                externally_owned,
                external_owner_id
              )
            )
          ),
          crew_items:offer_crew_items (*),
          transport_items:offer_transport_items (
            *,
            vehicle:vehicle_id (
              id,
              name,
              external_owner_id
            )
          ),
          pretty_sections:offer_pretty_sections (*)
        `,
        )
        .eq('access_token', accessToken)
        .maybeSingle()

      if (offerError) throw offerError
      if (!offerDetail) return null

      return offerDetail as OfferDetail
    },
  })
}

/**
 * Create a new offer
 */
export async function createOffer(payload: {
  jobId: string
  companyId: string
  offerType: OfferType
  title: string
  daysOfUse: number
  discountPercent: number
  vatPercent: number
  basedOnOfferId?: string | null
}): Promise<string> {
  // Generate access token
  const accessToken = generateSecureToken()

  // Get next version number for this job
  const { data: existingOffers } = await supabase
    .from('job_offers')
    .select('version_number')
    .eq('job_id', payload.jobId)
    .order('version_number', { ascending: false })
    .limit(1)

  const versionNumber =
    existingOffers && existingOffers.length > 0
      ? existingOffers[0].version_number + 1
      : 1

  const { data, error } = await supabase
    .from('job_offers')
    .insert({
      job_id: payload.jobId,
      company_id: payload.companyId,
      offer_type: payload.offerType,
      version_number: versionNumber,
      status: 'draft',
      access_token: accessToken,
      title: payload.title,
      days_of_use: payload.daysOfUse,
      discount_percent: payload.discountPercent,
      vat_percent: payload.vatPercent,
      based_on_offer_id: payload.basedOnOfferId || null,
      locked: false,
      equipment_subtotal: 0,
      crew_subtotal: 0,
      transport_subtotal: 0,
      total_before_discount: 0,
      total_after_discount: 0,
      total_with_vat: 0,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

/**
 * Update offer totals based on items
 */
export async function recalculateOfferTotals(offerId: string): Promise<void> {
  // Retry logic: sometimes after inserting items, there's a brief delay
  // before they're available in queries
  let offer: OfferDetail | null = null
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      offer = await offerDetailQuery(offerId).queryFn()
      if (offer) break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // If it's not the last attempt, wait a bit before retrying
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
      }
    }
  }

  if (!offer) {
    const errorMsg = lastError?.message || 'Offer not found'
    throw new Error(`Failed to fetch offer for recalculation: ${errorMsg}`)
  }

  const equipmentItems =
    offer.groups?.flatMap((g) =>
      (g.items || []).map((item: OfferEquipmentItem) => ({
        ...item,
        total_price: item.unit_price * item.quantity,
      })),
    ) || []

  const crewItems = offer.crew_items || []
  const transportItems = offer.transport_items || []

  const totals = calculateOfferTotals(
    equipmentItems,
    crewItems,
    transportItems,
    offer.days_of_use,
    offer.discount_percent,
    offer.vat_percent,
  )

  // Update offer with new totals
  const { error } = await supabase
    .from('job_offers')
    .update({
      equipment_subtotal: totals.equipmentSubtotal,
      crew_subtotal: totals.crewSubtotal,
      transport_subtotal: totals.transportSubtotal,
      total_before_discount: totals.totalBeforeDiscount,
      total_after_discount: totals.totalAfterDiscount,
      total_with_vat: totals.totalWithVAT,
    })
    .eq('id', offerId)

  if (error) throw error
}

/**
 * Lock an offer (prevents further editing)
 */
export async function lockOffer(offerId: string): Promise<void> {
  const { error } = await supabase
    .from('job_offers')
    .update({
      locked: true,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', offerId)

  if (error) throw error
}

/**
 * Accept an offer (public access)
 */
export async function acceptOffer(
  accessToken: string,
  acceptance: OfferAcceptance,
): Promise<void> {
  const { error } = await supabase
    .from('job_offers')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name: acceptance.name,
      accepted_by_email: acceptance.email,
      accepted_by_phone: acceptance.phone,
    })
    .eq('access_token', accessToken)
    .eq('status', 'sent')

  if (error) throw error
}

/**
 * Mark offer as viewed
 */
export async function markOfferViewed(accessToken: string): Promise<void> {
  const { error } = await supabase
    .from('job_offers')
    .update({
      viewed_at: new Date().toISOString(),
    })
    .eq('access_token', accessToken)

  // Don't throw if update fails (view tracking is optional)
  if (error) console.error('Failed to mark offer as viewed:', error)
}

/**
 * Duplicate an offer (for revisions)
 */
export async function duplicateOffer(offerId: string): Promise<string> {
  const { data: offer } = await offerDetailQuery(offerId).queryFn()

  if (!offer) throw new Error('Offer not found')

  // Create new offer
  const newOfferId = await createOffer({
    jobId: offer.job_id,
    companyId: offer.company_id,
    offerType: offer.offer_type,
    title: `${offer.title} (Copy)`,
    daysOfUse: offer.days_of_use,
    discountPercent: offer.discount_percent,
    vatPercent: offer.vat_percent,
    basedOnOfferId: offer.based_on_offer_id,
  })

  // Copy equipment groups and items
  if (offer.groups) {
    for (const group of offer.groups) {
      const { data: newGroup, error: groupError } = await supabase
        .from('offer_equipment_groups')
        .insert({
          offer_id: newOfferId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupError) throw groupError

      if (group.items && group.items.length > 0) {
        const itemsToInsert = group.items.map((item) => ({
          offer_group_id: newGroup.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
        }))

        const { error: itemsError } = await supabase
          .from('offer_equipment_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }
    }
  }

  // Copy crew items
  if (offer.crew_items && offer.crew_items.length > 0) {
    const crewItemsToInsert = offer.crew_items.map((item) => ({
      offer_id: newOfferId,
      role_title: item.role_title,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: item.total_price,
      sort_order: item.sort_order,
    }))

    const { error: crewError } = await supabase
      .from('offer_crew_items')
      .insert(crewItemsToInsert)

    if (crewError) throw crewError
  }

  // Copy transport items
  if (offer.transport_items && offer.transport_items.length > 0) {
    const transportItemsToInsert = offer.transport_items.map((item) => ({
      offer_id: newOfferId,
      vehicle_name: item.vehicle_name,
      vehicle_id: item.vehicle_id,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: item.total_price,
      is_internal: item.is_internal,
      sort_order: item.sort_order,
    }))

    const { error: transportError } = await supabase
      .from('offer_transport_items')
      .insert(transportItemsToInsert)

    if (transportError) throw transportError
  }

  // Copy pretty sections
  if (offer.pretty_sections && offer.pretty_sections.length > 0) {
    const sectionsToInsert = offer.pretty_sections.map((section) => ({
      offer_id: newOfferId,
      section_type: section.section_type,
      title: section.title,
      content: section.content,
      image_url: section.image_url,
      sort_order: section.sort_order,
    }))

    const { error: sectionsError } = await supabase
      .from('offer_pretty_sections')
      .insert(sectionsToInsert)

    if (sectionsError) throw sectionsError
  }

  // Recalculate totals
  await recalculateOfferTotals(newOfferId)

  return newOfferId
}

/**
 * Delete an offer
 */
export async function deleteOffer(offerId: string): Promise<void> {
  const { error } = await supabase.from('job_offers').delete().eq('id', offerId)

  if (error) throw error
}

/**
 * Update offer status
 */
export async function updateOfferStatus(
  offerId: string,
  status: OfferStatus,
): Promise<void> {
  const updateData: any = { status }

  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('job_offers')
    .update(updateData)
    .eq('id', offerId)

  if (error) throw error
}

/**
 * Create bookings from an accepted offer
 * This creates time_periods, reserved_items, reserved_crew, and reserved_vehicles
 * based on the offer's equipment, crew, and transport items.
 */
export async function createBookingsFromOffer(
  offerId: string,
  userId: string,
): Promise<void> {
  // Fetch the offer with all details
  const offer = await offerDetailQuery(offerId).queryFn()
  if (!offer) throw new Error('Offer not found')

  // Get job info for default dates
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, start_at, end_at, company_id')
    .eq('id', offer.job_id)
    .single()

  if (jobError) throw jobError
  if (!job) throw new Error('Job not found')

  const companyId = job.company_id
  const defaultStart = job.start_at || new Date().toISOString()
  const defaultEnd = job.end_at || new Date().toISOString()

  // Helper to create or find time period
  const getOrCreateTimePeriod = async (
    title: string,
    category: 'equipment' | 'crew' | 'transport',
    startAt: string,
    endAt: string,
  ): Promise<string> => {
    // Check if time period already exists
    const { data: existing } = await supabase
      .from('time_periods')
      .select('id')
      .eq('job_id', offer.job_id)
      .eq('title', title)
      .eq('category', category)
      .maybeSingle()

    if (existing) return existing.id

    // Create new time period
    const { data: newPeriod, error: periodError } = await supabase
      .from('time_periods')
      .insert({
        job_id: offer.job_id,
        company_id: companyId,
        title,
        category,
        start_at: startAt,
        end_at: endAt,
        reserved_by_user_id: userId,
        deleted: false,
      })
      .select('id')
      .single()

    if (periodError) throw periodError
    return newPeriod.id
  }

  // 1. Create equipment bookings
  if (offer.groups && offer.groups.length > 0) {
    // Group equipment by external owner for time periods
    const equipmentByOwner = new Map<
      string | null,
      {
        ownerName: string
        items: Array<{
          item_id: string | null
          quantity: number
          is_internal: boolean
        }>
      }
    >()

    for (const group of offer.groups) {
      for (const item of group.items) {
        const ownerId = item.item?.external_owner_id || null
        const ownerName = ownerId
          ? `External Owner ${ownerId}` // We'll need to fetch actual owner name
          : 'Internal Equipment'

        if (!equipmentByOwner.has(ownerId)) {
          equipmentByOwner.set(ownerId, {
            ownerName,
            items: [],
          })
        }

        equipmentByOwner.get(ownerId)!.items.push({
          item_id: item.item_id,
          quantity: item.quantity,
          is_internal: item.is_internal,
        })
      }
    }

    // Fetch external owner names
    const externalOwnerIds = Array.from(equipmentByOwner.keys()).filter(
      (id): id is string => id !== null,
    )
    if (externalOwnerIds.length > 0) {
      const { data: owners } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', externalOwnerIds)

      if (owners) {
        for (const owner of owners) {
          const data = equipmentByOwner.get(owner.id)
          if (data) {
            data.ownerName = owner.name || `Customer ${owner.id}`
          }
        }
      }
    }

    // Create time periods and reserved items for each owner
    for (const [ownerId, data] of equipmentByOwner.entries()) {
      const timePeriodId = await getOrCreateTimePeriod(
        `${data.ownerName} Equipment period`,
        'equipment',
        defaultStart,
        defaultEnd,
      )

      // Create reserved items
      const reservedItems = data.items
        .filter((item) => item.item_id !== null)
        .map((item) => ({
          time_period_id: timePeriodId,
          item_id: item.item_id!,
          quantity: item.quantity,
          source_kind: 'direct' as const,
          source_group_id: null,
          forced: false,
          start_at: null,
          end_at: null,
          external_status: item.is_internal ? null : ('planned' as const),
          external_note: null,
        }))

      if (reservedItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('reserved_items')
          .insert(reservedItems)

        if (itemsError) throw itemsError
      }
    }
  }

  // 2. Create crew bookings
  if (offer.crew_items && offer.crew_items.length > 0) {
    // Group crew items by date range
    const crewByRange = new Map<string, Array<OfferCrewItem>>()

    for (const crewItem of offer.crew_items) {
      const rangeKey = `${crewItem.start_date}-${crewItem.end_date}`
      if (!crewByRange.has(rangeKey)) {
        crewByRange.set(rangeKey, [])
      }
      crewByRange.get(rangeKey)!.push(crewItem)
    }

    // Create time periods for each unique date range
    for (const [rangeKey, crewItems] of crewByRange.entries()) {
      const firstItem = crewItems[0]
      const timePeriodId = await getOrCreateTimePeriod(
        `Crew period - ${crewItems.map((c) => c.role_title).join(', ')}`,
        'crew',
        firstItem.start_date,
        firstItem.end_date,
      )

      // Note: Crew items only have role_title, not user_id
      // We can't automatically assign users, so we'll create time periods with needed_count
      // and let users manually assign crew members later
      const { error: updateError } = await supabase
        .from('time_periods')
        .update({
          needed_count: crewItems.reduce(
            (sum, item) => sum + item.crew_count,
            0,
          ),
          role_category: crewItems.map((c) => c.role_title).join(', '),
        })
        .eq('id', timePeriodId)

      if (updateError) throw updateError
    }
  }

  // 3. Create transport bookings
  if (offer.transport_items && offer.transport_items.length > 0) {
    // Group transport items by date range and external owner
    const transportByRange = new Map<
      string,
      Array<{
        vehicle_id: string | null
        vehicle_name: string
        start_date: string
        end_date: string
        is_internal: boolean
      }>
    >()

    for (const transportItem of offer.transport_items) {
      const rangeKey = `${transportItem.start_date}-${transportItem.end_date}`
      if (!transportByRange.has(rangeKey)) {
        transportByRange.set(rangeKey, [])
      }
      transportByRange.get(rangeKey)!.push({
        vehicle_id: transportItem.vehicle_id,
        vehicle_name: transportItem.vehicle_name,
        start_date: transportItem.start_date,
        end_date: transportItem.end_date,
        is_internal: transportItem.is_internal,
      })
    }

    // Create time periods and reserved vehicles
    for (const [rangeKey, transportItems] of transportByRange.entries()) {
      const firstItem = transportItems[0]
      const timePeriodId = await getOrCreateTimePeriod(
        `Transport period - ${transportItems
          .map((t) => t.vehicle_name)
          .join(', ')}`,
        'transport',
        firstItem.start_date,
        firstItem.end_date,
      )

      // Create reserved vehicles
      const reservedVehicles = transportItems
        .filter((item) => item.vehicle_id !== null)
        .map((item) => ({
          time_period_id: timePeriodId,
          vehicle_id: item.vehicle_id!,
          start_at: null,
          end_at: null,
          external_status: item.is_internal ? null : ('planned' as const),
          external_note: null,
        }))

      if (reservedVehicles.length > 0) {
        const { error: vehiclesError } = await supabase
          .from('reserved_vehicles')
          .insert(reservedVehicles)

        if (vehiclesError) throw vehiclesError
      }
    }
  }
}

/**
 * Export offer as PDF
 */
export async function exportOfferPDF(offerId: string): Promise<void> {
  const offer = await offerDetailQuery(offerId).queryFn()
  if (!offer) throw new Error('Offer not found')
  await exportOfferAsPDF(offer)
}

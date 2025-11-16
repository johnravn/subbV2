// src/features/jobs/api/offerQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import type {
  JobOffer,
  OfferDetail,
  OfferAcceptance,
  OfferRejection,
  OfferRevisionRequest,
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
      // Note: We fetch items separately to avoid PostgREST relationship ambiguity
      const groupsWithItems = await Promise.all(
        (groups || []).map(async (group: OfferEquipmentGroup) => {
          const { data: items, error: itemsError } = await supabase
            .from('offer_equipment_items')
            .select('*')
            .eq('offer_group_id', group.id)
            .order('sort_order', { ascending: true })

          if (itemsError) throw itemsError

          // Fetch item details separately
          const itemIds = (items || [])
            .map((item: any) => item.item_id)
            .filter((id): id is string => id !== null && id !== undefined)

          const itemMap = new Map<
            string,
            {
              id: string
              name: string
              internally_owned: boolean
              external_owner_id: string | null
              external_owner_name: string | null
            }
          >()

          if (itemIds.length > 0) {
            const { data: itemDetails, error: itemsDetailError } =
              await supabase
                .from('items')
                .select(
                  `
                id,
                name,
                internally_owned,
                external_owner_id,
                external_owner:customers!items_external_owner_id_fkey ( id, name )
              `,
                )
                .in('id', itemIds)

            if (itemsDetailError) throw itemsDetailError

            if (itemDetails) {
              itemDetails.forEach((item: any) => {
                itemMap.set(item.id, {
                  id: item.id,
                  name: item.name,
                  internally_owned: !!item.internally_owned,
                  external_owner_id: item.external_owner_id ?? null,
                  external_owner_name: item.external_owner?.name ?? null,
                })
              })
            }
          }

          // Combine items with their details
          const itemsWithDetails = (items || []).map((item: any) => ({
            ...item,
            item: item.item_id ? itemMap.get(item.item_id) || null : null,
          }))

          return {
            ...group,
            items: itemsWithDetails as Array<OfferEquipmentItem>,
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

      const vehicleMap = new Map<
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
      // Fetch main offer with job, customer, company, and project lead info
      const { data: offer, error: offerError } = await supabase
        .from('job_offers')
        .select(
          `
          *,
          job:jobs!job_offers_job_id_fkey (
            id,
            customer_id,
            customer_contact_id,
            project_lead_user_id,
            customer:customer_id (
              id,
              name,
              email,
              phone,
              address,
              logo_path
            ),
            customer_contact:contacts!jobs_customer_contact_id_fkey (
              id,
              name,
              phone,
              email
            ),
            project_lead:profiles!jobs_project_lead_user_id_fkey (
              user_id,
              display_name,
              email,
              phone
            )
          ),
          company:companies!job_offers_company_id_fkey (
            id,
            name,
            address,
            logo_light_path,
            logo_dark_path
          )
        `,
        )
        .eq('access_token', accessToken)
        .maybeSingle()

      if (offerError) throw offerError
      if (!offer || offer.status === 'draft') return null

      // Fetch groups and items separately to avoid PostgREST relationship ambiguity
      const { data: groups, error: groupsError } = await supabase
        .from('offer_equipment_groups')
        .select('*')
        .eq('offer_id', offer.id)
        .order('sort_order', { ascending: true })

      if (groupsError) throw groupsError

      // Fetch equipment items for each group
      const groupsWithItems = await Promise.all(
        (groups || []).map(async (group: any) => {
          const { data: items, error: itemsError } = await supabase
            .from('offer_equipment_items')
            .select('*')
            .eq('offer_group_id', group.id)
            .order('sort_order', { ascending: true })

          if (itemsError) throw itemsError
          return { ...group, items: items || [] }
        }),
      )

      // Fetch crew items
      const { data: crewItems, error: crewError } = await supabase
        .from('offer_crew_items')
        .select('*')
        .eq('offer_id', offer.id)
        .order('sort_order', { ascending: true })

      if (crewError) throw crewError

      // Fetch transport items
      const { data: transportItemsRaw, error: transportError } = await supabase
        .from('offer_transport_items')
        .select('*')
        .eq('offer_id', offer.id)
        .order('sort_order', { ascending: true })

      if (transportError) throw transportError

      // Fetch vehicles separately if any transport items have vehicle_id
      const vehicleIds = (transportItemsRaw || [])
        .map((item: any) => item.vehicle_id)
        .filter((id): id is string => id !== null && id !== undefined)

      const vehicleMap = new Map<
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
      let prettySections: Array<any> | undefined
      if (offer.offer_type === 'pretty') {
        const { data: sections, error: sectionsError } = await supabase
          .from('offer_pretty_sections')
          .select('*')
          .eq('offer_id', offer.id)
          .order('sort_order', { ascending: true })

        if (sectionsError) throw sectionsError
        prettySections = (sections || []) as Array<any>
      }

      const offerDetail: any = {
        ...offer,
        groups: groupsWithItems,
        crew_items: (crewItems || []) as Array<any>,
        transport_items: transportItems || [],
        pretty_sections: prettySections,
      }

      // Fetch item details separately to avoid PostgREST relationship ambiguity
      const allItemIds = new Set<string>()
      offerDetail.groups?.forEach((group: any) => {
        group.items?.forEach((item: any) => {
          if (item.item_id) allItemIds.add(item.item_id)
        })
      })

      const itemMap = new Map<
        string,
        {
          id: string
          name: string
          internally_owned: boolean
          external_owner_id: string | null
          external_owner_name: string | null
          brand?: { id: string; name: string } | null
          model?: string | null
        }
      >()

      if (allItemIds.size > 0) {
        const { data: itemDetails, error: itemsDetailError } = await supabase
          .from('items')
          .select(
            `
            id,
            name,
            internally_owned,
            external_owner_id,
            model,
            external_owner:customers!items_external_owner_id_fkey ( id, name ),
            brand:item_brands ( id, name )
          `,
          )
          .in('id', Array.from(allItemIds))

        if (itemsDetailError) throw itemsDetailError

        if (itemDetails) {
          itemDetails.forEach((item: any) => {
            const brand = Array.isArray(item.brand) ? item.brand[0] : item.brand
            itemMap.set(item.id, {
              id: item.id,
              name: item.name,
              internally_owned: !!item.internally_owned,
              external_owner_id: item.external_owner_id ?? null,
              external_owner_name: item.external_owner?.name ?? null,
              brand: brand || null,
              model: item.model || null,
            })
          })
        }
      }

      // Attach item details to each equipment item
      offerDetail.groups?.forEach((group: any) => {
        if (group.items) {
          group.items = group.items.map((item: any) => ({
            ...item,
            item: item.item_id ? itemMap.get(item.item_id) || null : null,
          }))
        }
      })

      // Fetch company terms and conditions
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(
          'terms_and_conditions_type, terms_and_conditions_text, terms_and_conditions_pdf_path',
        )
        .eq('id', offer.company_id)
        .maybeSingle()

      if (companyError) {
        console.error('Failed to fetch company terms:', companyError)
        // Don't fail the whole query if company terms can't be fetched
      }

      // Add company terms to offer detail
      if (company) {
        offerDetail.company_terms = {
          type: company.terms_and_conditions_type as 'pdf' | 'text' | null,
          text: company.terms_and_conditions_text,
          pdf_path: company.terms_and_conditions_pdf_path,
        }
      }

      // Add customer info from job
      const job = offer.job
      if (job) {
        const customer = Array.isArray(job.customer)
          ? job.customer[0]
          : job.customer
        if (customer) {
          offerDetail.customer = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            logo_path: customer.logo_path,
          }
        }

        // Add customer contact
        const customerContact = Array.isArray(job.customer_contact)
          ? job.customer_contact[0]
          : job.customer_contact
        if (customerContact) {
          offerDetail.customer_contact = {
            id: customerContact.id,
            name: customerContact.name,
            phone: customerContact.phone,
            email: customerContact.email,
          }
        }

        // Add project lead
        const projectLead = Array.isArray(job.project_lead)
          ? job.project_lead[0]
          : job.project_lead
        if (projectLead) {
          offerDetail.project_lead = {
            user_id: projectLead.user_id,
            display_name: projectLead.display_name,
            email: projectLead.email,
            phone: projectLead.phone,
          }
        }
      }

      // Add company info
      const offerCompany = offer.company
      if (offerCompany) {
        const companyData = Array.isArray(offerCompany)
          ? offerCompany[0]
          : offerCompany
        if (companyData) {
          offerDetail.company = {
            id: companyData.id,
            name: companyData.name,
            address: companyData.address,
            logo_light_path: companyData.logo_light_path ?? null,
            logo_dark_path: companyData.logo_dark_path ?? null,
          }
        }
      }

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
  showPricePerLine?: boolean
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
      show_price_per_line: payload.showPricePerLine ?? true,
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

  // Fetch company expansion to get vehicle rates
  let vehicleDistanceRate: number | null = null
  let vehicleDistanceIncrement: number | null = null
  if (offer.company_id) {
    const { data: expansion } = await supabase
      .from('company_expansions')
      .select('vehicle_distance_rate, vehicle_distance_increment')
      .eq('company_id', offer.company_id)
      .maybeSingle()
    if (expansion) {
      vehicleDistanceRate = expansion.vehicle_distance_rate
      vehicleDistanceIncrement = expansion.vehicle_distance_increment ?? 150
    }
  }

  const totals = calculateOfferTotals(
    equipmentItems,
    crewItems,
    transportItems,
    offer.days_of_use,
    offer.discount_percent,
    offer.vat_percent,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
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
  const fullName = `${acceptance.first_name} ${acceptance.last_name}`.trim()
  const { error } = await supabase
    .from('job_offers')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name: fullName,
      accepted_by_phone: acceptance.phone,
    })
    .eq('access_token', accessToken)
    .eq('status', 'sent')

  if (error) throw error
}

/**
 * Reject an offer (public access)
 */
export async function rejectOffer(
  accessToken: string,
  rejection: OfferRejection,
): Promise<void> {
  const fullName = `${rejection.first_name} ${rejection.last_name}`.trim()
  const { error } = await supabase
    .from('job_offers')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by_name: fullName,
      rejected_by_phone: rejection.phone,
      rejection_comment: rejection.comment || null,
    })
    .eq('access_token', accessToken)
    .eq('status', 'sent')

  if (error) throw error
}

/**
 * Request revision of an offer (public access)
 */
export async function requestOfferRevision(
  accessToken: string,
  revisionRequest: OfferRevisionRequest,
): Promise<void> {
  const fullName =
    `${revisionRequest.first_name} ${revisionRequest.last_name}`.trim()
  const { error } = await supabase
    .from('job_offers')
    .update({
      revision_requested_at: new Date().toISOString(),
      revision_requested_by_name: fullName,
      revision_requested_by_phone: revisionRequest.phone,
      revision_comment: revisionRequest.comment || null,
      status: 'viewed', // Update status to viewed when revision is requested
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
  const offer = await offerDetailQuery(offerId).queryFn()

  if (!offer) throw new Error('Offer not found')

  // Create new offer
  const newOfferId = await createOffer({
    jobId: offer.job_id,
    companyId: offer.company_id,
    offerType: offer.offer_type,
    title: offer.title,
    daysOfUse: offer.days_of_use,
    discountPercent: offer.discount_percent,
    vatPercent: offer.vat_percent,
    showPricePerLine: offer.show_price_per_line,
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
      vehicle_category: item.vehicle_category,
      distance_km: item.distance_km,
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

  // Recalculate totals (non-blocking - if it fails, offer is still duplicated)
  try {
    await recalculateOfferTotals(newOfferId)
  } catch (recalcError) {
    // Log but don't fail the duplication - totals can be recalculated later
    console.warn(
      'Failed to recalculate offer totals after duplication:',
      recalcError,
    )
  }

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
      .select('id, deleted')
      .eq('job_id', offer.job_id)
      .eq('title', title)
      .eq('category', category)
      .eq('start_at', startAt)
      .eq('end_at', endAt)
      .maybeSingle()

    if (existing) {
      if (existing.deleted) {
        const { error: reviveError } = await supabase
          .from('time_periods')
          .update({ deleted: false, reserved_by_user_id: userId })
          .eq('id', existing.id)

        if (reviveError) throw reviveError
      }
      return existing.id
    }

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

  // 2. Create crew bookings - one time period per role title
  if (offer.crew_items && offer.crew_items.length > 0) {
    type CrewAggregate = {
      title: string
      start_at: string
      end_at: string
      needed_count: number
    }

    const crewAggregates = new Map<string, CrewAggregate>()

    for (const crewItem of offer.crew_items) {
      const roleTitle = crewItem.role_title?.trim() || 'Crew role'
      const startAt = crewItem.start_date || defaultStart
      const endAt = crewItem.end_date || defaultEnd
      const key = `${roleTitle}__${startAt}__${endAt}`

      const existing = crewAggregates.get(key)
      if (existing) {
        existing.needed_count += crewItem.crew_count
      } else {
        crewAggregates.set(key, {
          title: roleTitle,
          start_at: startAt,
          end_at: endAt,
          needed_count: crewItem.crew_count,
        })
      }
    }

    for (const aggregate of crewAggregates.values()) {
      const { data: existingPeriod, error: crewLookupError } = await supabase
        .from('time_periods')
        .select('id, deleted')
        .eq('job_id', offer.job_id)
        .eq('category', 'crew')
        .eq('title', aggregate.title)
        .eq('start_at', aggregate.start_at)
        .eq('end_at', aggregate.end_at)
        .maybeSingle()

      if (crewLookupError) throw crewLookupError

      if (existingPeriod) {
        const { error: updateError } = await supabase
          .from('time_periods')
          .update({
            needed_count: aggregate.needed_count,
            deleted: false,
            reserved_by_user_id: userId,
            company_id: companyId,
          })
          .eq('id', existingPeriod.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('time_periods')
          .insert({
            job_id: offer.job_id,
            company_id: companyId,
            title: aggregate.title,
            category: 'crew',
            start_at: aggregate.start_at,
            end_at: aggregate.end_at,
            needed_count: aggregate.needed_count,
            reserved_by_user_id: userId,
            deleted: false,
          })

        if (insertError) throw insertError
      }
    }
  }

  // 3. Create transport bookings and vehicle proposals
  if (offer.transport_items && offer.transport_items.length > 0) {
    type VehicleCandidate = {
      id: string
      name: string
      internally_owned: boolean
      external_owner_id: string | null
      vehicle_category: string | null
    }

    const { data: vehicleRows, error: vehiclesFetchError } = await supabase
      .from('vehicles')
      .select(
        'id, name, internally_owned, external_owner_id, vehicle_category, deleted',
      )
      .eq('company_id', companyId)
      .or('deleted.is.null,deleted.eq.false')

    if (vehiclesFetchError) throw vehiclesFetchError

    const availableVehicles: VehicleCandidate[] = (vehicleRows || [])
      .filter((row: any) => !row.deleted)
      .map((row: any) => ({
        id: row.id as string,
        name: row.name as string,
        internally_owned: !!row.internally_owned,
        external_owner_id: row.external_owner_id ?? null,
        vehicle_category: row.vehicle_category ?? null,
      }))

    const usedVehicleIds = new Set<string>()

    for (const transportItem of offer.transport_items) {
      const startAt = transportItem.start_date || defaultStart
      const endAt = transportItem.end_date || defaultEnd
      const category = transportItem.vehicle_category ?? null
      const defaultTitleSegment =
        transportItem.vehicle_name?.trim() ||
        category?.replace(/_/g, ' ') ||
        'Vehicle'
      const timePeriodTitle = `Transport - ${defaultTitleSegment} (${startAt})`

      const { data: existingPeriod, error: periodLookupError } = await supabase
        .from('time_periods')
        .select('id, notes, deleted')
        .eq('job_id', offer.job_id)
        .eq('category', 'transport')
        .eq('title', timePeriodTitle)
        .eq('start_at', startAt)
        .eq('end_at', endAt)
        .maybeSingle()

      if (periodLookupError) throw periodLookupError

      let timePeriodId: string

      if (existingPeriod) {
        timePeriodId = existingPeriod.id
        if (existingPeriod.deleted) {
          const { error: reviveError } = await supabase
            .from('time_periods')
            .update({ deleted: false, reserved_by_user_id: userId })
            .eq('id', existingPeriod.id)

          if (reviveError) throw reviveError
        }
      } else {
        const { data: createdPeriod, error: createPeriodError } = await supabase
          .from('time_periods')
          .insert({
            job_id: offer.job_id,
            company_id: companyId,
            title: timePeriodTitle,
            category: 'transport',
            start_at: startAt,
            end_at: endAt,
            reserved_by_user_id: userId,
            deleted: false,
          })
          .select('id')
          .single()

        if (createPeriodError) throw createPeriodError
        timePeriodId = createdPeriod.id
      }

      const existingVehicleId = transportItem.vehicle_id
      let chosenVehicle: VehicleCandidate | undefined

      if (existingVehicleId) {
        chosenVehicle = availableVehicles.find(
          (vehicle) => vehicle.id === existingVehicleId,
        )
        if (!chosenVehicle) {
          // Fallback to transport item metadata when vehicle is not in index
          chosenVehicle = {
            id: existingVehicleId,
            name: transportItem.vehicle_name || 'Vehicle',
            internally_owned: transportItem.is_internal,
            external_owner_id: transportItem.is_internal
              ? null
              : transportItem.vehicle?.external_owner_id ?? null,
            vehicle_category: category,
          }
        }
      } else if (category) {
        const matches = availableVehicles.filter(
          (vehicle) => vehicle.vehicle_category === category,
        )

        const internalMatch = matches.find(
          (vehicle) => vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
        )
        const externalMatch = matches.find(
          (vehicle) => !vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
        )

        chosenVehicle = internalMatch ?? externalMatch ?? undefined
      }

      if (chosenVehicle) {
        usedVehicleIds.add(chosenVehicle.id)

        const { data: existingReservation, error: reservationLookupError } =
          await supabase
            .from('reserved_vehicles')
            .select('id')
            .eq('time_period_id', timePeriodId)
            .eq('vehicle_id', chosenVehicle.id)
            .maybeSingle()

        if (reservationLookupError) throw reservationLookupError

        if (!existingReservation) {
          const { error: insertReservationError } = await supabase
            .from('reserved_vehicles')
            .insert({
              time_period_id: timePeriodId,
              vehicle_id: chosenVehicle.id,
              start_at: null,
              end_at: null,
              external_status: chosenVehicle.internally_owned
                ? null
                : ('planned' as const),
              external_note: null,
            })

          if (insertReservationError) throw insertReservationError
        }

        const { error: clearNotesError } = await supabase
          .from('time_periods')
          .update({ notes: null })
          .eq('id', timePeriodId)

        if (clearNotesError) throw clearNotesError
      } else {
        const message = category
          ? `No available vehicles found for ${category.replace(/_/g, ' ')}`
          : 'No available vehicles found for the requested transport'

        const { error: noteError } = await supabase
          .from('time_periods')
          .update({ notes: message })
          .eq('id', timePeriodId)

        if (noteError) throw noteError
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

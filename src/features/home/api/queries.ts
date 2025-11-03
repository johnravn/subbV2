// src/features/home/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { contaClient } from '@shared/api/conta/client'
import { supabase } from '@shared/api/supabase'

export type IncomeAndExpensesData = {
  sumIncome?: number
  sumExpenses?: number
  sumResult?: number
  income?: Array<string> // Monthly income values
  expenses?: Array<string> // Monthly expenses values
  result?: Array<string> // Monthly result values
}

/**
 * Get available organizations from Conta API
 * @returns Array of organizations with their IDs
 */
export async function getAvailableOrganizations(): Promise<
  Array<{ id: string; name?: string }>
> {
  try {
    console.log('Fetching organizations from Conta API...')
    const organizations = await contaClient.get('/invoice/organizations')
    console.log('Organizations API response:', organizations)

    // Handle array response
    const orgs = Array.isArray(organizations) ? organizations : [organizations]
    console.log('Processed organizations array:', orgs)

    // Extract organization IDs from the response
    // Try common field names
    const result: Array<{ id: string; name?: string }> = []
    for (const org of orgs) {
      console.log('Processing organization:', org)
      const orgId =
        org.id ||
        org.opContextOrgId ||
        org.organizationId ||
        org.orgId ||
        org.opContext?.orgId ||
        null

      if (orgId) {
        const name =
          org.name ||
          org.organizationName ||
          org.orgName ||
          org.displayName ||
          undefined
        result.push({
          id: String(orgId),
          name,
        })
        console.log(`Found organization: ${name || 'unnamed'} (${orgId})`)
      } else {
        console.warn('Could not extract ID from organization:', org)
      }
    }
    console.log(`Total organizations found: ${result.length}`)
    return result
  } catch (error) {
    console.error('Error fetching organizations from API:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error // Re-throw so the query can handle it properly
  }
}

/**
 * Get the organization ID from database (user's selected organization)
 * The organization ID must be configured in Company Settings
 * @param companyId - Company ID to look up in database
 */
async function getOrganizationId(
  companyId?: string | null,
): Promise<string | null> {
  try {
    if (!companyId) {
      console.warn('No company ID provided for organization ID lookup')
      return null
    }

    // Get organization ID from company_expansions table (user's selection)
    console.log('Checking database for stored organization ID...')
    const { data: expansion, error: expError } = await supabase
      .from('company_expansions')
      .select('accounting_organization_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (expError) {
      console.error('Error fetching organization ID from database:', expError)
      return null
    }

    if (!expansion) {
      console.warn(
        'No company_expansions record found for company. Please configure accounting settings.',
      )
      return null
    }

    const orgId = expansion.accounting_organization_id
    if (!orgId) {
      console.warn(
        'No organization ID stored in database. Please select an organization in Company Settings.',
      )
      return null
    }

    console.log('Found organization ID in database:', orgId)
    return orgId
  } catch (error) {
    console.error('Error getting organization ID:', error)
    return null
  }
}

/**
 * Fetch income and expenses data for a given year from Conta API
 * @param companyId - The company ID to look up organization ID for (optional)
 * @param organizationId - The Conta organization ID (optional, will be fetched if not provided)
 * @param year - The year to fetch data for (e.g., 2024)
 */
export function incomeAndExpensesQuery(
  companyId: string | null,
  organizationId: string | null,
  year: number,
) {
  return queryOptions<IncomeAndExpensesData | null>({
    queryKey: [
      'conta',
      'income-expenses',
      companyId,
      organizationId,
      year,
    ] as const,
    queryFn: async () => {
      // If organizationId is not provided, try to get it
      let orgId = organizationId
      if (!orgId) {
        orgId = await getOrganizationId(companyId)
        if (!orgId) {
          console.warn('Could not determine Conta organization ID')
          return null
        }
      }

      try {
        console.log(
          'Fetching income/expenses for organization:',
          orgId,
          'year:',
          year,
        )
        const data = (await contaClient.get(
          `/accounting/organizations/${orgId}/income-and-expenses/${year}`,
        )) as IncomeAndExpensesData
        console.log('Income/expenses data received:', data)
        return data
      } catch (error) {
        console.error('Error fetching income and expenses:', error)
        // Log more details if available
        if (error instanceof Error) {
          console.error('Error message:', error.message)
        }
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error
        ) {
          console.error('Error response:', (error as any).response)
        }
        // Return null on error so UI can handle gracefully
        return null
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

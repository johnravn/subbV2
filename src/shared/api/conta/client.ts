/**
 * Conta API Client
 *
 * This client fetches the API key from the database (company_expansions table)
 * on a per-company basis. The API key is stored encrypted in the database.
 */

import { supabase } from '../supabase'

// Get API base URL from environment
const contaApiUrl =
  import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'

/**
 * Get the Conta API key for the current user's company
 * The key is stored encrypted in company_expansions table and decrypted server-side
 */
async function getContaApiKey(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_conta_api_key')

  if (error) throw error

  return data as string | null
}

/**
 * Get the read-only setting for the Conta API
 * Returns true if API should only allow read operations
 */
async function getAccountingReadOnly(): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_accounting_read_only')
  if (error) return true // Default to read-only on error
  return data
}

/**
 * Basic fetch wrapper for Conta API
 * Fetches the API key from the database for the given company
 *
 * Note: Types are generated from the OpenAPI spec in types.ts
 */
export async function contaRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const apiKey = await getContaApiKey()
  if (!apiKey) {
    throw new Error('No Conta API key configured for this company')
  }

  const url = `${contaApiUrl}${endpoint}`

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Conta API expects 'apiKey' header, not 'Authorization: Bearer'
      apiKey: apiKey,
      ...options.headers,
    },
  })
}

/**
 * Placeholder typed client
 * This will be replaced with generated types from the OpenAPI spec
 *
 * Note: The client automatically uses the current user's selected company
 * from their profile to get the Conta API key and respects the read-only setting
 */
export const contaClient = {
  get: async (endpoint: string) => {
    const response = await contaRequest(endpoint, { method: 'GET' })

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
        if (errorData.hint) {
          errorMessage += ` - ${errorData.hint}`
        }
      } catch (e) {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage)
    }

    return response.json()
  },
  post: async (endpoint: string, data?: unknown) => {
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (POST) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage)
    }

    return response.json()
  },
  put: async (endpoint: string, data?: unknown) => {
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (PUT) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage)
    }

    return response.json()
  },
  delete: async (endpoint: string) => {
    // Check if read-only mode is enabled
    const readOnly = await getAccountingReadOnly()
    if (readOnly) {
      throw new Error(
        'Write operations (DELETE) are not allowed when API is in read-only mode',
      )
    }
    const response = await contaRequest(endpoint, { method: 'DELETE' })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        // If JSON parsing fails, use the status text
      }
      throw new Error(errorMessage)
    }

    return response.json()
  },
}

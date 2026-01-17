import { contaClient } from '@shared/api/conta/client'

type ContaProject = {
  id?: number
  name?: string
  description?: string
}

type ContaProjectSearchResponse =
  | { hits?: Array<ContaProject> }
  | { data?: Array<ContaProject> }
  | Array<ContaProject>
  | null
  | undefined

type ContaProjectInput = {
  jobTitle: string
  jobnr?: number | null
  jobId: string
  customerId?: number | null
}

const formatJobNumber = (jobnr?: number | null, jobId?: string) => {
  if (jobnr) return `#${String(jobnr).padStart(6, '0')}`
  return jobId ? `#${jobId}` : '#unknown'
}

export const buildContaJobProjectName = ({
  jobTitle,
  jobnr,
  jobId,
}: ContaProjectInput) => {
  const jobLabel = formatJobNumber(jobnr, jobId)
  return `Job ${jobLabel} - ${jobTitle}`
}

const extractProjectHits = (response: ContaProjectSearchResponse) => {
  if (!response) return [] as Array<ContaProject>
  if (Array.isArray(response)) return response
  if (Array.isArray(response.hits)) return response.hits
  if (Array.isArray(response.data)) return response.data
  return []
}

export async function findContaProjectId(
  organizationId: string,
  input: ContaProjectInput,
): Promise<number | null> {
  const query =
    input.jobnr !== null && input.jobnr !== undefined
      ? String(input.jobnr)
      : input.jobTitle || input.jobId
  const response = (await contaClient.get(
    `/invoice/organizations/${organizationId}/projects?q=${encodeURIComponent(query)}`,
  )) as ContaProjectSearchResponse
  const hits = extractProjectHits(response)
  if (!hits.length) return null

  const normalizedJobnr = input.jobnr ? String(input.jobnr) : null
  const paddedJobnr = input.jobnr ? String(input.jobnr).padStart(6, '0') : null
  const normalizedJobId = input.jobId.toLowerCase()
  const expectedName = buildContaJobProjectName(input).toLowerCase()

  const match = hits.find((hit) => {
    const name = (hit.name || '').toLowerCase()
    if (!name) return false
    if (name === expectedName) return true
    if (normalizedJobnr && name.includes(normalizedJobnr)) return true
    if (paddedJobnr && name.includes(paddedJobnr)) return true
    if (normalizedJobId && name.includes(normalizedJobId)) return true
    return false
  })

  const fallback = match || hits[0]
  return fallback?.id ? Number(fallback.id) : null
}

export async function ensureContaProjectId(
  organizationId: string,
  input: ContaProjectInput,
): Promise<number | null> {
  const existingId = await findContaProjectId(organizationId, input)
  if (existingId) return existingId

  const name = buildContaJobProjectName(input)
  const description = `Subb job ${input.jobId}`

  const created = (await contaClient.post(
    `/invoice/organizations/${organizationId}/projects`,
    {
      name,
      description,
      ...(input.customerId ? { customerId: input.customerId } : {}),
    },
  )) as { id?: number }

  return created?.id ? Number(created.id) : null
}

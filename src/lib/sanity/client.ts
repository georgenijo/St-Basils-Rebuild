import { createClient } from 'next-sanity'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
const apiVersion = '2025-03-01'

export const hasSanityConfig = Boolean(projectId && dataset)

let client: ReturnType<typeof createClient> | null = null

export function getSanityClient() {
  if (!hasSanityConfig) {
    throw new Error('Sanity is not configured')
  }

  if (!client) {
    client = createClient({
      projectId: projectId!,
      dataset: dataset!,
      apiVersion,
      useCdn: true,
    })
  }

  return client
}

export async function sanityFetch<T>({
  query,
  params = {},
  tags = [],
  revalidate = 60,
  fallback,
}: {
  query: string
  params?: Record<string, unknown>
  tags?: string[]
  revalidate?: number | false
  fallback: T
}): Promise<T> {
  if (!hasSanityConfig) {
    return fallback
  }

  try {
    return await getSanityClient().fetch<T>(query, params, {
      next: { tags, revalidate },
    })
  } catch (error) {
    console.error('Sanity fetch failed:', error)
    return fallback
  }
}

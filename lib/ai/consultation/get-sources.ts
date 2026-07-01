import { searchLaws } from './law-go-kr-client'
import { getCachedSources, setCachedSources } from './cache'
import { type NormalizedSource } from './schemas'

export type GetConsultationSourcesResult = {
  sources: NormalizedSource[]
  totalCount: number
  fromCache: boolean
}

/**
 * Slice 1 source retrieval with DB caching.
 *
 * Flow:
 *   1. Cache hit (non-expired) → return cached sources. No external call,
 *      no rate-limit consumption.
 *   2. Cache miss → searchLaws() (rate-limited external call) → persist → return.
 *
 * Rate limiting lives inside searchLaws() so it only applies to real
 * law.go.kr requests, never to cache hits.
 */
export async function getConsultationSources(params: {
  tenantId: string
  query?: string
}): Promise<GetConsultationSourcesResult> {
  const cached = await getCachedSources({ source: 'law', query: params.query })
  if (cached) {
    return {
      sources: cached.sources,
      totalCount: cached.totalCount,
      fromCache: true,
    }
  }

  const fresh = await searchLaws({ tenantId: params.tenantId, query: params.query })

  await setCachedSources({
    source: 'law',
    query: params.query,
    sources: fresh.sources,
    totalCount: fresh.totalCount,
  })

  return {
    sources: fresh.sources,
    totalCount: fresh.totalCount,
    fromCache: false,
  }
}

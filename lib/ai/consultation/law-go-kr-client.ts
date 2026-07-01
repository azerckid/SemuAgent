import { z } from 'zod'
import { extractLawArticles, normalizeLawResponse } from './normalize'
import {
  RawLawApiResponse,
  RawLawServiceResponse,
  type LawArticle,
  type NormalizedSource,
} from './schemas'

// Validated lazily at call time so tests can stub process.env before import.
function getOcCode(): string {
  const result = z.object({ LAW_OPEN_API_OC: z.string().min(1) }).safeParse(process.env)
  if (!result.success) {
    throw new Error('Law Open API env validation failed — LAW_OPEN_API_OC is required')
  }
  return result.data.LAW_OPEN_API_OC
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAW_API_BASE = 'https://www.law.go.kr/DRF/lawSearch.do'
const LAW_CONTENT_BASE = 'https://www.law.go.kr/DRF/lawService.do'
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LawGoKrApiError extends Error {
  readonly code = 'law_api_error' as const
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LawGoKrApiError'
  }
}

export class LawGoKrTimeoutError extends Error {
  readonly code = 'law_api_timeout' as const
  constructor() {
    super('law.go.kr API timed out after 30s')
    this.name = 'LawGoKrTimeoutError'
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-tenant)
// ---------------------------------------------------------------------------

const rateLimitConfigSchema = z.object({
  LAW_API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  LAW_API_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(1).default(60),
})

const rateLimitConfig = rateLimitConfigSchema.parse(process.env)

const rateLimitBuckets = new Map<string, number[]>()

export class LawGoKrRateLimitError extends Error {
  readonly code = 'law_api_rate_limited' as const
  constructor() {
    super('law.go.kr API rate limit exceeded')
    this.name = 'LawGoKrRateLimitError'
  }
}

function assertRateLimit(tenantId: string) {
  const { LAW_API_RATE_LIMIT_MAX: max, LAW_API_RATE_LIMIT_WINDOW_SEC: windowSec } = rateLimitConfig
  const windowMs = windowSec * 1000
  const now = Date.now()
  const timestamps = (rateLimitBuckets.get(tenantId) ?? []).filter((t) => now - t < windowMs)

  if (timestamps.length >= max) {
    rateLimitBuckets.set(tenantId, timestamps)
    throw new LawGoKrRateLimitError()
  }

  timestamps.push(now)
  rateLimitBuckets.set(tenantId, timestamps)
}

export function resetRateLimitStoreForTests() {
  rateLimitBuckets.clear()
}

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

export type LawSearchOptions = {
  tenantId: string
  query?: string
  page?: number
  numOfRows?: number
}

// ---------------------------------------------------------------------------
// HTTP fetch with timeout + retry
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, attempt: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LawGoKrTimeoutError()
    }
    if (attempt < MAX_RETRIES) {
      return fetchWithTimeout(url, attempt + 1)
    }
    throw new LawGoKrApiError('Network error fetching law.go.kr', error)
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export async function searchLaws(options: LawSearchOptions): Promise<{
  sources: NormalizedSource[]
  totalCount: number
}> {
  assertRateLimit(options.tenantId)

  const params = new URLSearchParams({
    OC: getOcCode(),
    target: 'law',
    type: 'json',
    page: String(options.page ?? 1),
    numOfRows: String(options.numOfRows ?? 20),
  })

  if (options.query) {
    params.set('query', options.query)
  }

  const url = `${LAW_API_BASE}?${params.toString()}`

  const response = await fetchWithTimeout(url, 0)

  if (!response.ok) {
    throw new LawGoKrApiError(`law.go.kr API returned HTTP ${response.status}`)
  }

  const json: unknown = await response.json()

  const parsed = RawLawApiResponse.safeParse(json)
  if (!parsed.success) {
    throw new LawGoKrApiError(
      `law.go.kr API response failed validation: ${parsed.error.message}`,
    )
  }

  if (parsed.data.LawSearch.resultCode !== '00') {
    throw new LawGoKrApiError(
      `law.go.kr API error: ${parsed.data.LawSearch.resultMsg}`,
    )
  }

  const sources = normalizeLawResponse(parsed.data)
  const totalCount = parseInt(parsed.data.LawSearch.totalCnt, 10)

  return { sources, totalCount }
}

// ---------------------------------------------------------------------------
// Law content (현행법령 본문 조회)
// ---------------------------------------------------------------------------

export type LawContentOptions = {
  tenantId: string
  /** 법령일련번호 (MST) — NormalizedSource.metadata.serialNumber */
  serialNumber: string
}

/**
 * Fetches the article text of a single law via lawService.do.
 * Counts against the same per-tenant rate limit as search.
 * Throws LawGoKrApiError when no article content can be parsed (loud fail) so
 * a wrong lawService.do schema surfaces instead of producing ungrounded answers.
 */
export async function fetchLawContent(options: LawContentOptions): Promise<LawArticle[]> {
  assertRateLimit(options.tenantId)

  const params = new URLSearchParams({
    OC: getOcCode(),
    target: 'law',
    type: 'json',
    MST: options.serialNumber,
  })

  const url = `${LAW_CONTENT_BASE}?${params.toString()}`

  const response = await fetchWithTimeout(url, 0)

  if (!response.ok) {
    throw new LawGoKrApiError(`law.go.kr content API returned HTTP ${response.status}`)
  }

  const json: unknown = await response.json()

  const parsed = RawLawServiceResponse.safeParse(json)
  if (!parsed.success) {
    throw new LawGoKrApiError(
      `law.go.kr content API response failed validation: ${parsed.error.message}`,
    )
  }

  const articles = extractLawArticles(parsed.data)
  if (articles.length === 0) {
    throw new LawGoKrApiError(
      `law.go.kr content API returned no parseable articles for MST=${options.serialNumber}`,
    )
  }

  return articles
}

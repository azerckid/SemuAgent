import { requireTenantSession } from '@/lib/auth-helpers'
import {
  LawGoKrApiError,
  LawGoKrRateLimitError,
  LawGoKrTimeoutError,
} from '@/lib/ai/consultation/law-go-kr-client'
import { getConsultationSources } from '@/lib/ai/consultation/get-sources'
import {
  ConsultationSourcesRequest,
  ConsultationSourcesResponse,
} from '@/lib/ai/consultation/schemas'
import { DateTime } from 'luxon'

function utcIsoTimestamp() {
  return DateTime.utc().toISO() ?? ''
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = ConsultationSourcesRequest.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { question, domain: _domain } = parsed.data

    const { sources, totalCount, fromCache } = await getConsultationSources({
      tenantId,
      query: question,
    })

    const response: ConsultationSourcesResponse = {
      status: sources.length > 0 ? 'success' : 'no_results',
      sources,
      totalCount,
      retrievedAt: utcIsoTimestamp(),
    }

    return Response.json(response, {
      headers: { 'X-Cache': fromCache ? 'HIT' : 'MISS' },
    })
  } catch (err) {
    if (err instanceof Error && (
      err.message === 'Unauthorized'
      || err.message.startsWith('No active tenant')
    )) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (err instanceof LawGoKrRateLimitError) {
      return Response.json(
        {
          status: 'error',
          sources: [],
          retrievedAt: utcIsoTimestamp(),
          error: 'rate_limited',
        } satisfies ConsultationSourcesResponse,
        { status: 429 },
      )
    }

    if (err instanceof LawGoKrTimeoutError) {
      return Response.json(
        {
          status: 'error',
          sources: [],
          retrievedAt: utcIsoTimestamp(),
          error: 'law.go.kr API timeout',
        } satisfies ConsultationSourcesResponse,
        { status: 503 },
      )
    }

    if (err instanceof LawGoKrApiError) {
      return Response.json(
        {
          status: 'error',
          sources: [],
          retrievedAt: utcIsoTimestamp(),
          error: 'law.go.kr API error',
        } satisfies ConsultationSourcesResponse,
        { status: 502 },
      )
    }

    console.error('[POST /api/ai/consultation/sources]', JSON.stringify({
      event: 'consultation_sources_error',
      errorName: err instanceof Error ? err.name : 'UnknownError',
    }))
    return Response.json(
      {
        status: 'error',
        sources: [],
        retrievedAt: utcIsoTimestamp(),
        error: 'Internal server error',
      } satisfies ConsultationSourcesResponse,
      { status: 500 },
    )
  }
}

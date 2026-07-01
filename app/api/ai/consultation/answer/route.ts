import { requireTenantSession } from '@/lib/auth-helpers'
import {
  LawGoKrApiError,
  LawGoKrRateLimitError,
  LawGoKrTimeoutError,
} from '@/lib/ai/consultation/law-go-kr-client'
import { getConsultationAnswer } from '@/lib/ai/consultation/get-answer'
import {
  ConsultationAnswerRequest,
  ConsultationAnswerResponse,
} from '@/lib/ai/consultation/schemas'
import { DateTime } from 'luxon'

function utcIsoTimestamp() {
  return DateTime.utc().toISO() ?? ''
}

const EMPTY_DISCLAIMER = ''

function errorResponse(status: number, error: string) {
  return Response.json(
    {
      status: 'no_relevant_source',
      practicalGuidance: '',
      legalBasis: '',
      missingInputs: [],
      summary: '',
      practicalNote: '',
      relatedLaws: [],
      disclaimer: EMPTY_DISCLAIMER,
      retrievedAt: utcIsoTimestamp(),
      error,
    } satisfies ConsultationAnswerResponse,
    { status },
  )
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

    const parsed = ConsultationAnswerRequest.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await getConsultationAnswer({
      tenantId,
      question: parsed.data.question,
    })

    const response: ConsultationAnswerResponse = {
      status: result.status,
      practicalGuidance: result.practicalGuidance,
      legalBasis: result.legalBasis,
      missingInputs: result.missingInputs,
      summary: result.summary,
      practicalNote: result.practicalNote,
      relatedLaws: result.relatedLaws.map((s) => ({
        sourceId: s.sourceId,
        title: s.title,
        url: s.url,
        sourceType: s.sourceType,
      })),
      disclaimer: result.disclaimer,
      retrievedAt: utcIsoTimestamp(),
    }

    return Response.json(response)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
    ) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (err instanceof LawGoKrRateLimitError) {
      return errorResponse(429, 'rate_limited')
    }

    if (err instanceof LawGoKrTimeoutError) {
      return errorResponse(503, 'law.go.kr API timeout')
    }

    if (err instanceof LawGoKrApiError) {
      return errorResponse(502, 'law.go.kr API error')
    }

    console.error('[POST /api/ai/consultation/answer]', JSON.stringify({
      event: 'consultation_answer_error',
      errorName: err instanceof Error ? err.name : 'UnknownError',
    }))
    return errorResponse(500, 'Internal server error')
  }
}

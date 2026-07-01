import {
  ConsultationAnswerResponse,
  type ConsultationAnswerResponse as ConsultationAnswerResponseType,
} from '@/lib/ai/consultation/schemas'

export type LawSearchResult =
  | { kind: 'ok'; data: ConsultationAnswerResponseType }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string }

const ERROR_MESSAGES: Record<number, string> = {
  502: 'law.go.kr 응답을 가져오지 못했습니다. 잠시 후 다시 시도하세요.',
  503: 'law.go.kr 응답이 지연되고 있습니다. 잠시 후 다시 시도하세요.',
  500: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
}

export async function postLawSearch(params: { question: string }): Promise<LawSearchResult> {
  const response = await fetch('/api/ai/consultation/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: params.question }),
  })

  if (response.status === 401) throw new Error('Unauthorized')
  if (response.status === 400) throw new Error('Invalid law search request')

  if (response.status === 429) return { kind: 'rate_limited' }

  if (!response.ok) {
    return { kind: 'error', message: ERROR_MESSAGES[response.status] ?? ERROR_MESSAGES[500] }
  }

  const json: unknown = await response.json()
  const parsed = ConsultationAnswerResponse.safeParse(json)
  if (!parsed.success) {
    return { kind: 'error', message: ERROR_MESSAGES[500] }
  }

  return { kind: 'ok', data: parsed.data }
}

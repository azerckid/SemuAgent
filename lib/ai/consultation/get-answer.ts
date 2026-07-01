import { getConsultationSources } from './get-sources'
import {
  fetchLawContent,
  LawGoKrRateLimitError,
  LawGoKrTimeoutError,
} from './law-go-kr-client'
import { generateConsultationAnswer, type ConsultationAnswerResult } from './answer'
import { planLawQueries } from './plan-query'
import { STANDING_DISCLAIMER } from './disclaimer'
import { type LawArticle, type NormalizedSource } from './schemas'

// 본문 조회는 비용·rate limit이 들므로 상위 몇 개 법령만 가져온다.
const DEFAULT_MAX_LAWS = 3

export type ConsultationAnswerPayload = ConsultationAnswerResult & {
  disclaimer: string
}

function serialNumberOf(metadata: Record<string, unknown>): string | null {
  const value = metadata.serialNumber
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

/**
 * Orchestrates the law search chat answer:
 *   plan law names (LLM) → search each (cached) → fetch article text for the
 *   top laws → grounded answer.
 *
 * The planning step is required because law.go.kr search matches law titles,
 * not free-text questions; a raw question like "가지급금 인정이자 어떻게 되나요"
 * returns nothing, while "법인세법" does.
 *
 * Rate-limit/timeout errors propagate to the caller (mapped to HTTP). A single
 * law whose content fails to parse is skipped (logged) rather than failing the
 * whole request; if every law fails, the answer service returns
 * `no_relevant_source`.
 */
export async function getConsultationAnswer(params: {
  tenantId: string
  question: string
  maxLaws?: number
}): Promise<ConsultationAnswerPayload> {
  // 자연어 질문 → 관련 법령명 후보 + 조문 선택용 개념 키워드.
  const { lawNames, keywords } = await planLawQueries({ question: params.question })

  // 후보 법령명을 각각 검색하고 sourceId 기준으로 dedupe.
  const sources: NormalizedSource[] = []
  const seen = new Set<string>()
  for (const lawName of lawNames) {
    const { sources: found } = await getConsultationSources({
      tenantId: params.tenantId,
      query: lawName,
    })
    for (const source of found) {
      if (!seen.has(source.sourceId)) {
        seen.add(source.sourceId)
        sources.push(source)
      }
    }
  }

  const topLaws = sources.slice(0, params.maxLaws ?? DEFAULT_MAX_LAWS)

  const withArticles: { source: NormalizedSource; articles: LawArticle[] }[] = []

  for (const source of topLaws) {
    const serialNumber = serialNumberOf(source.metadata)
    if (!serialNumber) continue

    try {
      const articles = await fetchLawContent({ tenantId: params.tenantId, serialNumber })
      withArticles.push({ source, articles })
    } catch (err) {
      // Degradations that should fail the request.
      if (err instanceof LawGoKrRateLimitError || err instanceof LawGoKrTimeoutError) {
        throw err
      }
      // Content parse/API error for one law → skip it, keep visibility for QA.
      console.error(
        '[consultation] law content fetch failed',
        JSON.stringify({ sourceId: source.sourceId, error: err instanceof Error ? err.name : 'Unknown' }),
      )
    }
  }

  const answer = await generateConsultationAnswer({
    question: params.question,
    sources: withArticles,
    keywords,
  })

  return { ...answer, disclaimer: STANDING_DISCLAIMER }
}

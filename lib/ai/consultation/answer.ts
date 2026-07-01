import Anthropic from '@anthropic-ai/sdk'
import { requireAnthropicEnv } from '@/lib/env'
import {
  ConsultationAnswerModelOutput,
  type ConsultationAnswerStatus,
  type LawArticle,
  type NormalizedSource,
} from './schemas'

// CLAUDE.md: AI 1차 분석 모델.
const CONSULTATION_ANSWER_MODEL = 'claude-sonnet-4-6'

// 긴 법령(예: 소득세법 393개 조문)을 통째로 넣지 않도록 입력을 제한한다.
const MAX_ARTICLES = 12
const MAX_TOTAL_CHARS = 16_000

const NO_SOURCE_SUMMARY =
  '관련 법령 조문을 찾지 못했습니다. 검색어를 바꾸거나 담당 전문가에게 확인하세요.'

const TRUNCATED_NOTE =
  '관련 조문이 많아 핵심 일부만 검토했습니다. 질문을 더 구체화하면 정확도가 올라갑니다.'

/** A search result paired with its fetched article text. */
export type SourceWithArticles = {
  source: NormalizedSource
  articles: LawArticle[]
}

export type ConsultationAnswerResult = {
  status: ConsultationAnswerStatus
  practicalGuidance: string // 일반 실무 안내 (법령 출처 아님)
  legalBasis: string // 법령 근거 / 세무상 주의 (제공된 조문에서만)
  missingInputs: string[] // 추가 확인 필요한 자료
  summary: string // 짧은 결론
  practicalNote: string // 최종 주의 문구
  relatedLaws: NormalizedSource[] // answered일 때만, 인용된 실제 출처
}

function extractJson(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

function extractKeywords(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^0-9a-z가-힣]+/i)
        .filter((token) => token.length >= 2),
    ),
  )
}

type ArticleCandidate = { source: NormalizedSource; article: LawArticle; score: number }

function articleHaystack(article: LawArticle): string {
  return `${article.title ?? ''} ${article.text}`
}

/**
 * Keyword-ranks article candidates with IDF weighting and keeps only the most
 * relevant within the article-count and character budget, then regroups them
 * per source. IDF makes rare, distinctive terms (가산세, 가지급금) outweigh common
 * ones (세금계산서) so the genuinely relevant article is not crowded out.
 * Falls back to original order when no keyword matches (avoids false negatives).
 */
function selectRelevantArticles(
  terms: string[],
  sources: SourceWithArticles[],
): { selected: SourceWithArticles[]; truncated: boolean } {
  const allArticles: { source: NormalizedSource; article: LawArticle }[] = []
  for (const { source, articles } of sources) {
    for (const article of articles) allArticles.push({ source, article })
  }

  // 후보 조문 전체에서 각 키워드의 document frequency → IDF.
  const total = allArticles.length || 1
  const idf = new Map<string, number>()
  for (const term of terms) {
    const df = allArticles.filter(({ article }) => articleHaystack(article).includes(term)).length
    idf.set(term, Math.log(1 + total / (df + 1)))
  }

  const scoreArticle = (article: LawArticle): number => {
    const haystack = articleHaystack(article)
    return terms.reduce((sum, term) => sum + (haystack.includes(term) ? (idf.get(term) ?? 0) : 0), 0)
  }

  const candidates: ArticleCandidate[] = allArticles.map(({ source, article }) => ({
    source,
    article,
    score: scoreArticle(article),
  }))

  // 점수 내림차순, 동점은 원래 순서 유지(stable).
  const ranked = candidates
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.score - a.c.score || a.index - b.index)
    .map(({ c }) => c)

  const kept: ArticleCandidate[] = []
  let charBudget = MAX_TOTAL_CHARS
  for (const candidate of ranked) {
    if (kept.length >= MAX_ARTICLES) break
    if (kept.length > 0 && candidate.article.text.length > charBudget) continue
    kept.push(candidate)
    charBudget -= candidate.article.text.length
  }

  const truncated = kept.length < candidates.length

  // 원래 source 순서를 보존하며 채택된 조문만 다시 묶는다.
  const selected: SourceWithArticles[] = []
  for (const { source } of sources) {
    const articles = kept
      .filter((k) => k.source.sourceId === source.sourceId)
      .map((k) => k.article)
    if (articles.length > 0) selected.push({ source, articles })
  }

  return { selected, truncated }
}

function buildSystemPrompt(): string {
  return [
    '당신은 한국 회계사무소 내부 직원을 돕는 법령 검색 보조입니다.',
    '답변은 practicalGuidance(일반 실무 안내)와 legalBasis(법령 근거/세무상 주의)를 분리해서 작성합니다.',
    'legalBasis는 아래 제공된 "법령 조문 본문" 안에서만 작성하세요. 본문에 없는 법령·조항·수치를 지어내지 마세요.',
    'practicalGuidance는 계산식·분개·처리 순서·필요한 입력값 같은 일반 회계 실무 설명입니다. 이 부분은 법령 조문 출처가 아니라 당신의 일반 지식으로 작성해도 되지만, 마치 법령 조문에서 그대로 인용한 것처럼 쓰지 마세요.',
    '질문자가 알려주지 않은 회사별 숫자(급여, 근속연수, 기존 충당금 잔액 등)를 만들어내서 계산하지 마세요. 계산에 필요한데 주어지지 않은 값은 missingInputs 배열에 나열하세요.',
    'NTS 질의회신, Hometax, K-IFRS, 예규·판례처럼 현재 검색하지 않는 출처가 필요한 질문이면, 그 출처를 검색한 것처럼 말하지 말고 legalBasis 또는 missingInputs에서 "해당 출처는 아직 연결되어 있지 않다"고 명시하세요.',
    'legalBasis에서 근거를 찾을 수 없으면 summary에 추정해서 채우지 말고 status로 표시하세요.',
    '답변은 한국어로 간결하게 작성합니다. summary는 짧은 결론, practicalNote는 최종 주의 문구입니다.',
    '특정 고객사·직원의 신고/금액/결론을 확정하는 질문이거나 제공 본문으로 답할 수 없는 질문은 status="needs_expert"로 두고 전문가 확인을 안내하세요.',
    '제공된 조문이 질문과 무관하면 status="no_relevant_source"로 두세요.',
    '실제로 근거로 사용한 출처만 citedSourceIds에 해당 sourceId 값으로 넣습니다. 쓰지 않았다면 빈 배열로 둡니다.',
    '반드시 JSON만 출력합니다.',
  ].join('\n')
}

function buildUserPrompt(question: string, sources: SourceWithArticles[]): string {
  const sourceBlocks = sources
    .map(({ source, articles }) => {
      const body = articles
        .map((a) => {
          const heading = a.title ? `제${a.articleNo}조(${a.title})` : `제${a.articleNo}조`
          return `${heading}\n${a.text}`
        })
        .join('\n\n')
      return [
        `### sourceId=${source.sourceId} | ${source.title} (${source.sourceType}) | 시행일 ${source.effectiveAt}`,
        body,
      ].join('\n')
    })
    .join('\n\n---\n\n')

  return [
    `질문: ${question}`,
    '',
    '법령 조문 본문:',
    sourceBlocks,
    '',
    '출력 JSON 형식:',
    '{',
    '  "status": "answered" | "needs_expert" | "no_relevant_source",',
    '  "practicalGuidance": "일반 실무 안내: 계산식·분개·처리 순서·필요 입력값 (한국어)",',
    '  "legalBasis": "법령 근거 / 세무상 주의, 제공된 조문 본문에서만 (한국어)",',
    '  "missingInputs": ["계산에 필요하지만 질문에 없는 값"],',
    '  "summary": "짧은 결론 (한국어)",',
    '  "practicalNote": "최종 주의 문구 (한국어)",',
    '  "citedSourceIds": ["근거로 사용한 출처 sourceId"]',
    '}',
  ].join('\n')
}

/**
 * Source-grounded summary answer for the law search chat (v1).
 *
 * Grounding guarantees:
 *  - Answers from the provided article text only (본문이 프롬프트에 포함됨).
 *  - No article text at all → `no_relevant_source` without calling the model.
 *  - Only cited sourceIds present in the input are kept as related laws.
 *  - `relatedLaws` is attached ONLY for `answered`; an `answered` result with no
 *    resolvable source is downgraded to `needs_expert` (no ungrounded answer).
 */
export async function generateConsultationAnswer(params: {
  question: string
  sources: SourceWithArticles[]
  /** 조문 선택용 개념 키워드(조사 없음). 없으면 질문에서 토큰을 뽑아 fallback. */
  keywords?: string[]
}): Promise<ConsultationAnswerResult> {
  const grounded = params.sources.filter((s) => s.articles.length > 0)

  if (grounded.length === 0) {
    return {
      status: 'no_relevant_source',
      practicalGuidance: '',
      legalBasis: '',
      missingInputs: [],
      summary: NO_SOURCE_SUMMARY,
      practicalNote: '',
      relatedLaws: [],
    }
  }

  // 질문 관련 조문만 선별하고 입력 길이를 제한한다.
  const terms =
    params.keywords && params.keywords.length > 0
      ? params.keywords
      : extractKeywords(params.question)
  const { selected, truncated } = selectRelevantArticles(terms, grounded)

  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: CONSULTATION_ANSWER_MODEL,
    // practicalGuidance/legalBasis 필드가 추가되어 출력량이 늘었다. 1500이면
    // 복잡한 질문(예: 퇴직급여충당금)에서 JSON이 닫히기 전에 잘려 매번
    // "JSON not found"로 실패했다 (라이브 검증으로 발견, stop_reason=max_tokens).
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(params.question, selected) }],
  })

  const rawOutput = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const json = extractJson(rawOutput)
  if (!json) {
    throw new Error('Consultation answer model output JSON not found')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(json)
  } catch {
    throw new Error('Consultation answer model output is not valid JSON')
  }

  const parsed = ConsultationAnswerModelOutput.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`Consultation answer model output validation failed: ${parsed.error.message}`)
  }

  // 비-answered 상태는 관련 법령을 붙이지 않는다 (응답 계약 단순화 — P2).
  if (parsed.data.status !== 'answered') {
    return {
      status: parsed.data.status,
      practicalGuidance: parsed.data.practicalGuidance,
      legalBasis: parsed.data.legalBasis,
      missingInputs: parsed.data.missingInputs,
      summary: parsed.data.summary,
      practicalNote: parsed.data.practicalNote,
      relatedLaws: [],
    }
  }

  // 환각 방지: 인용한 sourceId 중 모델에 실제로 제공한(selected) 출처만 채택.
  const byId = new Map(selected.map(({ source }) => [source.sourceId, source]))
  const relatedLaws = parsed.data.citedSourceIds
    .map((id) => byId.get(id))
    .filter((s): s is NormalizedSource => Boolean(s))

  // answered인데 근거 출처가 하나도 없으면 근거 없는 답이므로 전문가 확인으로 강등.
  // legalBasis는 근거가 해소되지 않은 주장이라 비우고, practicalGuidance/missingInputs는
  // 법령 출처를 주장한 적이 없으므로 그대로 둔다.
  if (relatedLaws.length === 0) {
    return {
      status: 'needs_expert',
      practicalGuidance: parsed.data.practicalGuidance,
      legalBasis: '',
      missingInputs: parsed.data.missingInputs,
      summary: parsed.data.summary,
      practicalNote:
        parsed.data.practicalNote || '근거 법령을 특정하지 못했습니다. 담당 전문가 확인이 필요합니다.',
      relatedLaws: [],
    }
  }

  const practicalNote = truncated
    ? [parsed.data.practicalNote, TRUNCATED_NOTE].filter(Boolean).join(' ')
    : parsed.data.practicalNote

  return {
    status: 'answered',
    practicalGuidance: parsed.data.practicalGuidance,
    legalBasis: parsed.data.legalBasis,
    missingInputs: parsed.data.missingInputs,
    summary: parsed.data.summary,
    practicalNote,
    relatedLaws,
  }
}

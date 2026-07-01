import Anthropic from '@anthropic-ai/sdk'
import { requireAnthropicEnv } from '@/lib/env'
import { LawQueryPlan } from './schemas'

// CLAUDE.md: AI 1차 분석 모델.
const QUERY_PLAN_MODEL = 'claude-sonnet-4-6'

// law.go.kr 검색 부하/비용을 고려해 후보 법령명을 제한한다.
const MAX_LAW_NAMES = 3

function extractJson(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

export type LawQueryPlanResult = {
  lawNames: string[]
  keywords: string[]
}

function buildSystemPrompt(): string {
  return [
    '당신은 한국 회계사무소 직원의 질문을 법령 검색 계획으로 바꾸는 보조입니다.',
    'lawNames: 질문과 가장 관련된 대한민국 현행 법령의 "정식 명칭"(최대 3개). 시행령·시행규칙이 핵심이면 포함. 설명·조문번호 금지, 법령명만.',
    'keywords: 답변 근거가 될 조문을 고르기 위한 핵심 개념어(최대 6개). 반드시 조사·어미를 떼고 명사형으로(예: "가산세가"→"가산세", "지연발급"). 질문의 가장 변별력 있는 법률 용어 위주.',
    '예: "세금계산서 지연발급 가산세가 어떻게 되나요?" → lawNames:["부가가치세법"], keywords:["가산세","세금계산서","지연발급"].',
    '예: "대표이사 가지급금 인정이자" → lawNames:["법인세법","법인세법 시행령"], keywords:["가지급금","인정이자","부당행위계산"].',
    '관련 법령을 특정할 수 없으면 lawNames를 빈 배열로 둡니다.',
    '반드시 JSON만 출력합니다.',
  ].join('\n')
}

function buildUserPrompt(question: string): string {
  return [
    `질문: ${question}`,
    '',
    '출력 JSON 형식:',
    '{ "lawNames": ["법령명"], "keywords": ["개념어"] }',
  ].join('\n')
}

/**
 * Maps a natural-language question to candidate law names + concept keywords,
 * because law.go.kr search matches law titles (not free-text concepts) and
 * article selection needs clean, particle-free terms. Returns up to
 * MAX_LAW_NAMES trimmed/de-duplicated names and the concept keywords.
 */
export async function planLawQueries(params: { question: string }): Promise<LawQueryPlanResult> {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: QUERY_PLAN_MODEL,
    max_tokens: 256,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(params.question) }],
  })

  const rawOutput = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const json = extractJson(rawOutput)
  if (!json) {
    throw new Error('Law query plan output JSON not found')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(json)
  } catch {
    throw new Error('Law query plan output is not valid JSON')
  }

  const parsed = LawQueryPlan.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`Law query plan output validation failed: ${parsed.error.message}`)
  }

  const lawNames = Array.from(
    new Set(parsed.data.lawNames.map((name) => name.trim()).filter((name) => name.length > 0)),
  ).slice(0, MAX_LAW_NAMES)

  const keywords = Array.from(
    new Set(parsed.data.keywords.map((kw) => kw.trim()).filter((kw) => kw.length >= 2)),
  )

  return { lawNames, keywords }
}

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import {
  reviewAttributionFilterSpecV1Schema,
  type ReviewAttributionFilterSpecV1,
} from '@/lib/reviews/attribution-saved-prompt-filter-schema'

// 비용 최적화: 기본 provider order는 gemini -> openai -> claude(가장 저렴한 모델 우선).
// 한 provider가 실패(호출 오류/JSON 파싱 실패/스키마 검증 실패)하면 다음 provider로 fallback한다.
const CLAUDE_INTERPRET_MODEL = 'claude-sonnet-4-6'
const OPENAI_INTERPRET_MODEL = OPENAI_ANALYSIS_MODEL
const INTERPRET_SYSTEM_PROMPT = 'Return JSON only. No markdown outside JSON.'

function extractJsonFromResponse(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) return fenced[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return text.slice(first, last + 1)
}

function buildInterpretPrompt(params: {
  promptText: string
  requestedPeriod?: string
  closePeriod?: string
}) {
  return [
    '당신은 한국 회계사무소 자료검토 화면에서 담당자가 입력한 자연어 프롬프트를 구조화된 귀속기간 필터 스펙으로만 해석하는 AI입니다.',
    '실제 거래 row나 고객 데이터는 제공되지 않습니다. 오직 프롬프트 문구와 허용 스키마만 보고 JSON 하나를 반환하세요.',
    '',
    '규칙:',
    '- allow-list 필드만 사용합니다. raw SQL, regex, JavaScript 표현식은 금지입니다.',
    '- 최소 1개 이상의 실제 필터 조건(amountKrw, periodRelationIn, attributedPeriodIn, contains 계열, duplicateStatusIn, aiRecommendationIn, staffDecisionIn)이 있어야 합니다.',
    '- staffDecisionIn의 undecided는 담당자 미결정(staff_decision IS NULL)을 의미합니다.',
    '- aiRecommendationIn은 recommendation 컬럼에 매핑됩니다.',
    '- periodRelationIn 허용 값: requested, prior, future, unknown',
    '- duplicateStatusIn 허용 값: none, possible_duplicate',
    '- aiRecommendationIn / staffDecisionIn(undecided 제외) 허용 값: include, hold, exclude_duplicate, reference_only',
    '- amountKrw는 정수 KRW, 0 이상. limit은 1-500.',
    '- explanationKo는 담당자가 읽을 수 있는 한국어 조건 요약입니다.',
    '- 해석이 불가능하면 임의 필드를 만들지 말고, 가능한 범위에서 가장 보수적인 필터를 제안하세요.',
    '',
    params.requestedPeriod ? `요청기간 맥락: ${params.requestedPeriod}` : null,
    params.closePeriod ? `마감월 맥락: ${params.closePeriod}` : null,
    '',
    '출력 JSON 스키마 예시:',
    JSON.stringify({
      version: 1,
      amountKrw: { min: 2000000 },
      sort: { field: 'amountKrw', direction: 'desc' },
      explanationKo: '금액이 2,000,000원 이상인 귀속기간 항목만 표시합니다.',
    }, null, 2),
    '',
    '담당자 프롬프트:',
    params.promptText,
  ].filter(Boolean).join('\n')
}

type ProviderRunResult =
  | { ok: true; spec: ReviewAttributionFilterSpecV1 }
  | { ok: false; error: string }

export type InterpretReviewAttributionPromptResult =
  | { ok: true; spec: ReviewAttributionFilterSpecV1; provider: AiProvider }
  | { ok: false; error: string }

export type InterpretRunner = (input: { provider: AiProvider; prompt: string }) => Promise<ProviderRunResult>

function parseSpecFromRawText(rawText: string): ProviderRunResult {
  const jsonText = extractJsonFromResponse(rawText)
  if (!jsonText) return { ok: false, error: 'AI 응답을 JSON으로 파싱하지 못했습니다.' }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: 'AI 응답을 JSON으로 파싱하지 못했습니다.' }
  }

  const parsed = reviewAttributionFilterSpecV1Schema.safeParse(parsedJson)
  if (!parsed.success) {
    return { ok: false, error: 'AI가 생성한 필터 스펙이 검증에 실패했습니다.' }
  }
  return { ok: true, spec: parsed.data }
}

async function runWithGemini(prompt: string): Promise<ProviderRunResult> {
  const { isGeminiEnabled, requireGoogleAiEnv } = await import('@/lib/env')
  if (!isGeminiEnabled()) return { ok: false, error: 'Gemini provider is disabled (GEMINI_ENABLED=false)' }

  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const model = new GoogleGenerativeAI(GOOGLE_AI_API_KEY).getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: INTERPRET_SYSTEM_PROMPT,
  })
  const response = await model.generateContent(prompt)
  return parseSpecFromRawText(response.response.text())
}

async function runWithOpenAI(prompt: string): Promise<ProviderRunResult> {
  const { requireOpenAiEnv } = await import('@/lib/env')
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })
  const response = await client.chat.completions.create({
    model: OPENAI_INTERPRET_MODEL,
    max_completion_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: INTERPRET_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  })
  return parseSpecFromRawText(response.choices[0]?.message?.content ?? '')
}

async function runWithClaude(prompt: string): Promise<ProviderRunResult> {
  const { requireAnthropicEnv } = await import('@/lib/env')
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: CLAUDE_INTERPRET_MODEL,
    max_tokens: 1200,
    temperature: 0,
    system: INTERPRET_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = response.content.find((block) => block.type === 'text')
  const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
  return parseSpecFromRawText(rawText)
}

async function defaultInterpretRunner({ provider, prompt }: { provider: AiProvider; prompt: string }): Promise<ProviderRunResult> {
  try {
    if (provider === 'gemini') return await runWithGemini(prompt)
    if (provider === 'openai') return await runWithOpenAI(prompt)
    return await runWithClaude(prompt)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function interpretReviewAttributionPrompt(
  params: {
    promptText: string
    requestedPeriod?: string
    closePeriod?: string
  },
  options: { runner?: InterpretRunner; providers?: AiProvider[] } = {},
): Promise<InterpretReviewAttributionPromptResult> {
  const prompt = buildInterpretPrompt(params)
  const providers = options.providers ?? getActiveAiProviderOrder()
  const runner = options.runner ?? defaultInterpretRunner

  let lastError = '프롬프트 해석 중 오류가 발생했습니다.'
  for (const provider of providers) {
    const result = await runner({ provider, prompt }).catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    }))

    if (result.ok) return { ok: true, spec: result.spec, provider }

    lastError = result.error
    console.warn(`[interpretReviewAttributionPrompt] ${provider} 해석 실패: ${result.error}`)
  }

  return { ok: false, error: lastError }
}

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { AI_PROVIDER_ORDER, type AiProvider } from '@/lib/ai/provider-order'
import type { MaterialAttributionAiOutput } from './schemas'
import type { GeneratedAttributionRow } from './period-attribution-service'
import { applyMaterialAttributionAiSuggestions } from './period-attribution-ai-merge'
import {
  MATERIAL_ATTRIBUTION_GEMINI_RESPONSE_SCHEMA,
  MATERIAL_ATTRIBUTION_STRUCTURED_JSON_SCHEMA,
  MATERIAL_ATTRIBUTION_SUBMIT_TOOL,
  parseMaterialAttributionJsonText,
  parseMaterialAttributionStructuredValue,
  type MaterialAttributionParseFailureMeta,
  type MaterialAttributionProviderRunResult,
} from './period-attribution-ai-structured-schema'

export const BOOKKEEPING_PERIOD_ATTRIBUTION_CLAUDE_MODEL = 'claude-sonnet-4-6'
export const BOOKKEEPING_PERIOD_ATTRIBUTION_OPENAI_MODEL = OPENAI_ANALYSIS_MODEL
export const BOOKKEEPING_PERIOD_ATTRIBUTION_LLM_BATCH_SIZE = 25
export const BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_OUTPUT_TOKENS = 8192
export const BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_REASON_CHARS = 120

const MAX_LLM_CANDIDATES = BOOKKEEPING_PERIOD_ATTRIBUTION_LLM_BATCH_SIZE
const PERIOD_ATTRIBUTION_PARSE_RETRIES = 2
const PERIOD_ATTRIBUTION_SYSTEM_PROMPT = 'You return strict JSON for bookkeeping period attribution.'

function buildPrompt(params: {
  clientName: string
  requestedPeriod: string
  closePeriod: string
  rows: Array<{ index: number; row: GeneratedAttributionRow }>
}) {
  return [
    '당신은 한국 회계사무소의 기장 자료 귀속기간 검토를 보조하는 AI입니다.',
    '제공된 후보 거래/파일 요약을 보고 업로드 자료의 실제 귀속기간을 판단하세요.',
    'deterministic* 값은 코드가 추출한 초안일 뿐이며, 실제 설명·증빙일·거래 맥락과 충돌하면 AI 판단으로 바로잡으세요.',
    '',
    '중요 규칙:',
    '- 파일명만으로 귀속기간을 확정하지 말고, 증빙일·거래일·설명 등 내용 근거를 우선하세요.',
    '- 세무 신고 완료 여부를 판단하지 마세요.',
    '- 담당자 검토 없이 자료를 최종 반영하지 마세요.',
    '- 확실하지 않으면 periodRelation은 unknown, recommendation은 hold로 두세요.',
    '- 미래월 자료는 일반적으로 reference_only를 추천하세요.',
    '- 이전월 누락자료는 include 또는 hold를 추천할 수 있지만, 담당자 검토가 필요합니다.',
    `- reason은 ${BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_REASON_CHARS}자 이내 한 문장으로만 작성하세요.`,
    '- 검토 대상의 모든 index에 대해 candidates 항목을 정확히 1개씩 반환하세요. 누락하거나 중복하지 마세요.',
    '- 출력은 지정된 structured schema에 맞는 JSON 하나만 반환하세요.',
    '',
    `고객사: ${params.clientName}`,
    `요청기간: ${params.requestedPeriod}`,
    `마감 후보 기간: ${params.closePeriod}`,
    '',
    '출력 스키마:',
    JSON.stringify(MATERIAL_ATTRIBUTION_STRUCTURED_JSON_SCHEMA, null, 2),
    '',
    '검토 대상:',
    JSON.stringify(params.rows.map(({ index, row }) => ({
      index,
      sourceKind: row.sourceKind,
      sourceLabel: row.sourceLabel,
      deterministicEvidenceDate: row.evidenceDate,
      deterministicAttributedPeriod: row.attributedPeriod,
      deterministicPeriodRelation: row.periodRelation,
      description: row.description,
      duplicateStatus: row.duplicateStatus,
      deterministicRecommendation: row.recommendation,
    })), null, 2),
  ].join('\n')
}

type ProviderRunResult = MaterialAttributionProviderRunResult
type ProviderResultEntry = {
  provider: AiProvider
  result: ProviderRunResult
}

export type PeriodAttributionLlmRunner = (input: {
  provider: AiProvider
  prompt: string
}) => Promise<ProviderRunResult>

type ParseFailureMeta = MaterialAttributionParseFailureMeta & {
  provider?: AiProvider
}

function withProviderMeta(meta: ParseFailureMeta | undefined, provider: AiProvider): ParseFailureMeta {
  return { ...meta, provider }
}

async function runWithGemini(prompt: string): Promise<ProviderRunResult> {
  const { isGeminiEnabled, requireGoogleAiEnv } = await import('@/lib/env')
  if (!isGeminiEnabled()) return { ok: false, error: 'Gemini provider is disabled (GEMINI_ENABLED=false)' }

  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const model = new GoogleGenerativeAI(GOOGLE_AI_API_KEY).getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: PERIOD_ATTRIBUTION_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_OUTPUT_TOKENS,
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: MATERIAL_ATTRIBUTION_GEMINI_RESPONSE_SCHEMA,
    },
  })
  const response = await model.generateContent(prompt)
  const candidate = response.response.candidates?.[0]
  const finishReason = candidate?.finishReason ?? null
  const meta = withProviderMeta({ stopReason: finishReason, structured: true }, 'gemini')
  const rawText = response.response.text()

  try {
    return parseMaterialAttributionStructuredValue(JSON.parse(rawText), meta)
  } catch {
    return parseMaterialAttributionJsonText(rawText, meta)
  }
}

async function runWithOpenAI(prompt: string): Promise<ProviderRunResult> {
  const { requireOpenAiEnv } = await import('@/lib/env')
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })
  const meta = withProviderMeta({ structured: true }, 'openai')

  try {
    const response = await client.chat.completions.create({
      model: BOOKKEEPING_PERIOD_ATTRIBUTION_OPENAI_MODEL,
      max_completion_tokens: BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_OUTPUT_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'material_attribution_ai_output',
          strict: true,
          schema: MATERIAL_ATTRIBUTION_STRUCTURED_JSON_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: PERIOD_ATTRIBUTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })
    const choice = response.choices[0]
    const rawText = choice?.message?.content ?? ''
    return parseMaterialAttributionJsonText(rawText, {
      ...meta,
      stopReason: choice?.finish_reason ?? null,
    })
  } catch (structuredError) {
    console.warn('[bookkeeping-period-attribution-ai] openai structured output fallback', {
      error: structuredError instanceof Error ? structuredError.message : String(structuredError),
    })

    const response = await client.chat.completions.create({
      model: BOOKKEEPING_PERIOD_ATTRIBUTION_OPENAI_MODEL,
      max_completion_tokens: BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PERIOD_ATTRIBUTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })
    const choice = response.choices[0]
    return parseMaterialAttributionJsonText(choice?.message?.content ?? '', {
      ...meta,
      structured: false,
      stopReason: choice?.finish_reason ?? null,
    })
  }
}

async function runWithClaude(prompt: string): Promise<ProviderRunResult> {
  const { requireAnthropicEnv } = await import('@/lib/env')
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: BOOKKEEPING_PERIOD_ATTRIBUTION_CLAUDE_MODEL,
    max_tokens: BOOKKEEPING_PERIOD_ATTRIBUTION_MAX_OUTPUT_TOKENS,
    temperature: 0,
    system: PERIOD_ATTRIBUTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    tools: [MATERIAL_ATTRIBUTION_SUBMIT_TOOL],
    tool_choice: { type: 'tool', name: MATERIAL_ATTRIBUTION_SUBMIT_TOOL.name },
  })

  const meta = withProviderMeta({ stopReason: response.stop_reason ?? null, structured: true }, 'claude')
  const toolUse = response.content.find((block) => block.type === 'tool_use')
  if (toolUse?.type === 'tool_use') {
    return parseMaterialAttributionStructuredValue(toolUse.input, meta)
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
  return parseMaterialAttributionJsonText(rawText, { ...meta, structured: false })
}

async function defaultPeriodAttributionRunner({
  provider,
  prompt,
}: {
  provider: AiProvider
  prompt: string
}): Promise<ProviderRunResult> {
  try {
    if (provider === 'gemini') return await runWithGemini(prompt)
    if (provider === 'openai') return await runWithOpenAI(prompt)
    return await runWithClaude(prompt)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function chunkRows(rows: Array<{ index: number; row: GeneratedAttributionRow }>) {
  const chunks: Array<Array<{ index: number; row: GeneratedAttributionRow }>> = []
  for (let index = 0; index < rows.length; index += MAX_LLM_CANDIDATES) {
    chunks.push(rows.slice(index, index + MAX_LLM_CANDIDATES))
  }
  return chunks
}

function candidateMapFor(ai: MaterialAttributionAiOutput, allowedIndexes: Set<number>) {
  const candidates = new Map<number, MaterialAttributionAiOutput['candidates'][number]>()
  for (const candidate of ai.candidates) {
    if (!allowedIndexes.has(candidate.index)) continue
    if (candidates.has(candidate.index)) return null
    candidates.set(candidate.index, candidate)
  }

  if (candidates.size !== allowedIndexes.size) return null
  return candidates
}

function decisionSignature(ai: MaterialAttributionAiOutput, allowedIndexes: Set<number>) {
  const candidates = candidateMapFor(ai, allowedIndexes)
  if (!candidates) return null

  return [...allowedIndexes]
    .sort((left, right) => left - right)
    .map((index) => {
      const candidate = candidates.get(index)
      if (!candidate) return ''
      // recommendation은 합의 비교에서 제외한다. 머지(applyMaterialAttributionAiSuggestions)는
      // AI의 recommendation을 쓰지 않고 (duplicateStatus, periodRelation)으로 재계산하므로,
      // 이 필드의 모델 간 불일치(예: include vs reference_only)는 출력에 영향이 없는데도
      // 합의를 깨뜨려 귀속기간 재분석을 502로 실패시켰다. 실제 출력에 쓰이는
      // evidenceDate · attributedPeriod · periodRelation 만으로 합의를 판정한다.
      return [
        candidate.index,
        candidate.evidenceDate ?? '',
        candidate.attributedPeriod ?? '',
        candidate.periodRelation,
      ].join('|')
    })
    .join('\n')
}

function attributionJudgmentsAgree(params: {
  left: MaterialAttributionAiOutput
  right: MaterialAttributionAiOutput
  allowedIndexes: Set<number>
}) {
  const leftSignature = decisionSignature(params.left, params.allowedIndexes)
  const rightSignature = decisionSignature(params.right, params.allowedIndexes)
  return leftSignature !== null && leftSignature === rightSignature
}

async function runProvider(params: {
  provider: AiProvider
  prompt: string
  runner: PeriodAttributionLlmRunner
}): Promise<ProviderRunResult> {
  return params.runner({ provider: params.provider, prompt: params.prompt }).catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  }))
}

function isRetriableParseError(error: string) {
  return error.includes('JSON') || error.includes('candidates') || error.includes('Required')
}

async function runProviderWithParseRetry(params: {
  provider: AiProvider
  prompt: string
  runner: PeriodAttributionLlmRunner
}): Promise<ProviderRunResult> {
  let lastResult: ProviderRunResult = { ok: false, error: 'unknown error' }

  for (let attempt = 0; attempt < PERIOD_ATTRIBUTION_PARSE_RETRIES; attempt += 1) {
    const result = await runProvider(params)
    if (result.ok) return result

    lastResult = result
    if (!isRetriableParseError(result.error) || attempt === PERIOD_ATTRIBUTION_PARSE_RETRIES - 1) {
      return result
    }

    console.warn(
      `[bookkeeping-period-attribution-ai] ${params.provider} structured parse retry ${attempt + 2}/${PERIOD_ATTRIBUTION_PARSE_RETRIES}`,
    )
  }

  return lastResult
}

function isSuccessfulCompleteProviderResult(
  entry: ProviderResultEntry,
  allowedIndexes: Set<number>,
): entry is ProviderResultEntry & { result: { ok: true; data: MaterialAttributionAiOutput } } {
  return entry.result.ok && decisionSignature(entry.result.data, allowedIndexes) !== null
}

async function runConsensusForPrompt(params: {
  prompt: string
  providers: AiProvider[]
  runner: PeriodAttributionLlmRunner
  allowedIndexes: Set<number>
}) {
  const primaryProviders = params.providers.filter((provider) => provider === 'gemini' || provider === 'openai')
  const primaryResults: ProviderResultEntry[] = await Promise.all(primaryProviders.map(async (provider) => ({
    provider,
    result: await runProviderWithParseRetry({ provider, prompt: params.prompt, runner: params.runner }),
  })))
  const successfulPrimary = primaryResults.filter((entry) =>
    isSuccessfulCompleteProviderResult(entry, params.allowedIndexes))

  if (successfulPrimary.length >= 2) {
    const [first, second] = successfulPrimary
    if (first && second && attributionJudgmentsAgree({
      left: first.result.data,
      right: second.result.data,
      allowedIndexes: params.allowedIndexes,
    })) {
      return first.result.data
    }
  }

  for (const entry of primaryResults) {
    if (!entry.result.ok) {
      console.warn(`[bookkeeping-period-attribution-ai] ${entry.provider} 판단 실패: ${entry.result.error}`)
    }
  }

  const claudeAvailable = params.providers.includes('claude')
  if (!claudeAvailable) {
    throw new Error('Gemini와 ChatGPT(OpenAI) 귀속기간 판단이 일치하지 않았습니다.')
  }

  const claudeResult = await runProviderWithParseRetry({
    provider: 'claude',
    prompt: params.prompt,
    runner: params.runner,
  })
  if (!claudeResult.ok) {
    console.warn(`[bookkeeping-period-attribution-ai] claude 판단 실패: ${claudeResult.error}`)
    throw new Error('귀속기간 LLM 판단에서 두 provider 합의에 도달하지 못했습니다.')
  }

  for (const primary of successfulPrimary) {
    if (attributionJudgmentsAgree({
      left: primary.result.data,
      right: claudeResult.data,
      allowedIndexes: params.allowedIndexes,
    })) {
      return primary.result.data
    }
  }

  throw new Error('귀속기간 LLM 판단에서 두 provider 합의에 도달하지 못했습니다.')
}

export async function enhanceMaterialAttributionWithLlm(
  params: {
    clientName: string
    requestedPeriod: string
    closePeriod: string
    rows: GeneratedAttributionRow[]
  },
  options: {
    providers?: AiProvider[]
    runner?: PeriodAttributionLlmRunner
  } = {},
) {
  const targetRows = params.rows
    .map((row, index) => ({ row, index }))

  if (targetRows.length === 0) return params.rows

  const providers = options.providers ?? [...AI_PROVIDER_ORDER]
  const runner = options.runner ?? defaultPeriodAttributionRunner
  let rows = params.rows

  for (const chunk of chunkRows(targetRows)) {
    const allowedIndexes = new Set(chunk.map(({ index }) => index))
    const prompt = buildPrompt({
      clientName: params.clientName,
      requestedPeriod: params.requestedPeriod,
      closePeriod: params.closePeriod,
      rows: chunk,
    })
    const result = await runConsensusForPrompt({
      prompt,
      providers,
      runner,
      allowedIndexes,
    })

    rows = applyMaterialAttributionAiSuggestions({
      rows,
      ai: result,
      allowedIndexes,
    })
  }

  return rows
}

export async function enhanceMaterialAttributionWithClaude(params: {
  clientName: string
  requestedPeriod: string
  closePeriod: string
  rows: GeneratedAttributionRow[]
}) {
  return enhanceMaterialAttributionWithLlm(params, { providers: [...AI_PROVIDER_ORDER] })
}

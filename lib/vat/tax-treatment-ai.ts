import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { VAT_TAX_TREATMENT_AI_PROMPT_VERSION } from '@/lib/validations/vat-tax-treatment-ai-result'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import {
  vatTaxTreatmentAiBatchOutputSchema,
  type VatTaxTreatmentAiBatchOutput,
  type VatTaxTreatmentAiCandidate,
} from '@/lib/validations/vat-tax-treatment-ai'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { isHighRiskVatTaxTreatmentRow } from './tax-treatment-ai-eligibility'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import { recommendationForProvisionalJudgment } from './tax-treatment-judgment'

export { VAT_TAX_TREATMENT_AI_PROMPT_VERSION }
export {
  isHighRiskVatTaxTreatmentRow,
  VAT_TAX_TREATMENT_HIGH_AMOUNT_KRW,
} from './tax-treatment-ai-eligibility'
export const VAT_TAX_TREATMENT_AI_BATCH_SIZE = 12
export const VAT_TAX_TREATMENT_AI_TIMEOUT_MS = 8_000
export const VAT_TAX_TREATMENT_CLAUDE_MODEL = 'claude-sonnet-4-6'

const VAT_TAX_TREATMENT_SYSTEM_PROMPT = [
  'You return strict JSON for Korean VAT tax-treatment review assistance.',
  'You never make a final filing decision and never claim to be a tax representative.',
].join(' ')

const RESIDENT_NUMBER_PATTERN = /\b\d{6}[-\s]?\d{7}\b/g
const PHONE_NUMBER_PATTERN = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g
const LONG_DIGIT_PATTERN = /\b\d{10,}\b/g
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const REDACTION_MASK = '[마스킹됨]'

export type VatTaxTreatmentAiProviderResult =
  | { ok: true; data: VatTaxTreatmentAiBatchOutput; modelName: string }
  | { ok: false; error: string }

export type VatTaxTreatmentAiRunner = (input: {
  provider: AiProvider
  prompt: string
}) => Promise<VatTaxTreatmentAiProviderResult>

function redactPromptValue(value: string) {
  return value
    .replace(RESIDENT_NUMBER_PATTERN, REDACTION_MASK)
    .replace(PHONE_NUMBER_PATTERN, REDACTION_MASK)
    .replace(LONG_DIGIT_PATTERN, REDACTION_MASK)
    .replace(EMAIL_PATTERN, REDACTION_MASK)
}

function extractJsonFromResponse(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) return fenced[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return text.slice(first, last + 1)
}

function parseAiResponse(rawOutput: string): VatTaxTreatmentAiProviderResult {
  const json = extractJsonFromResponse(rawOutput)
  if (!json) return { ok: false, error: 'VAT AI JSON을 찾을 수 없습니다' }

  try {
    const parsed = vatTaxTreatmentAiBatchOutputSchema.safeParse(JSON.parse(json))
    return parsed.success
      ? { ok: true, data: parsed.data, modelName: '' }
      : { ok: false, error: parsed.error.message }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function buildVatTaxTreatmentAiPrompt(rows: VatTaxTreatmentDisplayRow[]) {
  return [
    '다음은 회사가 직접 부가가치세 신고를 준비하기 위해 검토 중인 거래입니다.',
    '공식 규칙과 이전 확정 패턴을 대체하지 말고, 애매하거나 고위험이라 교차검토가 필요한 행의 판단만 보강하세요.',
    '',
    '중요 규칙:',
    '- 최종 확정이나 세무대리를 하지 말고 사용자가 확인할 가능성과 근거만 반환하세요.',
    '- 제공되지 않은 사실이나 증빙을 있다고 가정하지 마세요.',
    '- needs_review, 확인 필요, 담당자 판단 필요를 세무 결론으로 반환하지 마세요.',
    '- 영세율·면세·공제 같은 특례 근거가 부족하면 일반 처리 방향(과세 또는 불공제)을 잠정 결론으로 반환하세요.',
    '- confidence는 medium 또는 low만 사용하세요.',
    '- 각 index를 누락하거나 중복하지 말고 정확히 1개씩 반환하세요.',
    '- 출력은 JSON 하나만 반환하세요.',
    '',
    '출력 형식:',
    JSON.stringify({
      candidates: [{
        index: 0,
        provisionalJudgment: 'deductible | non_deductible | proration_required | taxable | zero_rated | exempt',
        confidence: 'medium | low',
        basisLabel: '판단 근거 한두 문장',
        missingFacts: ['부족한 사실'],
        hometaxAction: 'expected_no_change | review_deduction | review_sales_tax_type | add_or_correct_amount | review_proration | compare_in_hometax',
      }],
    }, null, 2),
    '',
    '검토 대상:',
    JSON.stringify(rows.map((row, index) => ({
      index,
      direction: row.direction,
      sourceType: row.sourceType,
      transactionDate: row.transactionDate,
      counterparty: redactPromptValue(row.counterparty),
      description: redactPromptValue(row.description),
      accountLabel: row.accountLabel ? redactPromptValue(row.accountLabel) : null,
      vatFact: row.currentVatFact,
      deterministicBasis: redactPromptValue(row.basisLabel),
      evidenceSearch: row.evidenceTrace.map((item) => ({
        source: item.source,
        status: item.status,
        summary: redactPromptValue(item.summary),
      })),
      missingFacts: row.missingFacts.map(redactPromptValue),
    })), null, 2),
  ].join('\n')
}

function configuredProvider(provider: AiProvider, environment: Record<string, string | undefined>) {
  if (provider === 'gemini') return Boolean(environment.GOOGLE_AI_API_KEY?.trim())
  if (provider === 'openai') return Boolean(environment.OPENAI_API_KEY?.trim())
  return Boolean(environment.ANTHROPIC_API_KEY?.trim())
}

export function resolveConfiguredVatTaxTreatmentProvider(
  environment: Record<string, string | undefined> = process.env,
): AiProvider | null {
  return getActiveAiProviderOrder().find((provider) => configuredProvider(provider, environment)) ?? null
}

export function resolveConfiguredVatTaxTreatmentProviders(
  environment: Record<string, string | undefined> = process.env,
): AiProvider[] {
  return getActiveAiProviderOrder().filter((provider) => configuredProvider(provider, environment))
}

async function runWithGemini(prompt: string): Promise<VatTaxTreatmentAiProviderResult> {
  const { requireGoogleAiEnv } = await import('@/lib/env')
  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const model = new GoogleGenerativeAI(GOOGLE_AI_API_KEY).getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: VAT_TAX_TREATMENT_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0,
      responseMimeType: 'application/json',
    },
  })
  const response = await model.generateContent(prompt)
  const parsed = parseAiResponse(response.response.text())
  return parsed.ok ? { ...parsed, modelName: GEMINI_ANALYSIS_MODEL } : parsed
}

async function runWithOpenAI(prompt: string): Promise<VatTaxTreatmentAiProviderResult> {
  const { requireOpenAiEnv } = await import('@/lib/env')
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const response = await new OpenAI({ apiKey: OPENAI_API_KEY }).chat.completions.create({
    model: OPENAI_ANALYSIS_MODEL,
    max_completion_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VAT_TAX_TREATMENT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  })
  const parsed = parseAiResponse(response.choices[0]?.message?.content ?? '')
  return parsed.ok ? { ...parsed, modelName: OPENAI_ANALYSIS_MODEL } : parsed
}

async function runWithClaude(prompt: string): Promise<VatTaxTreatmentAiProviderResult> {
  const { requireAnthropicEnv } = await import('@/lib/env')
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const response = await new Anthropic({ apiKey: ANTHROPIC_API_KEY }).messages.create({
    model: VAT_TAX_TREATMENT_CLAUDE_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: VAT_TAX_TREATMENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content.find((block) => block.type === 'text')
  const parsed = parseAiResponse(text?.type === 'text' ? text.text : '')
  return parsed.ok ? { ...parsed, modelName: VAT_TAX_TREATMENT_CLAUDE_MODEL } : parsed
}

async function defaultVatTaxTreatmentAiRunner(input: {
  provider: AiProvider
  prompt: string
}): Promise<VatTaxTreatmentAiProviderResult> {
  try {
    if (input.provider === 'gemini') return await runWithGemini(input.prompt)
    if (input.provider === 'openai') return await runWithOpenAI(input.prompt)
    return await runWithClaude(input.prompt)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('VAT AI timeout')), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isCompatibleCandidate(row: VatTaxTreatmentDisplayRow, candidate: VatTaxTreatmentAiCandidate) {
  const purchaseJudgments = new Set([
    'deductible',
    'non_deductible',
    'proration_required',
  ])
  const saleJudgments = new Set([
    'taxable',
    'zero_rated',
    'exempt',
  ])
  const purchaseActions = new Set([
    'expected_no_change',
    'review_deduction',
    'review_proration',
    'compare_in_hometax',
  ])
  const saleActions = new Set([
    'expected_no_change',
    'review_sales_tax_type',
    'add_or_correct_amount',
    'compare_in_hometax',
  ])

  return row.direction === 'purchase'
    ? purchaseJudgments.has(candidate.provisionalJudgment) && purchaseActions.has(candidate.hometaxAction)
    : saleJudgments.has(candidate.provisionalJudgment) && saleActions.has(candidate.hometaxAction)
}

function withAiStatus(
  row: VatTaxTreatmentDisplayRow,
  aiRuntimeStatus: VatTaxTreatmentDisplayRow['aiRuntimeStatus'],
) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    ...row,
    aiRuntimeStatus,
  }))
}

function withManualConsensusFallback(
  row: VatTaxTreatmentDisplayRow,
  aiRuntimeStatus: 'manual_fallback' | 'deferred',
) {
  const missingFacts = Array.from(new Set([
    ...row.missingFacts,
    aiRuntimeStatus === 'deferred'
      ? '고위험 AI 검토 대기'
      : 'AI 판단 불일치 또는 provider 응답 실패',
  ])).slice(0, 12)

  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    ...row,
    recommendation: 'needs_review',
    source: row.source === 'ai_single' || row.source === 'ai_consensus'
      ? 'deterministic_rule'
      : row.source,
    confidence: 'low',
    basisLabel: aiRuntimeStatus === 'deferred'
      ? '고위험 AI 검토 순서를 기다리고 있어 사용자가 직접 확인해야 합니다.'
      : '여러 AI가 같은 판단에 도달하지 못해 사용자가 직접 확인해야 합니다.',
    ruleReference: null,
    missingFacts,
    hometaxAction: row.direction === 'purchase' ? 'review_deduction' : 'review_sales_tax_type',
    aiTrace: null,
    aiRuntimeStatus,
  }))
}

export function withVatTaxTreatmentAiManualFallback(row: VatTaxTreatmentDisplayRow) {
  return withManualConsensusFallback(row, 'manual_fallback')
}

type ProviderBatchResult = {
  provider: AiProvider
  result: VatTaxTreatmentAiProviderResult
}

type ProviderCandidate = {
  provider: AiProvider
  modelName: string
  candidate: VatTaxTreatmentAiCandidate
}

function candidateSignature(candidate: VatTaxTreatmentAiCandidate) {
  return `${candidate.provisionalJudgment}|${candidate.hometaxAction}`
}

function providerCandidateAt(params: {
  entry: ProviderBatchResult
  index: number
  row: VatTaxTreatmentDisplayRow
}): ProviderCandidate | null {
  if (!params.entry.result.ok) return null
  const candidate = params.entry.result.data.candidates.find((item) => item.index === params.index)
  if (!candidate || !isCompatibleCandidate(params.row, candidate)) return null
  if (
    params.row.source === 'deterministic_rule'
    && params.row.confidence === 'high'
    && params.row.provisionalJudgment !== null
    && candidate.provisionalJudgment !== params.row.provisionalJudgment
  ) {
    return null
  }
  return {
    provider: params.entry.provider,
    modelName: params.entry.result.modelName,
    candidate,
  }
}

function agreeingCandidates(candidates: ProviderCandidate[]) {
  const groups = new Map<string, ProviderCandidate[]>()
  for (const candidate of candidates) {
    const signature = candidateSignature(candidate.candidate)
    groups.set(signature, [...(groups.get(signature) ?? []), candidate])
  }
  return [...groups.values()].find((group) => group.length >= 2) ?? null
}

function providerLabel(provider: AiProvider) {
  if (provider === 'gemini') return 'Gemini'
  if (provider === 'openai') return 'OpenAI'
  return 'Claude'
}

function applyConsensus(
  row: VatTaxTreatmentDisplayRow,
  candidates: ProviderCandidate[],
) {
  const first = candidates[0]!
  const providers = candidates.map((candidate) => candidate.provider)
  const basisPrefix = `${providers.map(providerLabel).join('·')} 합의`
  const missingFacts = Array.from(new Set(
    candidates.flatMap((candidate) => candidate.candidate.missingFacts.map(redactPromptValue)),
  )).slice(0, 12)
  const modelName = candidates
    .map((candidate) => `${candidate.provider}:${candidate.modelName}`)
    .join(' + ')
    .slice(0, 100)

  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    ...row,
    recommendation: recommendationForProvisionalJudgment(first.candidate.provisionalJudgment),
    source: 'ai_consensus',
    confidence: candidates.every((candidate) => candidate.candidate.confidence === 'medium')
      ? 'medium'
      : 'low',
    basisLabel: `${basisPrefix}: ${redactPromptValue(first.candidate.basisLabel)}`.slice(0, 500),
    ruleReference: null,
    missingFacts,
    hometaxAction: first.candidate.hometaxAction,
    aiTrace: {
      provider: providers.includes('claude') ? 'claude' : providers[0]!,
      modelName,
      promptVersion: VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
      consensusProviders: providers,
    },
    aiRuntimeStatus: 'completed',
  }))
}

async function runProviderBatch(params: {
  provider: AiProvider
  prompt: string
  runner: VatTaxTreatmentAiRunner
  timeoutMs: number
}): Promise<ProviderBatchResult> {
  try {
    return {
      provider: params.provider,
      result: await runWithTimeout(
        params.runner({ provider: params.provider, prompt: params.prompt }),
        params.timeoutMs,
      ),
    }
  } catch {
    return { provider: params.provider, result: { ok: false, error: 'VAT AI timeout' } }
  }
}

export async function enhanceHighRiskVatTaxTreatmentRowsWithConsensus(params: {
  rows: VatTaxTreatmentDisplayRow[]
  providers?: AiProvider[]
  runner?: VatTaxTreatmentAiRunner
  timeoutMs?: number
  batchSize?: number
}): Promise<VatTaxTreatmentDisplayRow[]> {
  const eligibleRows = params.rows.filter(isHighRiskVatTaxTreatmentRow)
  if (eligibleRows.length === 0) return params.rows

  const batchSize = Math.max(1, Math.min(
    params.batchSize ?? VAT_TAX_TREATMENT_AI_BATCH_SIZE,
    VAT_TAX_TREATMENT_AI_BATCH_SIZE,
  ))
  const selectedRows = eligibleRows.slice(0, batchSize)
  const selectedIds = new Set(selectedRows.map((row) => row.rowId))
  const deferredIds = new Set(eligibleRows.slice(batchSize).map((row) => row.rowId))
  const providers = Array.from(new Set(
    params.providers ?? resolveConfiguredVatTaxTreatmentProviders(),
  ))
  const primaryProviders = providers.filter((provider) => provider === 'gemini' || provider === 'openai')
  const runner = params.runner ?? defaultVatTaxTreatmentAiRunner
  const timeoutMs = params.timeoutMs ?? VAT_TAX_TREATMENT_AI_TIMEOUT_MS

  if (primaryProviders.length === 0) {
    return params.rows.map((row) => {
      if (selectedIds.has(row.rowId)) return withManualConsensusFallback(row, 'manual_fallback')
      if (deferredIds.has(row.rowId)) return withManualConsensusFallback(row, 'deferred')
      return row
    })
  }

  const prompt = buildVatTaxTreatmentAiPrompt(selectedRows)
  const primaryResults = await Promise.all(primaryProviders.map((provider) => runProviderBatch({
    provider,
    prompt,
    runner,
    timeoutMs,
  })))
  const needsClaude = selectedRows.some((row, index) => {
    const candidates = primaryResults
      .map((entry) => providerCandidateAt({ entry, index, row }))
      .filter((candidate): candidate is ProviderCandidate => candidate !== null)
    return agreeingCandidates(candidates) === null
  })
  const claudeResult = needsClaude && providers.includes('claude')
    ? await runProviderBatch({ provider: 'claude', prompt, runner, timeoutMs })
    : null

  return params.rows.map((row) => {
    if (deferredIds.has(row.rowId)) return withManualConsensusFallback(row, 'deferred')
    const index = selectedRows.findIndex((selected) => selected.rowId === row.rowId)
    if (index === -1) return row

    const primaryCandidates = primaryResults
      .map((entry) => providerCandidateAt({ entry, index, row }))
      .filter((candidate): candidate is ProviderCandidate => candidate !== null)
    const primaryAgreement = agreeingCandidates(primaryCandidates)
    if (primaryAgreement) return applyConsensus(row, primaryAgreement)

    const claudeCandidate = claudeResult
      ? providerCandidateAt({ entry: claudeResult, index, row })
      : null
    const finalAgreement = agreeingCandidates([
      ...primaryCandidates,
      ...(claudeCandidate ? [claudeCandidate] : []),
    ])
    return finalAgreement
      ? applyConsensus(row, finalAgreement)
      : withManualConsensusFallback(row, 'manual_fallback')
  })
}

export async function enhanceVatTaxTreatmentRowsWithSingleAi(params: {
  rows: VatTaxTreatmentDisplayRow[]
  provider?: AiProvider | null
  runner?: VatTaxTreatmentAiRunner
  timeoutMs?: number
  batchSize?: number
}): Promise<VatTaxTreatmentDisplayRow[]> {
  const eligibleRows = params.rows.filter((row) => (
    row.recommendation === 'needs_review'
    && row.finalDecision === null
    && row.aiRuntimeStatus === 'not_requested'
  ))
  if (eligibleRows.length === 0) return params.rows

  const batchSize = Math.max(1, Math.min(params.batchSize ?? VAT_TAX_TREATMENT_AI_BATCH_SIZE, VAT_TAX_TREATMENT_AI_BATCH_SIZE))
  const selectedRows = eligibleRows.slice(0, batchSize)
  const selectedIds = new Set(selectedRows.map((row) => row.rowId))
  const deferredIds = new Set(eligibleRows.slice(batchSize).map((row) => row.rowId))
  const provider = params.provider === undefined
    ? resolveConfiguredVatTaxTreatmentProvider()
    : params.provider

  if (!provider) {
    return params.rows.map((row) => {
      if (selectedIds.has(row.rowId)) return withAiStatus(row, 'manual_fallback')
      if (deferredIds.has(row.rowId)) return withAiStatus(row, 'deferred')
      return row
    })
  }

  const runner = params.runner ?? defaultVatTaxTreatmentAiRunner
  let result: VatTaxTreatmentAiProviderResult
  try {
    result = await runWithTimeout(
      runner({ provider, prompt: buildVatTaxTreatmentAiPrompt(selectedRows) }),
      params.timeoutMs ?? VAT_TAX_TREATMENT_AI_TIMEOUT_MS,
    )
  } catch {
    result = { ok: false, error: 'VAT AI timeout' }
  }

  if (!result.ok) {
    return params.rows.map((row) => {
      if (selectedIds.has(row.rowId)) return withAiStatus(row, 'manual_fallback')
      if (deferredIds.has(row.rowId)) return withAiStatus(row, 'deferred')
      return row
    })
  }

  const candidateByIndex = new Map(result.data.candidates.map((candidate) => [candidate.index, candidate]))
  return params.rows.map((row) => {
    if (deferredIds.has(row.rowId)) return withAiStatus(row, 'deferred')
    const index = selectedRows.findIndex((selected) => selected.rowId === row.rowId)
    if (index === -1) return row

    const candidate = candidateByIndex.get(index)
    if (!candidate || !isCompatibleCandidate(row, candidate)) {
      return withAiStatus(row, 'manual_fallback')
    }

    return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
      ...row,
      recommendation: recommendationForProvisionalJudgment(candidate.provisionalJudgment),
      source: 'ai_single',
      confidence: candidate.confidence,
      basisLabel: redactPromptValue(candidate.basisLabel),
      ruleReference: null,
      missingFacts: candidate.missingFacts.map(redactPromptValue),
      hometaxAction: candidate.hometaxAction,
      aiTrace: {
        provider,
        modelName: result.modelName,
        promptVersion: VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
        consensusProviders: [],
      },
      aiRuntimeStatus: 'completed',
    }))
  })
}

export async function enhanceVatTaxTreatmentRowsWithAi(params: {
  rows: VatTaxTreatmentDisplayRow[]
  singleProvider?: AiProvider | null
  consensusProviders?: AiProvider[]
  runner?: VatTaxTreatmentAiRunner
  timeoutMs?: number
  batchSize?: number
}): Promise<VatTaxTreatmentDisplayRow[]> {
  const consensusRows = await enhanceHighRiskVatTaxTreatmentRowsWithConsensus({
    rows: params.rows,
    providers: params.consensusProviders,
    runner: params.runner,
    timeoutMs: params.timeoutMs,
    batchSize: params.batchSize,
  })
  const singleRows = await enhanceVatTaxTreatmentRowsWithSingleAi({
    rows: consensusRows,
    provider: params.singleProvider,
    runner: params.runner,
    timeoutMs: params.timeoutMs,
    batchSize: params.batchSize,
  })

  return enhanceHighRiskVatTaxTreatmentRowsWithConsensus({
    rows: singleRows,
    providers: params.consensusProviders,
    runner: params.runner,
    timeoutMs: params.timeoutMs,
    batchSize: params.batchSize,
  })
}

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { z } from 'zod'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import type { PayrollPolicyReviewWarningCandidate } from '@/lib/payroll/internal-policy-notes'

const CLAUDE_POLICY_REVIEW_MODEL = 'claude-sonnet-4-6'
const OPENAI_POLICY_REVIEW_MODEL = OPENAI_ANALYSIS_MODEL

const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
}

const SYSTEM_PROMPT = [
  'You review internal payroll policy notes for JARYO.',
  'Return JSON only.',
  'Do not calculate or apply payroll amounts automatically.',
  'Your job is to explain what the staff should verify before applying the policy.',
  'If evidence is insufficient, clearly list missing information.',
].join('\n')

export const payrollPolicyReviewResponseSchema = z.object({
  candidateType: z.enum([
    'long_term_business_trip_allowance',
    'year_end_tax_settlement_installment',
    'company_organization_metadata',
    'other',
  ]),
  classification: z.enum([
    'company_policy',
    'metadata_reference',
    'worksheet_instruction',
    'not_relevant',
    'uncertain',
  ]),
  summaryForStaff: z.string().min(1),
  possiblePayrollImpact: z.string().min(1),
  missingInformation: z.array(z.string()).default([]),
  recommendedAction: z.string().min(1),
  canAutoApply: z.boolean().default(false),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceEvidenceUsed: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
})

export type PayrollPolicyReviewResponse = z.infer<typeof payrollPolicyReviewResponseSchema>

export type PayrollPolicyReviewProviderResult =
  | { success: true; provider: AiProvider; data: PayrollPolicyReviewResponse }
  | { success: false; provider: AiProvider; error: string; rawOutput?: string }

export type PayrollPolicyReviewRunner = (input: {
  provider: AiProvider
  candidate: PayrollPolicyReviewWarningCandidate
  payrollPeriod: string
}) => Promise<PayrollPolicyReviewProviderResult>

export type PayrollPolicyReviewFallbackResult = {
  reviews: Array<PayrollPolicyReviewResponse & {
    candidateId: string
    provider: AiProvider
    candidateTitle: string
  }>
  warnings: string[]
}

function extractJson(rawOutput: string): string | null {
  const trimmed = rawOutput.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] ?? null
}

function normalizeProviderError(error: string): string {
  return error.replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function normalizePayrollPolicyReviewResponse(
  response: PayrollPolicyReviewResponse,
): PayrollPolicyReviewResponse {
  if (!response.canAutoApply) return response

  return {
    ...response,
    canAutoApply: false,
    warnings: [
      ...response.warnings,
      'AI가 자동 반영 가능하다고 응답했지만, JARYO는 정책 메모를 자동 계산에 반영하지 않습니다.',
    ],
  }
}

const STAFF_COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdomesticTravelAllowance\b/g, '국내출장수당'],
  [/\bretroactivePay\b/g, '소급 지급 항목'],
  [/\botherAllowance\b/g, '기타수당'],
  [/\bdeductionAmount\b/g, '공제액'],
  [/\bbaseSalary\b/g, '기본급'],
  [/\bemployeeCode\b/g, '직원 코드'],
  [/\bemployeeName\b/g, '직원명'],
]

export function sanitizePayrollPolicyReviewStaffCopy(value: string) {
  return STAFF_COPY_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  )
}

function sanitizePayrollPolicyReviewList(values: string[]) {
  return values.map(sanitizePayrollPolicyReviewStaffCopy)
}

export function parsePayrollPolicyReviewOutput(
  rawOutput: string,
): { success: true; data: PayrollPolicyReviewResponse } | { success: false; error: string; rawOutput: string } {
  const json = extractJson(rawOutput)
  if (!json) return { success: false, error: 'AI 정책 검토 응답에서 JSON을 찾을 수 없습니다', rawOutput }

  try {
    const parsed = payrollPolicyReviewResponseSchema.safeParse(JSON.parse(json))
    if (!parsed.success) {
      return { success: false, error: `AI 정책 검토 응답 스키마 검증 실패: ${parsed.error.message}`, rawOutput }
    }
    return { success: true, data: normalizePayrollPolicyReviewResponse(parsed.data) }
  } catch (error) {
    return { success: false, error: `AI 정책 검토 JSON 파싱 실패: ${(error as Error).message}`, rawOutput }
  }
}

function buildPolicyReviewPrompt(candidate: PayrollPolicyReviewWarningCandidate, payrollPeriod: string) {
  return [
    `급여 기간: ${payrollPeriod}`,
    `후보 유형: ${candidate.type}`,
    `후보 제목: ${candidate.title}`,
    '',
    '후보 요약:',
    candidate.summary,
    '',
    '근거:',
    ...candidate.evidence.map((line) => `- ${line}`),
    '',
    '아래 JSON 형식으로만 답하세요.',
    JSON.stringify({
      candidateType: candidate.type,
      classification: 'company_policy',
      summaryForStaff: '담당자가 이해할 수 있는 한 문장 요약',
      possiblePayrollImpact: '급여 항목에 영향을 줄 수 있는 방식',
      missingInformation: ['대상자', '금액 또는 계산 기준'],
      recommendedAction: '담당자가 확인할 다음 행동',
      canAutoApply: false,
      confidence: 'medium',
      sourceEvidenceUsed: candidate.evidence,
      warnings: [],
    }, null, 2),
  ].join('\n')
}

async function reviewWithGemini(
  candidate: PayrollPolicyReviewWarningCandidate,
  payrollPeriod: string,
): Promise<PayrollPolicyReviewProviderResult> {
  const { isGeminiEnabled, requireGoogleAiEnv } = await import('@/lib/env')
  if (!isGeminiEnabled()) {
    return { success: false, provider: 'gemini', error: 'Gemini provider is disabled (GEMINI_ENABLED=false)' }
  }

  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const model = new GoogleGenerativeAI(GOOGLE_AI_API_KEY).getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  let rawOutput = ''
  try {
    const response = await model.generateContent(buildPolicyReviewPrompt(candidate, payrollPeriod))
    rawOutput = response.response.text()
    const parsed = parsePayrollPolicyReviewOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'gemini', data: parsed.data }
      : { success: false, provider: 'gemini', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'gemini', error: (error as Error).message, rawOutput }
  }
}

async function reviewWithOpenAI(
  candidate: PayrollPolicyReviewWarningCandidate,
  payrollPeriod: string,
): Promise<PayrollPolicyReviewProviderResult> {
  const { requireOpenAiEnv } = await import('@/lib/env')
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  let rawOutput = ''
  try {
    const response = await client.chat.completions.create({
      model: OPENAI_POLICY_REVIEW_MODEL,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPolicyReviewPrompt(candidate, payrollPeriod) },
      ],
    })
    rawOutput = response.choices[0]?.message?.content ?? ''
    const parsed = parsePayrollPolicyReviewOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'openai', data: parsed.data }
      : { success: false, provider: 'openai', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'openai', error: (error as Error).message, rawOutput }
  }
}

async function reviewWithClaude(
  candidate: PayrollPolicyReviewWarningCandidate,
  payrollPeriod: string,
): Promise<PayrollPolicyReviewProviderResult> {
  const { requireAnthropicEnv } = await import('@/lib/env')
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let rawOutput = ''
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_POLICY_REVIEW_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPolicyReviewPrompt(candidate, payrollPeriod) }],
    })
    rawOutput = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
    const parsed = parsePayrollPolicyReviewOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'claude', data: parsed.data }
      : { success: false, provider: 'claude', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'claude', error: (error as Error).message, rawOutput }
  }
}

async function defaultPolicyReviewRunner(input: {
  provider: AiProvider
  candidate: PayrollPolicyReviewWarningCandidate
  payrollPeriod: string
}): Promise<PayrollPolicyReviewProviderResult> {
  if (input.provider === 'gemini') return reviewWithGemini(input.candidate, input.payrollPeriod)
  if (input.provider === 'openai') return reviewWithOpenAI(input.candidate, input.payrollPeriod)
  return reviewWithClaude(input.candidate, input.payrollPeriod)
}

export function formatPayrollPolicyReviewWarning(input: {
  candidate: PayrollPolicyReviewWarningCandidate
  provider: AiProvider
  review: PayrollPolicyReviewResponse
}) {
  return formatPayrollPolicyReviewSummary([
    { candidate: input.candidate, review: input.review },
  ])
}

const POLICY_MISSING_REASON_BY_TYPE: Partial<Record<PayrollPolicyReviewWarningCandidate['type'], string>> = {
  long_term_business_trip_allowance: '대상 직원, 출장 기간, 계산 기준',
  year_end_tax_settlement_installment: '직원별 정산액과 월별 분할 금액',
}

type PayrollPolicyReviewSummaryItem = {
  candidate: PayrollPolicyReviewWarningCandidate
  review?: PayrollPolicyReviewResponse
}

function formatMissingInformationReason(item: PayrollPolicyReviewSummaryItem) {
  const defaultReason = POLICY_MISSING_REASON_BY_TYPE[item.candidate.type]
  if (defaultReason) return defaultReason

  const sanitized = sanitizePayrollPolicyReviewList(item.review?.missingInformation ?? [])
    .filter((value) => value.trim().length > 0)

  return sanitized.length > 0 ? sanitized.join(', ') : '반영에 필요한 정보'
}

function formatMissingInformationSentence(reason: string) {
  if (reason === '반영에 필요한 정보') return '반영에 필요한 정보가 부족해 반영하지 않았습니다.'
  return `${reason}이 부족해 반영하지 않았습니다.`
}

export function formatPayrollPolicyReviewSummary(items: PayrollPolicyReviewSummaryItem[]) {
  if (items.length === 0) return ''

  const lines = items.map((item) => {
    const reason = formatMissingInformationReason(item)
    return `- ${item.candidate.title}: ${formatMissingInformationSentence(reason)}`
  })

  return [
    `사내 규칙 ${items.length}건은 자동 반영하지 않았습니다.`,
    '',
    ...lines,
  ].join('\n')
}

export async function reviewPayrollPolicyCandidatesWithProviderFallback(
  candidates: PayrollPolicyReviewWarningCandidate[],
  payrollPeriod: string,
  options: { runner?: PayrollPolicyReviewRunner; providers?: AiProvider[] } = {},
): Promise<PayrollPolicyReviewFallbackResult> {
  const runner = options.runner ?? defaultPolicyReviewRunner
  const providers = options.providers ?? getActiveAiProviderOrder()
  const reviews: PayrollPolicyReviewFallbackResult['reviews'] = []
  const summaryItems: PayrollPolicyReviewSummaryItem[] = []

  for (const candidate of candidates.filter((item) => item.aiReviewRecommended)) {
    const failedProviderLabels: string[] = []
    let reviewed = false

    for (const provider of providers) {
      const result = await runner({ provider, candidate, payrollPeriod }).catch((error: unknown) => ({
        success: false as const,
        provider,
        error: error instanceof Error ? error.message : String(error),
      }))

      if (result.success) {
        reviews.push({
          ...result.data,
          candidateId: candidate.id,
          provider,
          candidateTitle: candidate.title,
        })
        summaryItems.push({ candidate, review: result.data })
        reviewed = true
        break
      }

      console.warn(
        `[payroll-policy-review] ${PROVIDER_LABELS[provider]} 검토 실패:`,
        normalizeProviderError(result.error),
      )
      failedProviderLabels.push(PROVIDER_LABELS[provider])
    }

    if (!reviewed) {
      summaryItems.push({ candidate })
    }
  }

  const summary = formatPayrollPolicyReviewSummary(summaryItems)
  return { reviews, warnings: summary ? [summary] : [] }
}

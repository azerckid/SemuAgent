import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import {
  redactAndBoundReviewAdaptiveSampleRows,
  redactReviewAdaptiveSampleValue,
  REVIEW_ADAPTIVE_SAMPLE_ROW_MAX_COUNT,
} from '@/lib/reviews/adaptive-structuring-proposal-redaction'
import {
  reviewAdaptiveStructuringProposalResponseSchema,
  REVIEW_ADAPTIVE_TARGET_FIELDS,
  type ReviewAdaptiveStructuringProposalResponse,
} from '@/lib/reviews/adaptive-structuring-proposal-schema'

const CLAUDE_PROPOSAL_MODEL = 'claude-sonnet-4-6'
const OPENAI_PROPOSAL_MODEL = OPENAI_ANALYSIS_MODEL
const MAX_PROMPT_TEXT_CHARS = 40000

export type ReviewAdaptiveSourceText = {
  filename: string
  text: string | null
  summary: string | null
  chunkIndex?: number
  chunkTotal?: number
  sheetName?: string
  rowStart?: number
  rowEnd?: number
}

// spec #11과 동일한 원칙: registry(이후 슬라이스)에 저장될 모델 row가 어떤 프롬프트
// 기준으로 제안됐는지 추적한다.
export const REVIEW_ADAPTIVE_STRUCTURING_PROMPT_VERSION = 'review-adaptive-structuring-v1'

const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
}

const SYSTEM_PROMPT = [
  'You propose a reusable structure for a bookkeeping/material-review workbook that the existing JARYO review pipeline could not automatically link to a known checklist item.',
  'Return JSON only, matching the requested shape exactly.',
  'You are proposing a structure, not making a final bookkeeping decision. Do not invent rows or values that are not visible in the source text.',
  'Separate row-shaped transaction data from metadata, internal policy notes, and already-calculated result-only sections.',
  'If the workbook has separate deposit/income and withdrawal/expense amount columns, map them to incomeAmountKrw and expenseAmountKrw respectively instead of a single amountKrw column. Only use the generic amountKrw field when there is just one amount column and you cannot tell whether it represents income or expense from the column structure itself. Never guess the direction from wording alone when the column structure does not support it.',
  'Never copy resident registration numbers, phone numbers, or bank account numbers into your output, even in sample rows.',
  'If the workbook is not plausible transaction-level business data, set status to not_eligible and explain why.',
  'If you cannot determine the structure confidently, set status to needs_more_information and list what is missing.',
].join('\n')

export type ReviewAdaptiveStructuringProposalProviderResult =
  | { success: true; provider: AiProvider; data: ReviewAdaptiveStructuringProposalResponse }
  | { success: false; provider: AiProvider; error: string; rawOutput?: string }

export type ReviewAdaptiveStructuringProposalRunner = (input: {
  provider: AiProvider
  fileTexts: ReviewAdaptiveSourceText[]
}) => Promise<ReviewAdaptiveStructuringProposalProviderResult>

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

function buildSourceTextBlock(fileTexts: ReviewAdaptiveSourceText[]): string {
  const blocks = fileTexts
    .filter((fileText) => fileText.text)
    .map((fileText) => [
      `### 파일: ${fileText.filename}${fileText.sheetName ? ` / 시트: ${fileText.sheetName}` : ''}`,
      // 응답 마스킹(parseReviewAdaptiveStructuringProposalOutput)과 별개로, AI에 보내는
      // 워크북 원문 자체도 주민번호/전화번호/계좌번호 패턴을 먼저 가린다.
      redactReviewAdaptiveSampleValue(fileText.text!),
    ].join('\n'))

  const combined = blocks.join('\n\n')
  if (combined.length <= MAX_PROMPT_TEXT_CHARS) return combined

  return [
    combined.slice(0, MAX_PROMPT_TEXT_CHARS),
    '',
    '[이하 생략: 원본 텍스트가 길어 앞부분만 전달됨]',
  ].join('\n')
}

export function buildReviewAdaptiveStructuringProposalPrompt(fileTexts: ReviewAdaptiveSourceText[]): string {
  return [
    '아래는 기존 자료검토 로직이 요청자료 항목에 자동 연결하지 못한 워크북의 시트별 텍스트입니다.',
    '',
    buildSourceTextBlock(fileTexts),
    '',
    `사용 가능한 targetField 값: ${REVIEW_ADAPTIVE_TARGET_FIELDS.join(', ')}`,
    '',
    '아래 JSON 형식으로만 답하세요.',
    JSON.stringify({
      status: 'proposal_ready',
      reason: '담당자가 이해할 수 있는 한 문장 요약',
      candidateSheets: [
        { sheetName: '시트명', role: 'transaction_detail', confidence: 0.8 },
      ],
      proposedMappings: [
        {
          sheetName: '시트명',
          sourceColumn: '컬럼 헤더 텍스트',
          targetField: 'transactionDate',
          required: true,
          confidence: 'high',
          notes: '선택',
        },
      ],
      sampleRows: [
        { sheetName: '시트명', sourceRowRef: '예: row 5', values: { counterparty: '거래처A' } },
      ],
      ignoredRegions: [
        { sheetName: '시트명', sourceColumnOrRegion: '예: A1:C3', reason: 'metadata' },
      ],
      missingRequiredFields: [],
      warnings: [],
    }, null, 2),
  ].join('\n')
}

export function parseReviewAdaptiveStructuringProposalOutput(
  rawOutput: string,
): { success: true; data: ReviewAdaptiveStructuringProposalResponse } | { success: false; error: string; rawOutput: string } {
  const json = extractJson(rawOutput)
  if (!json) return { success: false, error: '구조화 제안 응답에서 JSON을 찾을 수 없습니다', rawOutput }

  try {
    const parsed = reviewAdaptiveStructuringProposalResponseSchema.safeParse(JSON.parse(json))
    if (!parsed.success) {
      return { success: false, error: `구조화 제안 응답 스키마 검증 실패: ${parsed.error.message}`, rawOutput }
    }
    return {
      success: true,
      data: {
        ...parsed.data,
        sampleRows: redactAndBoundReviewAdaptiveSampleRows(
          parsed.data.sampleRows,
          REVIEW_ADAPTIVE_SAMPLE_ROW_MAX_COUNT,
        ),
      },
    }
  } catch (error) {
    return { success: false, error: `구조화 제안 JSON 파싱 실패: ${(error as Error).message}`, rawOutput }
  }
}

async function proposeWithGemini(
  fileTexts: ReviewAdaptiveSourceText[],
): Promise<ReviewAdaptiveStructuringProposalProviderResult> {
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
    const response = await model.generateContent(buildReviewAdaptiveStructuringProposalPrompt(fileTexts))
    rawOutput = response.response.text()
    const parsed = parseReviewAdaptiveStructuringProposalOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'gemini', data: parsed.data }
      : { success: false, provider: 'gemini', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'gemini', error: (error as Error).message, rawOutput }
  }
}

async function proposeWithOpenAI(
  fileTexts: ReviewAdaptiveSourceText[],
): Promise<ReviewAdaptiveStructuringProposalProviderResult> {
  const { requireOpenAiEnv } = await import('@/lib/env')
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  let rawOutput = ''
  try {
    const response = await client.chat.completions.create({
      model: OPENAI_PROPOSAL_MODEL,
      max_completion_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildReviewAdaptiveStructuringProposalPrompt(fileTexts) },
      ],
    })
    rawOutput = response.choices[0]?.message?.content ?? ''
    const parsed = parseReviewAdaptiveStructuringProposalOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'openai', data: parsed.data }
      : { success: false, provider: 'openai', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'openai', error: (error as Error).message, rawOutput }
  }
}

async function proposeWithClaude(
  fileTexts: ReviewAdaptiveSourceText[],
): Promise<ReviewAdaptiveStructuringProposalProviderResult> {
  const { requireAnthropicEnv } = await import('@/lib/env')
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let rawOutput = ''
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_PROPOSAL_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildReviewAdaptiveStructuringProposalPrompt(fileTexts) }],
    })
    rawOutput = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
    const parsed = parseReviewAdaptiveStructuringProposalOutput(rawOutput)
    return parsed.success
      ? { success: true, provider: 'claude', data: parsed.data }
      : { success: false, provider: 'claude', error: parsed.error, rawOutput: parsed.rawOutput }
  } catch (error) {
    return { success: false, provider: 'claude', error: (error as Error).message, rawOutput }
  }
}

async function defaultProposalRunner(input: {
  provider: AiProvider
  fileTexts: ReviewAdaptiveSourceText[]
}): Promise<ReviewAdaptiveStructuringProposalProviderResult> {
  if (input.provider === 'gemini') return proposeWithGemini(input.fileTexts)
  if (input.provider === 'openai') return proposeWithOpenAI(input.fileTexts)
  return proposeWithClaude(input.fileTexts)
}

function failClosedProposal(reason: string): ReviewAdaptiveStructuringProposalResponse {
  return {
    status: 'needs_more_information',
    reason,
    candidateSheets: [],
    proposedMappings: [],
    sampleRows: [],
    ignoredRegions: [],
    missingRequiredFields: [],
    warnings: ['AI 구조화 제안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'],
  }
}

export async function generateReviewAdaptiveStructuringProposal(
  fileTexts: ReviewAdaptiveSourceText[],
  options: { runner?: ReviewAdaptiveStructuringProposalRunner; providers?: AiProvider[] } = {},
): Promise<{ data: ReviewAdaptiveStructuringProposalResponse; provider: AiProvider | null }> {
  const runner = options.runner ?? defaultProposalRunner
  const providers = options.providers ?? getActiveAiProviderOrder()

  for (const provider of providers) {
    const result = await runner({ provider, fileTexts }).catch((error: unknown) => ({
      success: false as const,
      provider,
      error: error instanceof Error ? error.message : String(error),
    }))

    if (result.success) {
      return { data: result.data, provider }
    }

    console.warn(
      `[review-adaptive-structuring-propose] ${PROVIDER_LABELS[provider]} 제안 생성 실패:`,
      normalizeProviderError(result.error),
    )
  }

  return { data: failClosedProposal('AI 제안 생성에 실패해 구조를 판단하지 못했습니다.'), provider: null }
}

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { requireAnthropicEnv, requireGoogleAiEnv, requireOpenAiEnv } from '@/lib/env'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { formatBookkeepingCategoryNotes } from './account-categories'
import {
  bookkeepingClassificationAiOutputSchema,
  type BookkeepingClassificationAiOutput,
  type TransactionCandidate,
} from './schemas'

export const BOOKKEEPING_CLASSIFICATION_MODEL = 'claude-sonnet-4-6'
export const BOOKKEEPING_CLASSIFICATION_OPENAI_MODEL = OPENAI_ANALYSIS_MODEL

function extractJsonFromResponse(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) return fenced[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return text.slice(first, last + 1)
}

function buildPrompt(params: {
  accountingPeriod: string
  categoryNotes: string
  candidates: TransactionCandidate[]
}) {
  return [
    '다음은 회계사무소 SaaS의 기장 자료에서 추출한 거래 후보입니다.',
    '각 거래에 대해 한국 기장 업무에서 사용할 계정항목을 추천하세요.',
    '',
    '중요 규칙:',
    '- 세무 자문이나 최종 신고 판단을 하지 마세요.',
    '- 확실하지 않으면 recommendedAccount는 unclassified, confidence는 low로 두세요.',
    '- 거래별 추천 근거는 짧게 쓰세요.',
    '- 출력은 JSON 하나만 반환하세요.',
    '',
    `회계기간: ${params.accountingPeriod}`,
    '',
    '사용 가능한 계정항목:',
    params.categoryNotes,
    '',
    '출력 스키마:',
    JSON.stringify({
      transactions: [{
        sourceFileId: 'upload_file.id',
        sourceType: 'bank | card | receipt | tax_invoice | other',
        transactionDate: 'YYYY-MM-DD 또는 원문 날짜',
        merchantName: '거래처',
        description: '적요',
        amountKrw: 10000,
        direction: 'income | expense | unknown',
        recommendedAccount: 'built-in key',
        confidence: 'high | medium | low',
        reason: '추천 근거',
        evidence: { fieldsUsed: ['거래처', '적요'], needsStaffDecision: false },
      }],
    }, null, 2),
    '',
    '거래 후보:',
    JSON.stringify(params.candidates, null, 2),
  ].join('\n')
}

export async function classifyBookkeepingTransactionsWithClaude(params: {
  accountingPeriod: string
  candidates: TransactionCandidate[]
}): Promise<{
  rawOutput: string
  data: BookkeepingClassificationAiOutput
}> {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const categoryNotes = formatBookkeepingCategoryNotes()
  const prompt = buildPrompt({
    accountingPeriod: params.accountingPeriod,
    categoryNotes,
    candidates: params.candidates,
  })

  const response = await client.messages.create({
    model: BOOKKEEPING_CLASSIFICATION_MODEL,
    max_tokens: 8192,
    system: 'You return strict JSON for bookkeeping transaction account classification.',
    messages: [{ role: 'user', content: prompt }],
  })

  const rawOutput = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const json = extractJsonFromResponse(rawOutput)
  if (!json) {
    throw new Error('계정항목 추천 JSON을 찾을 수 없습니다')
  }

  const parsed = bookkeepingClassificationAiOutputSchema.safeParse(JSON.parse(json))
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }

  return { rawOutput, data: parsed.data }
}

export async function classifyBookkeepingTransactionsWithGemini(params: {
  accountingPeriod: string
  candidates: TransactionCandidate[]
}): Promise<{
  rawOutput: string
  data: BookkeepingClassificationAiOutput
  modelName: string
}> {
  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
  const categoryNotes = formatBookkeepingCategoryNotes()
  const prompt = buildPrompt({
    accountingPeriod: params.accountingPeriod,
    categoryNotes,
    candidates: params.candidates,
  })

  const model = genAI.getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: 'You return strict JSON for bookkeeping transaction account classification.',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const response = await model.generateContent(prompt)
  const rawOutput = response.response.text()
  const json = extractJsonFromResponse(rawOutput)
  if (!json) {
    throw new Error('Gemini 계정항목 추천 JSON을 찾을 수 없습니다')
  }

  const parsed = bookkeepingClassificationAiOutputSchema.safeParse(JSON.parse(json))
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }

  return { rawOutput, data: parsed.data, modelName: GEMINI_ANALYSIS_MODEL }
}

export async function classifyBookkeepingTransactionsWithOpenAI(params: {
  accountingPeriod: string
  candidates: TransactionCandidate[]
}): Promise<{
  rawOutput: string
  data: BookkeepingClassificationAiOutput
}> {
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })
  const categoryNotes = formatBookkeepingCategoryNotes()
  const prompt = buildPrompt({
    accountingPeriod: params.accountingPeriod,
    categoryNotes,
    candidates: params.candidates,
  })

  const response = await client.chat.completions.create({
    model: BOOKKEEPING_CLASSIFICATION_OPENAI_MODEL,
    // GPT-5 계열은 max_tokens 대신 max_completion_tokens를 요구한다.
    // reasoning 토큰이 출력 한도에 포함되므로 여유를 더 둔다.
    max_completion_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You return strict JSON for bookkeeping transaction account classification.' },
      { role: 'user', content: prompt },
    ],
  })

  const rawOutput = response.choices[0]?.message?.content ?? ''
  const json = extractJsonFromResponse(rawOutput)
  if (!json) {
    throw new Error('OpenAI 계정항목 추천 JSON을 찾을 수 없습니다')
  }

  const parsed = bookkeepingClassificationAiOutputSchema.safeParse(JSON.parse(json))
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }

  return { rawOutput, data: parsed.data }
}

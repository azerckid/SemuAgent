import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { getActiveAiProviderOrder } from '@/lib/ai/provider-order'
import { requireAnthropicEnv, requireGoogleAiEnv, requireOpenAiEnv, isGeminiEnabled } from '@/lib/env'
import {
  ruleTransformResponseSchema,
  type RuleTransformResponse,
  type StructureRulesResult,
} from './rule-profile-nl-transform'
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
  type PayrollRuleStructureSourceKind,
} from './rule-profile-nl-prompt'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

function parseAiJson(raw: string): RuleTransformResponse | null {
  let parsed: unknown
  try {
    const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }
  const result = ruleTransformResponseSchema.safeParse(parsed)
  return result.success ? result.data : null
}

async function structureWithGemini(
  sourceText: string,
  sourceKind: PayrollRuleStructureSourceKind,
): Promise<StructureRulesResult> {
  if (!isGeminiEnabled()) return { success: false, error: 'Gemini disabled' }
  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const model = new GoogleGenerativeAI(GOOGLE_AI_API_KEY).getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })
  const response = await model.generateContent(buildUserPrompt(sourceText, sourceKind))
  const data = parseAiJson(response.response.text())
  return data
    ? { success: true, data, model: `gemini:${GEMINI_ANALYSIS_MODEL}` }
    : { success: false, error: 'Gemini 응답 형식 오류' }
}

async function structureWithOpenAI(
  sourceText: string,
  sourceKind: PayrollRuleStructureSourceKind,
): Promise<StructureRulesResult> {
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })
  const response = await client.chat.completions.create({
    model: OPENAI_ANALYSIS_MODEL,
    max_completion_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(sourceText, sourceKind) },
    ],
  })
  const data = parseAiJson(response.choices[0]?.message?.content ?? '')
  return data
    ? { success: true, data, model: `openai:${OPENAI_ANALYSIS_MODEL}` }
    : { success: false, error: 'OpenAI 응답 형식 오류' }
}

async function structureWithClaude(
  sourceText: string,
  sourceKind: PayrollRuleStructureSourceKind,
): Promise<StructureRulesResult> {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(sourceText, sourceKind) }],
  })
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
  const data = parseAiJson(text)
  return data
    ? { success: true, data, model: `claude:${CLAUDE_MODEL}` }
    : { success: false, error: 'Claude 응답 형식 오류' }
}

/** provider 순서(Gemini→OpenAI→Claude)대로 시도해 첫 Zod 통과 결과를 반환. */
export async function structurePayrollRulesWithProviderFallback(
  sourceText: string,
  sourceKind: PayrollRuleStructureSourceKind = 'natural_language',
): Promise<StructureRulesResult> {
  const callers: Record<string, (text: string, kind: PayrollRuleStructureSourceKind) => Promise<StructureRulesResult>> = {
    gemini: structureWithGemini,
    openai: structureWithOpenAI,
    claude: structureWithClaude,
  }
  let lastError = 'AI 구조화에 실패했습니다'
  for (const provider of getActiveAiProviderOrder()) {
    const caller = callers[provider]
    if (!caller) continue
    try {
      const result = await caller(sourceText, sourceKind)
      if (result.success) return result
      lastError = result.error
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError
    }
  }
  return { success: false, error: lastError }
}

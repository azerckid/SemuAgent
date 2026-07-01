import OpenAI from 'openai'
import { requireAiEnv } from '@/lib/env'
import { aiAnalysisSchema, type AnalyzeParams, type ProviderResult } from '@/lib/validations/analysis'
import { OPENAI_ANALYSIS_MODEL } from './models'
import { SYSTEM_PROMPT, buildAnalysisPrompt, extractJsonFromResponse } from './prompt'

const VISION_SIZE_LIMIT = 20 * 1024 * 1024 // 20MB

export async function analyzeWithOpenAI(params: AnalyzeParams): Promise<ProviderResult> {
  const { OPENAI_API_KEY } = requireAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  type ContentPart = OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage

  const content: ContentPart[] = []

  if (
    params.fileBuffer &&
    params.fileBuffer.byteLength <= VISION_SIZE_LIMIT &&
    params.fileType === 'image'
  ) {
    const base64 = Buffer.from(params.fileBuffer).toString('base64')
    content.push({
      type: 'image_url',
      image_url: { url: `data:${params.contentType};base64,${base64}`, detail: 'high' },
    })
  }

  content.push({ type: 'text', text: buildAnalysisPrompt(params) })

  let rawOutput = ''
  try {
    const response = await client.chat.completions.create({
      model: OPENAI_ANALYSIS_MODEL,
      // GPT-5 계열은 max_tokens 대신 max_completion_tokens를 요구한다.
      // reasoning 토큰이 출력 한도에 포함되므로 여유를 더 둔다.
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    })

    rawOutput = response.choices[0]?.message?.content ?? ''
    const jsonStr = extractJsonFromResponse(rawOutput)
    if (!jsonStr) return { success: false, rawOutput, error: 'JSON을 찾을 수 없습니다' }

    const parsed = aiAnalysisSchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) {
      return { success: false, rawOutput, error: parsed.error.message }
    }
    return { success: true, rawOutput, data: parsed.data }
  } catch (err) {
    return { success: false, rawOutput, error: (err as Error).message }
  }
}

import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { isGeminiEnabled, requireGoogleAiEnv } from '@/lib/env'
import { aiAnalysisSchema, type AnalyzeParams, type ProviderResult } from '@/lib/validations/analysis'
import { SYSTEM_PROMPT, buildAnalysisPrompt, extractJsonFromResponse } from './prompt'

const VISION_SIZE_LIMIT = 20 * 1024 * 1024 // 20MB

export async function analyzeWithGemini(params: AnalyzeParams): Promise<ProviderResult> {
  if (!isGeminiEnabled()) {
    return {
      success: false,
      rawOutput: '',
      error: 'Gemini provider is disabled (GEMINI_ENABLED=false)',
    }
  }

  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const parts: (string | Part)[] = []

  if (
    params.fileBuffer &&
    params.fileBuffer.byteLength <= VISION_SIZE_LIMIT &&
    (params.fileType === 'image' || params.fileType === 'pdf')
  ) {
    const base64 = Buffer.from(params.fileBuffer).toString('base64')
    parts.push({ inlineData: { data: base64, mimeType: params.contentType } })
  }

  parts.push(buildAnalysisPrompt(params))

  let rawOutput = ''
  try {
    const response = await model.generateContent(parts)
    rawOutput = response.response.text()

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

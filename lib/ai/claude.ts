import Anthropic from '@anthropic-ai/sdk'
import { requireAiEnv } from '@/lib/env'
import { aiAnalysisSchema, type AnalyzeParams, type ProviderResult } from '@/lib/validations/analysis'
import { SYSTEM_PROMPT, buildAnalysisPrompt, extractJsonFromResponse } from './prompt'

const VISION_SIZE_LIMIT = 20 * 1024 * 1024 // 20MB

export async function analyzeWithClaude(params: AnalyzeParams): Promise<ProviderResult> {
  const { ANTHROPIC_API_KEY } = requireAiEnv()
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const content: Anthropic.MessageParam['content'] = []

  if (params.fileBuffer && params.fileBuffer.byteLength <= VISION_SIZE_LIMIT) {
    const base64 = Buffer.from(params.fileBuffer).toString('base64')

    if (params.fileType === 'pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      } as Anthropic.DocumentBlockParam)
    } else if (params.fileType === 'image') {
      type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const validImageTypes: readonly ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const mediaType: ImageMediaType = (validImageTypes as readonly string[]).includes(params.contentType)
        ? (params.contentType as ImageMediaType)
        : 'image/jpeg'
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      } as Anthropic.ImageBlockParam)
    }
  }

  content.push({ type: 'text', text: buildAnalysisPrompt(params) })

  let rawOutput = ''
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    rawOutput = response.content[0].type === 'text' ? response.content[0].text : ''
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

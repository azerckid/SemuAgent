import {
  sebiseoChatRequestSchema,
  sebiseoChatResponseSchema,
  type SebiseoChatRequest,
  type SebiseoChatResponse,
} from './schemas'

export async function requestSebiseoChat(request: SebiseoChatRequest): Promise<SebiseoChatResponse> {
  const payload = sebiseoChatRequestSchema.parse(request)
  const response = await fetch('/api/sebiseo/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data: unknown = await response.json().catch(() => null)
  const parsed = sebiseoChatResponseSchema.safeParse(data)
  if (parsed.success) return parsed.data
  if (!response.ok) throw new Error('세비서 답변을 불러오지 못했습니다.')
  throw new Error('세비서 응답 형식이 올바르지 않습니다.')
}

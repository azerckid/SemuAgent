import { z } from 'zod'
import {
  usageHelpChatResponseSchema,
  type UsageHelpChatResponse,
} from '@/lib/usage-help/schemas'

const usageHelpRateLimitedResponseSchema = z.object({
  error: z.literal('rate_limited'),
  answer: z.string(),
  suggestedQuestions: z.array(z.string()).max(3),
})

export type UsageHelpClientResult =
  | { kind: 'success'; response: UsageHelpChatResponse }
  | { kind: 'rate_limited'; answer: string; suggestedQuestions: string[] }

export async function postUsageHelpChat(params: {
  question: string
  routePath?: string
}): Promise<UsageHelpClientResult> {
  const response = await fetch('/api/help/usage-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (response.status === 401) {
    throw new Error('Unauthorized')
  }

  if (response.status === 400) {
    throw new Error('Invalid usage help request')
  }

  const json = await response.json()

  if (response.status === 429) {
    const parsed = usageHelpRateLimitedResponseSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error('Invalid usage help rate limit response')
    }
    return {
      kind: 'rate_limited',
      answer: parsed.data.answer,
      suggestedQuestions: parsed.data.suggestedQuestions,
    }
  }

  const parsed = usageHelpChatResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Invalid usage help response')
  }

  return { kind: 'success', response: parsed.data }
}

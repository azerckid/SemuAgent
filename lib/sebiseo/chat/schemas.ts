import { z } from 'zod'

export const SEBISEO_MESSAGE_MAX_LENGTH = 2000
export const SEBISEO_HISTORY_MAX_TURNS = 8

export const sebiseoChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(SEBISEO_MESSAGE_MAX_LENGTH),
})

export type SebiseoChatHistoryItem = z.infer<typeof sebiseoChatHistoryItemSchema>

export const sebiseoChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(SEBISEO_MESSAGE_MAX_LENGTH),
  history: z.array(sebiseoChatHistoryItemSchema).max(SEBISEO_HISTORY_MAX_TURNS),
  routePath: z.string().trim().max(200).optional(),
  clientRequestId: z.string().uuid().optional(),
})

export type SebiseoChatRequest = z.infer<typeof sebiseoChatRequestSchema>

export const sebiseoSuggestedActionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().startsWith('/dashboard').max(200),
})

export const sebiseoRefusalReasonSchema = z.enum([
  'off_topic',
  'tax_advice',
  'action',
  'out_of_scope',
  'unsafe_answer',
])

export const sebiseoChatResponseSchema = z.object({
  status: z.enum(['answered', 'refused', 'error']),
  answer: z.string().trim().min(1).max(SEBISEO_MESSAGE_MAX_LENGTH),
  suggestedActions: z.array(sebiseoSuggestedActionSchema).max(3),
  refusal: sebiseoRefusalReasonSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.status === 'refused' && !value.refusal) {
    ctx.addIssue({
      code: 'custom',
      path: ['refusal'],
      message: 'refused 응답에는 refusal 사유가 필요합니다.',
    })
  }
  if (value.status !== 'refused' && value.refusal) {
    ctx.addIssue({
      code: 'custom',
      path: ['refusal'],
      message: 'refused가 아닌 응답에는 refusal 사유를 넣지 않습니다.',
    })
  }
})

export type SebiseoChatResponse = z.infer<typeof sebiseoChatResponseSchema>

export const sebiseoModelOutputSchema = z.object({
  status: z.enum(['answered', 'refused']),
  answer: z.string().trim().min(1).max(SEBISEO_MESSAGE_MAX_LENGTH),
})

export type SebiseoModelOutput = z.infer<typeof sebiseoModelOutputSchema>

export function recentSebiseoHistory(
  history: readonly SebiseoChatHistoryItem[],
): SebiseoChatHistoryItem[] {
  return history.slice(-SEBISEO_HISTORY_MAX_TURNS)
}

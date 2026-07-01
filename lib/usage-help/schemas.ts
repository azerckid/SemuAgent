import { z } from 'zod'

export const usageHelpChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  routePath: z.string().trim().max(200).optional(),
  conversationId: z.string().trim().max(64).optional(),
})

export type UsageHelpChatRequest = z.infer<typeof usageHelpChatRequestSchema>

export const usageHelpChatResponseSchema = z.object({
  status: z.enum(['answered', 'refused', 'error']),
  answer: z.string().max(2000),
  sourceLabels: z.array(z.string().max(120)).max(3),
  suggestedQuestions: z.array(z.string().max(200)).max(3),
})

export type UsageHelpChatResponse = z.infer<typeof usageHelpChatResponseSchema>

export const usageHelpModelOutputSchema = z.object({
  status: z.enum(['answered', 'refused']),
  answer: z.string().trim().min(1).max(2000),
  sourceLabels: z.array(z.string().trim().min(1).max(120)).max(3),
  suggestedQuestions: z.array(z.string().trim().min(1).max(200)).max(3),
})

export type UsageHelpModelOutput = z.infer<typeof usageHelpModelOutputSchema>

export type UsageHelpStaticAnswer = {
  body: string
  sourceLabel: string
}

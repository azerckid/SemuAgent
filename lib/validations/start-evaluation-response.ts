import { z } from 'zod'

export const startEvaluationSuccessStatusSchema = z.enum([
  'ai_checking',
  'needs_resubmission',
  'ready_for_accountant',
  'completed',
])

export const startEvaluationResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    status: startEvaluationSuccessStatusSchema,
    async: z.boolean().optional(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(['session_not_found', 'already_evaluated', 'skipped_stale', 'evaluation_failed']),
    error: z.string(),
  }),
])

export type StartEvaluationResponse = z.infer<typeof startEvaluationResponseSchema>

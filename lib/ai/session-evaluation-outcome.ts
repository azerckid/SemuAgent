import { z } from 'zod'

export const sessionEvaluationSuccessSchema = z.object({
  ok: z.literal(true),
  status: z.enum(['needs_resubmission', 'ready_for_accountant']),
})

export const sessionEvaluationFailureSchema = z.object({
  ok: z.literal(false),
  code: z.enum(['session_not_found', 'already_evaluated', 'skipped_stale', 'evaluation_failed']),
  message: z.string(),
})

export const sessionEvaluationOutcomeSchema = z.discriminatedUnion('ok', [
  sessionEvaluationSuccessSchema,
  sessionEvaluationFailureSchema,
])

export type SessionEvaluationOutcome = z.infer<typeof sessionEvaluationOutcomeSchema>

export type SessionEvaluationStatus = z.infer<typeof sessionEvaluationSuccessSchema>['status']

export function isSessionEvaluationSuccess(
  outcome: SessionEvaluationOutcome,
): outcome is z.infer<typeof sessionEvaluationSuccessSchema> {
  return outcome.ok
}

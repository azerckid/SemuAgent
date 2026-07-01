import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadSession } from '@/lib/db/schema'
import type { SessionEvaluationOutcome } from './session-evaluation-outcome'
import { evaluateSessionAgainstCriteria } from './session-eval'

export async function rollbackSessionEvaluationAttempt(sessionId: string, tenantId: string) {
  await db
    .update(uploadSession)
    .set({ status: 'submitted' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
}

export async function applySessionEvaluationOutcome(params: {
  sessionId: string
  tenantId: string
  outcome: SessionEvaluationOutcome
}) {
  if (!params.outcome.ok) return params.outcome
  if (params.outcome.status !== 'needs_resubmission') return params.outcome

  const { generateMissingRequestDraft } = await import('@/lib/email/missing-request')
  await generateMissingRequestDraft(params.sessionId, params.tenantId)
  return params.outcome
}

export async function runSessionEvaluationPipeline(
  sessionId: string,
  tenantId: string,
  options: { reanalyzeFiles?: boolean } = {},
): Promise<SessionEvaluationOutcome> {
  if (options.reanalyzeFiles) {
    const { reanalyzeSessionFiles } = await import('./process')
    await reanalyzeSessionFiles(sessionId, tenantId)
  }

  const outcome = await evaluateSessionAgainstCriteria(sessionId, tenantId)
  if (outcome.ok) {
    return applySessionEvaluationOutcome({ sessionId, tenantId, outcome })
  }

  if (outcome.code !== 'already_evaluated' && outcome.code !== 'session_not_found') {
    await rollbackSessionEvaluationAttempt(sessionId, tenantId)
  }

  return outcome
}

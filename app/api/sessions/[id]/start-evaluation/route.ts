import { after } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { uploadSession } from '@/lib/db/schema'
import { runSessionEvaluationPipeline } from '@/lib/ai/run-session-evaluation'
import { runBookkeepingDraftPipelineAfterEvaluation } from '@/lib/bookkeeping/automatic-review-progression'
import { startEvaluationResponseSchema } from '@/lib/validations/start-evaluation-response'

export const maxDuration = 300

const startEvaluationRequestSchema = z.object({
  force: z.boolean().optional().default(false),
  reanalyzeFiles: z.boolean().optional().default(false),
})

const alreadyEvaluatedStatuses = ['needs_resubmission', 'ready_for_accountant', 'completed'] as const

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let tenantId: string
  let userId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    userId = session.user.id
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
  const { id: sessionId } = await params
  const body = await req.json().catch(() => ({}))
  const parsedBody = startEvaluationRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { force, reanalyzeFiles } = parsedBody.data

  const rows = await db
    .select({ status: uploadSession.status })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = rows[0]
  if (!session) return new Response('Not found', { status: 404 })

  if (session.status === 'ai_checking' && !force) {
    return Response.json(startEvaluationResponseSchema.parse({ ok: true, status: 'ai_checking' }))
  }
  if (!force && (alreadyEvaluatedStatuses as readonly string[]).includes(session.status)) {
    return Response.json(startEvaluationResponseSchema.parse({
      ok: true,
      status: session.status as (typeof alreadyEvaluatedStatuses)[number],
    }))
  }

  await db
    .update(uploadSession)
    .set({ status: 'ai_checking' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

  if (reanalyzeFiles) {
    after(async () => {
      try {
        const outcome = await runSessionEvaluationPipeline(sessionId, tenantId, { reanalyzeFiles: true })
        if (!outcome.ok) {
          console.error(`[start-evaluation] evaluate 실패 또는 스킵 (${sessionId}):`, outcome)
          return
        }
        await runBookkeepingDraftPipelineAfterEvaluation({ sessionId, tenantId, userId, logSource: 'start-evaluation' })
      } catch (err) {
        console.error(`[start-evaluation] evaluate 트리거 실패 (${sessionId}):`, err)
      }
    })

    return Response.json(startEvaluationResponseSchema.parse({
      ok: true,
      status: 'ai_checking',
      async: true,
    }))
  }

  try {
    const outcome = await runSessionEvaluationPipeline(sessionId, tenantId)
    if (outcome.ok) {
      await runBookkeepingDraftPipelineAfterEvaluation({ sessionId, tenantId, userId, logSource: 'start-evaluation' })
      return Response.json(startEvaluationResponseSchema.parse({
        ok: true,
        status: outcome.status,
      }))
    }

    return Response.json(startEvaluationResponseSchema.parse({
      ok: false,
      code: outcome.code,
      error: outcome.message,
    }), { status: 422 })
  } catch (err) {
    console.error(`[start-evaluation] evaluate 트리거 실패 (${sessionId}):`, err)
    return Response.json(startEvaluationResponseSchema.parse({
      ok: false,
      code: 'evaluation_failed',
      error: err instanceof Error ? err.message : '세션 평가 중 오류가 발생했습니다.',
    }), { status: 500 })
  }
}

import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientRequestEvent, uploadSession } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

async function submitProofNonBlocking({
  sessionId,
  tenantId,
}: {
  sessionId: string
  tenantId: string
}) {
  try {
    const { submitSessionCompletedProof } = await import('@/lib/services/proof-service')
    await submitSessionCompletedProof({
      uploadSessionId: sessionId,
      tenantId,
      completedAt: Math.floor(now().toSeconds()),
    })
  } catch (err) {
    console.error(`[complete-session] Giwa proof 실패 (non-fatal, sessionId=${sessionId})`, err)
  }
}

export async function markGeneralSessionCompleted({
  sessionId,
  tenantId,
}: {
  sessionId: string
  tenantId: string
}) {
  const [session] = await db
    .select({
      id: uploadSession.id,
      requestKind: uploadSession.requestKind,
      status: uploadSession.status,
      requestEventId: uploadSession.requestEventId,
    })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!session || session.requestKind !== 'general') return false

  const completedAt = toDBString(now())
  if (session.status !== 'completed') {
    await db
      .update(uploadSession)
      .set({ status: 'completed' })
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
  }

  if (session.requestEventId) {
    await db
      .update(clientRequestEvent)
      .set({ status: 'completed', updatedAt: completedAt })
      .where(and(eq(clientRequestEvent.id, session.requestEventId), eq(clientRequestEvent.tenantId, tenantId)))
  } else {
    await db
      .update(clientRequestEvent)
      .set({ status: 'completed', updatedAt: completedAt })
      .where(and(eq(clientRequestEvent.uploadSessionId, sessionId), eq(clientRequestEvent.tenantId, tenantId)))
  }

  await submitProofNonBlocking({ sessionId, tenantId })
  return true
}

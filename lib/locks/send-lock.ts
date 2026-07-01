import { and, eq, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outboundSendLock } from '@/lib/db/schema'
import { now, toDBString, type DateTime } from '@/lib/time'

export const STALE_SEND_LOCK_THRESHOLD_HOURS = 1

// 요청 발송 중복 실행 방지. 동일 client_request_event에 대한 동시 POST를
// partial unique(request_event_id) WHERE status = 'running' 으로 차단한다.
// release 시 status가 'completed'/'failed'로 바뀌면 unique 슬롯에서 빠지므로
// 실패 후 재시도가 가능하다. 락 row 자체는 감사용으로 영구 보존된다.
//
// 성공 시 lockId 반환, 이미 'running' 락이 잡혀 있으면 null 반환.
// 이미 발송 성공한 이벤트의 재요청 차단은 라우트의 event.uploadSessionId 체크가 담당한다.
export async function acquireSendLock(
  tenantId: string,
  requestEventId: string,
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const timestamp = toDBString(now())
    await db.insert(outboundSendLock).values({
      id,
      tenantId,
      requestEventId,
      status: 'running',
      startedAt: timestamp,
      createdAt: timestamp,
    })
    return id
  } catch (err) {
    if (isUniqueConstraintError(err)) return null
    throw err
  }
}

export async function releaseSendLock(
  lockId: string,
  status: 'completed' | 'failed',
): Promise<void> {
  await db
    .update(outboundSendLock)
    .set({ status, completedAt: toDBString(now()) })
    .where(eq(outboundSendLock.id, lockId))
}

export async function cleanupStaleSendLocks(referenceTime: DateTime = now()): Promise<number> {
  const staleBefore = toDBString(referenceTime.minus({ hours: STALE_SEND_LOCK_THRESHOLD_HOURS }))
  const completedAt = toDBString(referenceTime)
  const staleRows = await db
    .select({ id: outboundSendLock.id })
    .from(outboundSendLock)
    .where(and(
      eq(outboundSendLock.status, 'running'),
      lte(outboundSendLock.startedAt, staleBefore),
    ))

  if (staleRows.length === 0) return 0

  await db
    .update(outboundSendLock)
    .set({ status: 'failed', completedAt })
    .where(inArray(outboundSendLock.id, staleRows.map((row) => row.id)))

  return staleRows.length
}

// Drizzle은 원본 LibsqlError를 "Failed query: ..." Error로 감싸 던지므로
// 직접 code/message뿐 아니라 err.cause 체인까지 확인해야 한다.
export function isUniqueConstraintError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const code = 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') return true
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT')) return true
  if ('cause' in err && err.cause) return isUniqueConstraintError(err.cause)
  return false
}

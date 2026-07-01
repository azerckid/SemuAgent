import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cronRun } from '@/lib/db/schema'
import { isUniqueConstraintError } from '@/lib/locks/send-lock'
import { now, toDBString } from '@/lib/time'

// Vercel Cron은 CRON_SECRET을 Authorization: Bearer {secret} 헤더로 전달한다.
// 미설정 시에도 차단 — 선택적 인증은 인증이 아님.
export function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// DB 잠금 레코드로 중복 실행 방지. 잠금 성공 시 lockId 반환, 이미 실행 중이면 null.
// runKey는 작업 주기 단위 idempotency key (일별: 'YYYY-MM-DD', 2시간별: 'YYYY-MM-DD-HH').
export async function acquireCronLock(
  jobName: string,
  runKey: string,
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const timestamp = toDBString(now())
    await db.insert(cronRun).values({
      id,
      jobName,
      runKey,
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

export async function releaseCronLock(
  lockId: string,
  status: 'completed' | 'failed',
): Promise<void> {
  await db
    .update(cronRun)
    .set({ status, completedAt: toDBString(now()) })
    .where(eq(cronRun.id, lockId))
}

import { acquireCronLock, releaseCronLock, verifyCronAuth } from '@/lib/cron'
import { cleanupStaleSendLocks } from '@/lib/locks/send-lock'
import { now } from '@/lib/time'

export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  const runKey = now().toFormat("yyyy-MM-dd-HH'h'")
  const lockId = await acquireCronLock('cleanup_send_locks', runKey)
  if (!lockId) return Response.json({ ok: true, skipped: true, reason: 'Already ran this period' })

  try {
    const cleanedCount = await cleanupStaleSendLocks()
    await releaseCronLock(lockId, 'completed')
    return Response.json({ ok: true, cleanedCount })
  } catch (err) {
    console.error('[cron/cleanup-send-locks]', err)
    await releaseCronLock(lockId, 'failed')
    return Response.json({ ok: false, error: 'Error' }, { status: 500 })
  }
}

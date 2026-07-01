import { acquireCronLock, releaseCronLock, verifyCronAuth } from '@/lib/cron'
import { runDueTossRenewals } from '@/lib/billing/subscription'
import { now } from '@/lib/time'

export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  const runKey = now().toFormat('yyyy-MM-dd-HH')
  const lockId = await acquireCronLock('billing_renewals', runKey)
  if (!lockId) return Response.json({ ok: true, skipped: 'already_running_or_ran' })

  try {
    const result = await runDueTossRenewals()
    await releaseCronLock(lockId, 'completed')
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/billing-renewals]', err)
    await releaseCronLock(lockId, 'failed')
    return new Response('Error', { status: 500 })
  }
}

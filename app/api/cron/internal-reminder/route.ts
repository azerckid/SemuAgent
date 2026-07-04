import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'
import { acquireCronLock, releaseCronLock, verifyCronAuth } from '@/lib/cron'
import { sendInternalReminderRule } from '@/lib/internal-reminders/send'
import {
  isInternalReminderRuleDue,
  loadInternalReminderSummaryForSystem,
} from '@/lib/internal-reminders/summary'
import { now } from '@/lib/time'
import type { DateTime } from 'luxon'

export const maxDuration = 60

// JC-017: 내부 리마인드(internal_reminder_*)를 매일 실행한다.
// 세션이 없으므로 테넌트 스코프 시스템 로더로 활성 규칙을 조회하고,
// due(daily_digest=매일 / deadline_offset[vat]=마감−offsetDays 당일 / manual=제외)만 발송한다.
// 발송 중복은 기존 send_log 멱등성으로, 하루 중복 실행은 cron lock으로 막는다.
export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  const today = now()
  const runKey = today.toFormat('yyyy-MM-dd')
  const lockId = await acquireCronLock('internal_reminder', runKey)
  if (!lockId) return Response.json({ ok: true, skipped: 'already_running_or_ran' })

  try {
    const result = await runInternalReminderCron({ runKey, today })
    await releaseCronLock(lockId, 'completed')
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/internal-reminder]', err)
    await releaseCronLock(lockId, 'failed')
    return new Response('Error', { status: 500 })
  }
}

async function runInternalReminderCron({ runKey, today }: { runKey: string; today: DateTime }) {
  const tenantRows = await db.select({ id: tenant.id }).from(tenant)

  let tenants = 0
  let dueRules = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  let providerMissing = 0
  let tenantErrors = 0

  for (const row of tenantRows) {
    tenants += 1
    // 테넌트 격리: 한 테넌트 실패가 다른 테넌트 발송을 막지 않는다.
    try {
      const summary = await loadInternalReminderSummaryForSystem({ tenantId: row.id, today })
      for (const rule of summary.rules) {
        if (!isInternalReminderRuleDue({ rule, period: summary.period, today })) continue
        dueRules += 1
        const result = await sendInternalReminderRule({
          summary,
          ruleId: rule.id,
          staffId: null,
          mode: 'cron',
          runKey,
        })
        sent += result.sent
        failed += result.failed
        skipped += result.skipped
        if (result.providerMissing) providerMissing += 1
      }
    } catch (err) {
      tenantErrors += 1
      console.error('[cron/internal-reminder] tenant', row.id, err)
    }
  }

  return { tenants, dueRules, sent, failed, skipped, providerMissing, tenantErrors }
}

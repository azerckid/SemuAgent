import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { loadInternalReminderSummary } from '@/lib/internal-reminders/summary'
import { sendInternalReminderRule, type InternalReminderSendResult } from '@/lib/internal-reminders/send'
import { internalReminderSendNowSchema } from '@/lib/validations/internal-reminders'

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsed = internalReminderSendNowSchema.safeParse(await req.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const summary = await loadInternalReminderSummary({ tenantId, userId: user.id })
    if (!summary.businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }
    if (!summary.provider.configured) {
      return NextResponse.json({ error: summary.provider.message }, { status: 409 })
    }

    const targetRules = parsed.data.ruleId
      ? summary.rules.filter((rule) => rule.id === parsed.data.ruleId)
      : summary.rules.filter((rule) => rule.enabled)

    if (targetRules.length === 0) {
      return NextResponse.json({ error: '발송할 활성 리마인드 규칙이 없습니다.' }, { status: 404 })
    }

    const aggregate: InternalReminderSendResult = { sent: 0, failed: 0, skipped: 0, providerMissing: false }
    for (const rule of targetRules) {
      const result = await sendInternalReminderRule({
        summary,
        ruleId: rule.id,
        staffId: staffRecord.id,
        mode: 'manual',
      })
      aggregate.sent += result.sent
      aggregate.failed += result.failed
      aggregate.skipped += result.skipped
      aggregate.providerMissing ||= result.providerMissing
    }

    revalidatePath('/dashboard/reminders')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, result: aggregate })
  } catch (err) {
    console.error('[POST /api/internal-reminders/send-now]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

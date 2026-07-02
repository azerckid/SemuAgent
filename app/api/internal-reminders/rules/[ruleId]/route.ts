import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { loadInternalReminderSummary } from '@/lib/internal-reminders/summary'
import { persistInternalReminderRule } from '@/lib/internal-reminders/send'
import { now, toDBString } from '@/lib/time'
import { internalReminderRulePatchSchema } from '@/lib/validations/internal-reminders'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { ruleId } = await params
    const parsed = internalReminderRulePatchSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const summary = await loadInternalReminderSummary({ tenantId, userId: user.id })
    const businessEntity = summary.businessEntity
    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const rule = summary.rules.find((candidate) => candidate.id === ruleId)
    if (!rule) {
      return NextResponse.json({ error: '리마인드 규칙을 찾을 수 없습니다.' }, { status: 404 })
    }

    await persistInternalReminderRule({
      tenantId,
      clientId: businessEntity.id,
      staffId: staffRecord.id,
      rule,
      enabled: parsed.data.enabled,
      timestamp: toDBString(now(summary.tenant.timezone)),
    })

    revalidatePath('/dashboard/reminders')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/internal-reminders/rules/[ruleId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

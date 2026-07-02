import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { loadInternalReminderSummary } from '@/lib/internal-reminders/summary'
import { sendInternalReminderRule } from '@/lib/internal-reminders/send'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { ruleId } = await params

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

    const result = await sendInternalReminderRule({
      summary,
      ruleId,
      staffId: staffRecord.id,
      mode: 'test',
    })

    revalidatePath('/dashboard/reminders')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[POST /api/internal-reminders/rules/[ruleId]/test-send]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === '리마인드 규칙을 찾을 수 없습니다.') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { payrollEmployeeLine } from '@/lib/db/schema'
import { recalculatePayrollPeriodSummary } from '@/lib/payroll-workspace/recalculate'
import { now, toDBString } from '@/lib/time'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { lineId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [line] = await db
      .select({
        id: payrollEmployeeLine.id,
        periodSummaryId: payrollEmployeeLine.periodSummaryId,
        status: payrollEmployeeLine.status,
      })
      .from(payrollEmployeeLine)
      .where(and(eq(payrollEmployeeLine.id, lineId), eq(payrollEmployeeLine.tenantId, tenantId)))
      .limit(1)

    if (!line) {
      return NextResponse.json({ error: '급여 line을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (line.status === 'closed') {
      return NextResponse.json({ error: '마감된 급여 line은 변경할 수 없습니다.' }, { status: 409 })
    }

    const ts = toDBString(now())
    await db
      .update(payrollEmployeeLine)
      .set({
        status: 'ready',
        issueCode: null,
        issueMessage: null,
        editedByStaffId: staffRecord.id,
        editedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(payrollEmployeeLine.id, line.id), eq(payrollEmployeeLine.tenantId, tenantId)))

    const totals = await recalculatePayrollPeriodSummary({ tenantId, periodSummaryId: line.periodSummaryId })
    revalidatePath('/dashboard/payroll')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, lineId: line.id, issueCount: totals?.issueCount ?? 0 })
  } catch (err) {
    console.error('[POST /api/payroll/employee-lines/[lineId]/resolve]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

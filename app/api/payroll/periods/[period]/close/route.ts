import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { client, payrollEmployeeLine, payrollPeriodSummary } from '@/lib/db/schema'
import { recalculatePayrollPeriodSummary } from '@/lib/payroll-workspace/recalculate'
import { now, toDBString } from '@/lib/time'
import { payrollPeriodKeySchema } from '@/lib/validations/payroll-workspace'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ period: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { period: rawPeriod } = await params
    const period = payrollPeriodKeySchema.safeParse(rawPeriod)

    if (!period.success) {
      return NextResponse.json({ error: period.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [businessEntity] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.tenantId, tenantId))
      .orderBy(client.createdAt)
      .limit(1)

    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const [summary] = await db
      .select({
        id: payrollPeriodSummary.id,
        closeStatus: payrollPeriodSummary.closeStatus,
      })
      .from(payrollPeriodSummary)
      .where(and(
        eq(payrollPeriodSummary.tenantId, tenantId),
        eq(payrollPeriodSummary.clientId, businessEntity.id),
        eq(payrollPeriodSummary.payrollPeriod, period.data),
      ))
      .limit(1)

    if (!summary) {
      return NextResponse.json({ error: '급여대장이 아직 생성되지 않았습니다.' }, { status: 404 })
    }
    if (summary.closeStatus === 'closed') {
      return NextResponse.json({ error: '이미 마감된 급여입니다.' }, { status: 409 })
    }

    const totals = await recalculatePayrollPeriodSummary({ tenantId, periodSummaryId: summary.id })
    if ((totals?.issueCount ?? 0) > 0) {
      return NextResponse.json({ error: `확인 필요 ${totals?.issueCount ?? 0}건 처리 후 마감할 수 있습니다.` }, { status: 409 })
    }

    const ts = toDBString(now())
    await db
      .update(payrollPeriodSummary)
      .set({
        closeStatus: 'closed',
        closedByStaffId: staffRecord.id,
        closedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(payrollPeriodSummary.id, summary.id), eq(payrollPeriodSummary.tenantId, tenantId)))

    await db
      .update(payrollEmployeeLine)
      .set({ status: 'closed', editedByStaffId: staffRecord.id, editedAt: ts, updatedAt: ts })
      .where(and(eq(payrollEmployeeLine.periodSummaryId, summary.id), eq(payrollEmployeeLine.tenantId, tenantId)))

    revalidatePath('/dashboard/payroll')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, period: period.data, closeStatus: 'closed' })
  } catch (err) {
    console.error('[POST /api/payroll/periods/[period]/close]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

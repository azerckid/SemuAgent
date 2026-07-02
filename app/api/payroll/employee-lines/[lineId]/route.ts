import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { payrollEmployeeLine } from '@/lib/db/schema'
import { recalculatePayrollPeriodSummary } from '@/lib/payroll-workspace/recalculate'
import { buildPayrollRegisterRow } from '@/lib/payroll-workspace/summary'
import { now, toDBString } from '@/lib/time'
import { payrollEmployeeLinePatchSchema } from '@/lib/validations/payroll-workspace'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { lineId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const input = payrollEmployeeLinePatchSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
    }

    const [line] = await db
      .select()
      .from(payrollEmployeeLine)
      .where(and(eq(payrollEmployeeLine.id, lineId), eq(payrollEmployeeLine.tenantId, tenantId)))
      .limit(1)

    if (!line) {
      return NextResponse.json({ error: '급여 line을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (line.status === 'closed') {
      return NextResponse.json({ error: '마감된 급여 line은 수정할 수 없습니다.' }, { status: 409 })
    }

    const ts = toDBString(now())
    const nextLine = {
      ...line,
      ...input.data,
      employeeName: input.data.employeeName ?? line.employeeName,
      status: input.data.status ?? line.status,
      issueCode: input.data.issueCode === undefined ? line.issueCode : input.data.issueCode,
      issueMessage: input.data.issueMessage === undefined ? line.issueMessage : input.data.issueMessage,
    }
    const derived = buildPayrollRegisterRow(nextLine)

    await db
      .update(payrollEmployeeLine)
      .set({
        ...input.data,
        grossPayKrw: derived.grossPayKrw,
        socialInsuranceKrw: derived.socialInsuranceKrw,
        deductionTotalKrw: derived.deductionTotalKrw,
        netPayKrw: derived.netPayKrw,
        editedByStaffId: staffRecord.id,
        editedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(payrollEmployeeLine.id, line.id), eq(payrollEmployeeLine.tenantId, tenantId)))

    await recalculatePayrollPeriodSummary({ tenantId, periodSummaryId: line.periodSummaryId })
    revalidatePath('/dashboard/payroll')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, lineId: line.id })
  } catch (err) {
    console.error('[PATCH /api/payroll/employee-lines/[lineId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

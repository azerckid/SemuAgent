import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff, payrollExtractionRow } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { patchPayrollRowSchema } from '@/lib/validations/payroll'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, rowId } = await params

    const body = await req.json()
    const parsed = patchPayrollRowSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // row 조회 (tenant + session 소유권 확인)
    const rowRows = await db
      .select()
      .from(payrollExtractionRow)
      .where(
        and(
          eq(payrollExtractionRow.id, rowId),
          eq(payrollExtractionRow.uploadSessionId, sessionId),
          eq(payrollExtractionRow.tenantId, tenantId),
        ),
      )
      .limit(1)

    const row = rowRows[0]
    if (!row) {
      return NextResponse.json({ error: 'row를 찾을 수 없습니다' }, { status: 404 })
    }

    // 담당자 조회
    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const ts = toDBString(now())
    const { reviewStatus, aiVerdict, aiVerdictReason, ...fieldUpdates } = parsed.data

    const updatePayload: Record<string, unknown> = {
      ...fieldUpdates,
      updatedAt: ts,
    }

    if (aiVerdict) {
      updatePayload.aiVerdict = aiVerdict
      updatePayload.aiVerdictReason = aiVerdict === 'pass'
        ? null
        : (aiVerdictReason ?? '담당자가 부적합으로 처리했습니다')
      updatePayload.reviewedByStaffId = staffRow[0].id
      updatePayload.reviewedAt = ts
    } else if (aiVerdictReason !== undefined) {
      updatePayload.aiVerdictReason = aiVerdictReason
    }

    // Deprecated: reviewStatus는 기존 DB 호환용이다.
    // payroll 화면/출력 조건은 aiVerdict(pass/fail)만 사용한다.
    if (reviewStatus) {
      updatePayload.reviewStatus = reviewStatus
      updatePayload.reviewedByStaffId = staffRow[0].id
      updatePayload.reviewedAt = ts
    }

    await db
      .update(payrollExtractionRow)
      .set(updatePayload)
      .where(and(eq(payrollExtractionRow.id, rowId), eq(payrollExtractionRow.tenantId, tenantId)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/payroll/rows/[rowId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

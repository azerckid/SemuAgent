import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { employeeProfile } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { employeeUpdateSchema } from '@/lib/validations/employee-directory'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { employeeId } = await params
    const parsed = employeeUpdateSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [existing] = await db
      .select({ id: employeeProfile.id, clientId: employeeProfile.clientId })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.id, employeeId), eq(employeeProfile.tenantId, tenantId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
    }

    const data = parsed.data
    const nextCode = data.employeeCode !== undefined
      ? (data.employeeCode?.trim() ? data.employeeCode.trim() : null)
      : undefined

    if (nextCode) {
      const [conflict] = await db
        .select({ id: employeeProfile.id })
        .from(employeeProfile)
        .where(and(
          eq(employeeProfile.tenantId, tenantId),
          eq(employeeProfile.clientId, existing.clientId),
          eq(employeeProfile.employeeCode, nextCode),
          ne(employeeProfile.id, existing.id),
        ))
        .limit(1)
      if (conflict) {
        return NextResponse.json({ error: `이미 사용 중인 사번입니다: ${nextCode}` }, { status: 409 })
      }
    }

    const ts = toDBString(now())
    await db
      .update(employeeProfile)
      .set({
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(nextCode !== undefined ? { employeeCode: nextCode } : {}),
        ...(data.department !== undefined ? { department: data.department ?? null } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle ?? null } : {}),
        ...(data.employeeStatus !== undefined ? { employeeStatus: data.employeeStatus } : {}),
        ...(data.payrollEligibility !== undefined ? { payrollEligibility: data.payrollEligibility } : {}),
        ...(data.insuranceEnrollmentStatus !== undefined ? { insuranceEnrollmentStatus: data.insuranceEnrollmentStatus } : {}),
        ...(data.hireDate !== undefined ? { hireDate: data.hireDate ?? null } : {}),
        ...(data.terminationDate !== undefined ? { terminationDate: data.terminationDate ?? null } : {}),
        ...(data.workEmail !== undefined ? { workEmail: data.workEmail ?? null } : {}),
        ...(data.notificationEnabled !== undefined ? { notificationEnabled: data.notificationEnabled } : {}),
        updatedByStaffId: staffRecord.id,
        updatedAt: ts,
      })
      .where(and(eq(employeeProfile.id, existing.id), eq(employeeProfile.tenantId, tenantId)))

    revalidatePath('/dashboard/employees')

    return NextResponse.json({ ok: true, employeeId: existing.id })
  } catch (err) {
    console.error('[PATCH /api/employees/[employeeId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

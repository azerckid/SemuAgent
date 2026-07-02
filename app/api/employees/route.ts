import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { client, employeeProfile } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { employeeCreateSchema } from '@/lib/validations/employee-directory'

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsed = employeeCreateSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [businessEntity] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.tenantId, tenantId))
      .orderBy(asc(client.createdAt))
      .limit(1)

    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const employeeCode = parsed.data.employeeCode?.trim() ? parsed.data.employeeCode.trim() : null
    if (employeeCode) {
      const [existing] = await db
        .select({ id: employeeProfile.id })
        .from(employeeProfile)
        .where(and(
          eq(employeeProfile.tenantId, tenantId),
          eq(employeeProfile.clientId, businessEntity.id),
          eq(employeeProfile.employeeCode, employeeCode),
        ))
        .limit(1)
      if (existing) {
        return NextResponse.json({ error: `이미 사용 중인 사번입니다: ${employeeCode}` }, { status: 409 })
      }
    }

    const ts = toDBString(now())
    const employeeId = randomUUID()
    await db.insert(employeeProfile).values({
      id: employeeId,
      tenantId,
      clientId: businessEntity.id,
      employeeCode,
      displayName: parsed.data.displayName,
      department: parsed.data.department ?? null,
      jobTitle: parsed.data.jobTitle ?? null,
      employeeStatus: parsed.data.employeeStatus,
      payrollEligibility: parsed.data.payrollEligibility,
      insuranceEnrollmentStatus: parsed.data.insuranceEnrollmentStatus,
      hireDate: parsed.data.hireDate ?? null,
      terminationDate: parsed.data.terminationDate ?? null,
      workEmail: parsed.data.workEmail ?? null,
      notificationEnabled: parsed.data.notificationEnabled,
      createdByStaffId: staffRecord.id,
      updatedByStaffId: staffRecord.id,
      createdAt: ts,
      updatedAt: ts,
    })

    revalidatePath('/dashboard/employees')

    return NextResponse.json({ ok: true, employeeId })
  } catch (err) {
    console.error('[POST /api/employees]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

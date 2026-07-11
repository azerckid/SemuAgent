import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenant, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { parseUpdateTenantSettingsInput } from '@/lib/tenant/update-tenant-settings-schema'

async function requireTenantAdmin() {
  const { user, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { user, tenantId }
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()
    const rows = await db.select().from(tenant).where(eq(tenant.id, tenantId)).limit(1)
    if (!rows[0]) return NextResponse.json({ error: '테넌트를 찾을 수 없습니다' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[GET /api/settings/tenant]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAdmin()
    const body = await req.json()
    const parsed = parseUpdateTenantSettingsInput(body)
    if (!parsed.success) {
      const reminderIssue = parsed.error.issues.find((issue) => issue.path[0] === 'reminderDaysBefore')
      if (reminderIssue) {
        return NextResponse.json({ error: '1~14 사이의 일수를 입력해 주세요.' }, { status: 400 })
      }
      const firstIssue = parsed.error.issues[0]
      const message = firstIssue?.path[0] === 'name'
        ? '회사명을 입력해 주세요.'
        : firstIssue?.path[0] === 'timezone'
          ? '타임존을 선택해 주세요.'
          : '입력값을 확인해 주세요.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const { name, timezone, reminderDaysBefore } = parsed.data
    await db
      .update(tenant)
      .set({ name, timezone, reminderDaysBefore })
      .where(eq(tenant.id, tenantId))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/settings/tenant]', err)
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { randomUUID } from 'crypto'
import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff, staffMailbox, staffMailboxAssignmentHistory } from '@/lib/db/schema'
import { buildStaffMailboxAddress } from '@/lib/email/inbound/mailbox-domain'
import { now, toDBString } from '@/lib/time'
import { createStaffMailboxSchema } from '@/lib/validations/staff-mailbox'

async function requireTenantAdmin() {
  const { user, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { tenantId, actorStaffId: staffRows[0].id }
}

export async function POST(req: Request) {
  try {
    const { tenantId, actorStaffId } = await requireTenantAdmin()
    const body = await req.json()
    const parsed = createStaffMailboxSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { staffId, alias } = parsed.data

    const targetRows = await db
      .select({ id: staff.id, active: staff.active })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
      .limit(1)
    if (!targetRows[0]) {
      return NextResponse.json({ error: '담당자를 찾을 수 없습니다' }, { status: 404 })
    }
    if (!targetRows[0].active) {
      return NextResponse.json({ error: '비활성 담당자에게는 메일함을 만들 수 없습니다' }, { status: 409 })
    }

    const existingForStaff = await db
      .select({ id: staffMailbox.id })
      .from(staffMailbox)
      .where(
        and(
          eq(staffMailbox.currentStaffId, staffId),
          eq(staffMailbox.tenantId, tenantId),
          ne(staffMailbox.state, 'retired'),
        ),
      )
      .limit(1)
    if (existingForStaff[0]) {
      return NextResponse.json(
        { error: '이미 사용 중인 업무 메일함이 있습니다. 먼저 폐기해 주세요.' },
        { status: 409 },
      )
    }

    const address = buildStaffMailboxAddress(alias)
    const duplicateAddress = await db
      .select({ id: staffMailbox.id })
      .from(staffMailbox)
      .where(eq(staffMailbox.address, address))
      .limit(1)
    if (duplicateAddress[0]) {
      return NextResponse.json({ error: '이미 사용 중인 주소입니다' }, { status: 409 })
    }

    const id = randomUUID()
    const ts = toDBString(now())
    await db.transaction(async (tx) => {
      await tx.insert(staffMailbox).values({
        id,
        tenantId,
        currentStaffId: staffId,
        alias,
        address,
        state: 'active',
        createdAt: ts,
        updatedAt: ts,
      })
      await tx.insert(staffMailboxAssignmentHistory).values({
        id: randomUUID(),
        tenantId,
        staffMailboxId: id,
        fromStaffId: null,
        toStaffId: staffId,
        action: 'created',
        actorStaffId,
        createdAt: ts,
      })
    })

    return NextResponse.json({ id, address, state: 'active' }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/settings/staff-mailboxes]', err)
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { randomUUID } from 'crypto'
import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff, staffMailbox, staffMailboxAssignmentHistory } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { staffMailboxActionSchema } from '@/lib/validations/staff-mailbox'

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

const NEXT_STATE: Record<string, 'paused' | 'active' | 'retired' | 'handoff_required'> = {
  pause: 'paused',
  resume: 'active',
  retire: 'retired',
  transfer: 'active',
}

const HISTORY_ACTION: Record<string, 'paused' | 'resumed' | 'retired' | 'transferred'> = {
  pause: 'paused',
  resume: 'resumed',
  retire: 'retired',
  transfer: 'transferred',
}

const ALLOWED_FROM: Record<string, string[]> = {
  pause: ['active'],
  resume: ['paused'],
  retire: ['reserved', 'active', 'paused', 'handoff_required'],
  transfer: ['active', 'paused', 'handoff_required'],
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ mailboxId: string }> },
) {
  try {
    const { tenantId, actorStaffId } = await requireTenantAdmin()
    const { mailboxId } = await params

    const body = await req.json()
    const parsed = staffMailboxActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const rows = await db
      .select({ state: staffMailbox.state, currentStaffId: staffMailbox.currentStaffId })
      .from(staffMailbox)
      .where(and(eq(staffMailbox.id, mailboxId), eq(staffMailbox.tenantId, tenantId)))
      .limit(1)
    const target = rows[0]
    if (!target) {
      return NextResponse.json({ error: '업무 메일함을 찾을 수 없습니다' }, { status: 404 })
    }

    const { action } = parsed.data
    if (!ALLOWED_FROM[action].includes(target.state)) {
      return NextResponse.json(
        { error: `현재 상태(${target.state})에서는 이 작업을 할 수 없습니다` },
        { status: 409 },
      )
    }

    let newStaffId: string | null = target.currentStaffId
    if (action === 'transfer') {
      const { staffId } = parsed.data
      const targetStaffRows = await db
        .select({ id: staff.id, active: staff.active })
        .from(staff)
        .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
        .limit(1)
      if (!targetStaffRows[0]) {
        return NextResponse.json({ error: '담당자를 찾을 수 없습니다' }, { status: 404 })
      }
      if (!targetStaffRows[0].active) {
        return NextResponse.json({ error: '비활성 담당자에게는 인계할 수 없습니다' }, { status: 409 })
      }
      const targetHasMailbox = await db
        .select({ id: staffMailbox.id })
        .from(staffMailbox)
        .where(
          and(
            eq(staffMailbox.currentStaffId, staffId),
            eq(staffMailbox.tenantId, tenantId),
            ne(staffMailbox.state, 'retired'),
            ne(staffMailbox.id, mailboxId),
          ),
        )
        .limit(1)
      if (targetHasMailbox[0]) {
        return NextResponse.json(
          { error: '대상 담당자가 이미 사용 중인 업무 메일함을 갖고 있습니다' },
          { status: 409 },
        )
      }
      newStaffId = staffId
    }

    const ts = toDBString(now())
    await db.transaction(async (tx) => {
      await tx
        .update(staffMailbox)
        .set({ state: NEXT_STATE[action], currentStaffId: newStaffId, updatedAt: ts })
        .where(and(eq(staffMailbox.id, mailboxId), eq(staffMailbox.tenantId, tenantId)))
      await tx.insert(staffMailboxAssignmentHistory).values({
        id: randomUUID(),
        tenantId,
        staffMailboxId: mailboxId,
        fromStaffId: target.currentStaffId,
        toStaffId: newStaffId,
        action: HISTORY_ACTION[action],
        actorStaffId,
        createdAt: ts,
      })
    })

    return NextResponse.json({ ok: true, state: NEXT_STATE[action] })
  } catch (err) {
    console.error('[PATCH /api/settings/staff-mailboxes/[mailboxId]]', err)
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

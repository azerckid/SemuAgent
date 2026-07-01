import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staff, staffMailbox, staffMailboxAssignmentHistory } from '@/lib/db/schema'
import { member } from '@/lib/db/auth-schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { now, toDBString } from '@/lib/time'

async function requireTenantAdmin(tenantId: string, userId: string) {
  const staffRows = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return staffRows[0].id
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('role'), role: z.enum(['STAFF', 'TENANT_ADMIN']) }),
  z.object({ action: z.literal('rename'), name: z.string().min(1).max(50) }),
  z.object({ action: z.literal('deactivate') }),
  z.object({ action: z.literal('activate') }),
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ staffId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const actorStaffId = await requireTenantAdmin(tenantId, user.id)
    const { staffId } = await params

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // 대상 담당자 조회 (테넌트 격리)
    const targetRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
      .limit(1)

    const target = targetRows[0]
    if (!target) {
      return NextResponse.json({ error: '담당자를 찾을 수 없습니다' }, { status: 404 })
    }

    // 자기 자신의 TENANT_ADMIN 역할은 변경 불가 (테넌트 관리자 공백 방지)
    if (target.userId === user.id && parsed.data.action !== 'activate' && parsed.data.action !== 'rename') {
      return NextResponse.json({ error: '자신의 계정은 변경할 수 없습니다' }, { status: 400 })
    }

    if (parsed.data.action === 'rename') {
      await db
        .update(staff)
        .set({ name: parsed.data.name })
        .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
    } else if (parsed.data.action === 'role') {
      const { role } = parsed.data
      const betterAuthRole = role === 'TENANT_ADMIN' ? 'owner' : 'member'
      await db
        .update(staff)
        .set({ role })
        .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
      // Better Auth member 역할도 동기화
      await db
        .update(member)
        .set({ role: betterAuthRole })
        .where(and(eq(member.organizationId, tenantId), eq(member.userId, target.userId)))
    } else if (parsed.data.action === 'deactivate') {
      // 퇴사/비활성 직원의 업무 메일주소는 폐기하지 않고 인계 필요 상태로 전환한다.
      // 주소·메일 이력은 그대로 보존되고, tenant admin이 새 담당자에게 인계한다.
      const ts = toDBString(now())
      await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ active: false })
          .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))

        const affectedMailboxes = await tx
          .select({ id: staffMailbox.id })
          .from(staffMailbox)
          .where(
            and(
              eq(staffMailbox.currentStaffId, staffId),
              eq(staffMailbox.tenantId, tenantId),
              ne(staffMailbox.state, 'retired'),
              ne(staffMailbox.state, 'handoff_required'),
            ),
          )
        if (affectedMailboxes.length === 0) return

        await tx
          .update(staffMailbox)
          .set({ state: 'handoff_required', updatedAt: ts })
          .where(
            and(
              eq(staffMailbox.currentStaffId, staffId),
              eq(staffMailbox.tenantId, tenantId),
              ne(staffMailbox.state, 'retired'),
              ne(staffMailbox.state, 'handoff_required'),
            ),
          )
        await tx.insert(staffMailboxAssignmentHistory).values(
          affectedMailboxes.map((mailbox) => ({
            id: randomUUID(),
            tenantId,
            staffMailboxId: mailbox.id,
            fromStaffId: staffId,
            toStaffId: staffId,
            action: 'handoff_required' as const,
            reason: '담당자 비활성화',
            actorStaffId,
            createdAt: ts,
          })),
        )
      })
    } else {
      await db
        .update(staff)
        .set({ active: true })
        .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/settings/staff/[staffId]]', err)
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

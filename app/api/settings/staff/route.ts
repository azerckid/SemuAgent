import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staff, client } from '@/lib/db/schema'
import { member, user } from '@/lib/db/auth-schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { syncMemberToStaff } from '@/lib/services/org-sync'

async function requireTenantAdmin() {
  const { user: u, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, u.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { user: u, tenantId }
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const staffRows = await db
      .select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        active: staff.active,
        createdAt: staff.createdAt,
      })
      .from(staff)
      .where(eq(staff.tenantId, tenantId))
      .orderBy(staff.createdAt)

    // 담당자별 배정된 클라이언트 수
    const clientCounts: Record<string, number> = {}
    const clientRows = await db
      .select({ staffId: client.staffId })
      .from(client)
      .where(eq(client.tenantId, tenantId))

    for (const row of clientRows) {
      if (row.staffId) {
        clientCounts[row.staffId] = (clientCounts[row.staffId] ?? 0) + 1
      }
    }

    return NextResponse.json(
      staffRows.map((s) => ({ ...s, clientCount: clientCounts[s.id] ?? 0 })),
    )
  } catch (err) {
    console.error('[GET /api/settings/staff]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

const addStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(['STAFF', 'TENANT_ADMIN']),
})

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAdmin()
    const body = await req.json()
    const parsed = addStaffSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { email, role } = parsed.data

    // 가입된 계정 조회
    const userRows = await db.select().from(user).where(eq(user.email, email)).limit(1)
    const targetUser = userRows[0]
    if (!targetUser) {
      return NextResponse.json(
        { error: '해당 이메일로 가입된 계정이 없습니다. 먼저 회원가입 후 추가해 주세요.' },
        { status: 404 },
      )
    }

    // 이미 멤버인지 확인
    const existingMember = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, tenantId), eq(member.userId, targetUser.id)))
      .limit(1)

    if (existingMember.length > 0) {
      return NextResponse.json({ error: '이미 담당자로 등록된 계정입니다' }, { status: 409 })
    }

    const betterAuthRole = role === 'TENANT_ADMIN' ? 'owner' : 'member'

    // Better Auth member 테이블에 직접 삽입 (invitation 흐름 생략 — 소규모 팀 직접 추가)
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: tenantId,
      userId: targetUser.id,
      role: betterAuthRole,
      createdAt: new Date(),
    })

    await syncMemberToStaff({
      organizationId: tenantId,
      userId: targetUser.id,
      userEmail: targetUser.email,
      userName: targetUser.name,
      betterAuthRole,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/settings/staff]', err)
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { randomUUID } from 'crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { internalCcGroup, staff } from '@/lib/db/schema'
import { normalizeCcEmails } from '@/lib/email/cc'
import { isMissingInternalCcGroupTableError } from '@/lib/internal-cc-groups/errors'
import { now, toDBString } from '@/lib/time'
import { createInternalCcGroupSchema } from '@/lib/validations/internal-cc-group'

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const rows = await db
      .select()
      .from(internalCcGroup)
      .where(eq(internalCcGroup.tenantId, tenantId))
      .orderBy(desc(internalCcGroup.isDefault), asc(internalCcGroup.name))

    return NextResponse.json(rows)
  } catch (err) {
    if (isMissingInternalCcGroupTableError(err)) {
      return NextResponse.json([])
    }
    console.error('[GET /api/settings/internal-cc-groups]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const body = await req.json()
    const parsed = createInternalCcGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRows[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const duplicateRows = await db
      .select({ id: internalCcGroup.id })
      .from(internalCcGroup)
      .where(
        and(
          eq(internalCcGroup.tenantId, tenantId),
          sql`lower(${internalCcGroup.name}) = ${parsed.data.name.toLowerCase()}`,
        ),
      )
      .limit(1)

    if (duplicateRows[0]) {
      return NextResponse.json({ error: '이미 같은 이름의 내부 참조 그룹이 있습니다' }, { status: 409 })
    }

    const normalizedEmails = normalizeCcEmails(parsed.data.emails)
    if (!normalizedEmails) {
      return NextResponse.json({ error: '참조 이메일을 1개 이상 입력해 주세요' }, { status: 400 })
    }

    const id = randomUUID()
    const ts = toDBString(now())

    await db.insert(internalCcGroup).values({
      id,
      tenantId,
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      emails: normalizedEmails,
      isDefault: parsed.data.isDefault,
      createdByStaffId: staffRows[0].id,
      createdAt: ts,
      updatedAt: ts,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    if (isMissingInternalCcGroupTableError(err)) {
      return NextResponse.json(
        { error: '내부 참조 그룹 테이블이 아직 준비되지 않았습니다. 0034 마이그레이션을 적용해 주세요.' },
        { status: 503 },
      )
    }
    console.error('[POST /api/settings/internal-cc-groups]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

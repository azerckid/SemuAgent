import { and, eq, ne, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { internalCcGroup } from '@/lib/db/schema'
import { normalizeCcEmails } from '@/lib/email/cc'
import { isMissingInternalCcGroupTableError } from '@/lib/internal-cc-groups/errors'
import { now, toDBString } from '@/lib/time'
import { updateInternalCcGroupSchema } from '@/lib/validations/internal-cc-group'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { groupId } = await params

    const existingRows = await db
      .select({ id: internalCcGroup.id })
      .from(internalCcGroup)
      .where(and(eq(internalCcGroup.id, groupId), eq(internalCcGroup.tenantId, tenantId)))
      .limit(1)

    if (!existingRows[0]) {
      return NextResponse.json({ error: '내부 참조 그룹을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateInternalCcGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (parsed.data.name) {
      const duplicateRows = await db
        .select({ id: internalCcGroup.id })
        .from(internalCcGroup)
        .where(
          and(
            eq(internalCcGroup.tenantId, tenantId),
            ne(internalCcGroup.id, groupId),
            sql`lower(${internalCcGroup.name}) = ${parsed.data.name.toLowerCase()}`,
          ),
        )
        .limit(1)

      if (duplicateRows[0]) {
        return NextResponse.json({ error: '이미 같은 이름의 내부 참조 그룹이 있습니다' }, { status: 409 })
      }
    }

    const updates: Partial<typeof internalCcGroup.$inferInsert> = {
      updatedAt: toDBString(now()),
    }
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.purpose !== undefined) updates.purpose = parsed.data.purpose
    if (parsed.data.emails !== undefined) {
      const normalizedEmails = normalizeCcEmails(parsed.data.emails)
      if (!normalizedEmails) {
        return NextResponse.json({ error: '참조 이메일을 1개 이상 입력해 주세요' }, { status: 400 })
      }
      updates.emails = normalizedEmails
    }
    if (parsed.data.isDefault !== undefined) updates.isDefault = parsed.data.isDefault

    await db
      .update(internalCcGroup)
      .set(updates)
      .where(and(eq(internalCcGroup.id, groupId), eq(internalCcGroup.tenantId, tenantId)))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingInternalCcGroupTableError(err)) {
      return NextResponse.json(
        { error: '내부 참조 그룹 테이블이 아직 준비되지 않았습니다. 0034 마이그레이션을 적용해 주세요.' },
        { status: 503 },
      )
    }
    console.error('[PATCH /api/settings/internal-cc-groups/[groupId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { groupId } = await params

    await db
      .delete(internalCcGroup)
      .where(and(eq(internalCcGroup.id, groupId), eq(internalCcGroup.tenantId, tenantId)))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingInternalCcGroupTableError(err)) {
      return NextResponse.json(
        { error: '내부 참조 그룹 테이블이 아직 준비되지 않았습니다. 0034 마이그레이션을 적용해 주세요.' },
        { status: 503 },
      )
    }
    console.error('[DELETE /api/settings/internal-cc-groups/[groupId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

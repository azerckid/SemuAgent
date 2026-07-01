import { and, eq, ne, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientCcGroup } from '@/lib/db/schema'
import { normalizeCcEmails } from '@/lib/email/cc'
import { now, toDBString } from '@/lib/time'
import { updateClientCcGroupSchema } from '@/lib/validations/client-cc-group'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: clientId, groupId } = await params

    const existingRows = await db
      .select({ id: clientCcGroup.id })
      .from(clientCcGroup)
      .innerJoin(client, and(eq(clientCcGroup.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(
        and(
          eq(clientCcGroup.id, groupId),
          eq(clientCcGroup.clientId, clientId),
          eq(clientCcGroup.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (!existingRows[0]) {
      return NextResponse.json({ error: '참조 그룹을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateClientCcGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (parsed.data.name) {
      const duplicateRows = await db
        .select({ id: clientCcGroup.id })
        .from(clientCcGroup)
        .where(
          and(
            eq(clientCcGroup.tenantId, tenantId),
            eq(clientCcGroup.clientId, clientId),
            ne(clientCcGroup.id, groupId),
            sql`lower(${clientCcGroup.name}) = ${parsed.data.name.toLowerCase()}`,
          ),
        )
        .limit(1)

      if (duplicateRows[0]) {
        return NextResponse.json({ error: '이미 같은 이름의 참조 그룹이 있습니다' }, { status: 409 })
      }
    }

    const updates: Partial<typeof clientCcGroup.$inferInsert> = {
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
      .update(clientCcGroup)
      .set(updates)
      .where(
        and(
          eq(clientCcGroup.id, groupId),
          eq(clientCcGroup.clientId, clientId),
          eq(clientCcGroup.tenantId, tenantId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/clients/[id]/cc-groups/[groupId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: clientId, groupId } = await params

    await db
      .delete(clientCcGroup)
      .where(
        and(
          eq(clientCcGroup.id, groupId),
          eq(clientCcGroup.clientId, clientId),
          eq(clientCcGroup.tenantId, tenantId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/clients/[id]/cc-groups/[groupId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

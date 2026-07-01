import { randomUUID } from 'crypto'
import { and, asc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientCcGroup, staff } from '@/lib/db/schema'
import { normalizeCcEmails } from '@/lib/email/cc'
import { now, toDBString } from '@/lib/time'
import { createClientCcGroupSchema } from '@/lib/validations/client-cc-group'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: clientId } = await params

    const clientRows = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1)

    if (!clientRows[0]) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }

    const rows = await db
      .select()
      .from(clientCcGroup)
      .where(and(eq(clientCcGroup.clientId, clientId), eq(clientCcGroup.tenantId, tenantId)))
      .orderBy(asc(clientCcGroup.name))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/clients/[id]/cc-groups]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: clientId } = await params

    const body = await req.json()
    const parsed = createClientCcGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [clientRows, staffRows] = await Promise.all([
      db
        .select({ id: client.id })
        .from(client)
        .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
        .limit(1),
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
    ])

    if (!clientRows[0]) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }
    if (!staffRows[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const duplicateRows = await db
      .select({ id: clientCcGroup.id })
      .from(clientCcGroup)
      .where(
        and(
          eq(clientCcGroup.tenantId, tenantId),
          eq(clientCcGroup.clientId, clientId),
          sql`lower(${clientCcGroup.name}) = ${parsed.data.name.toLowerCase()}`,
        ),
      )
      .limit(1)

    if (duplicateRows[0]) {
      return NextResponse.json({ error: '이미 같은 이름의 참조 그룹이 있습니다' }, { status: 409 })
    }

    const ts = toDBString(now())
    const normalizedEmails = normalizeCcEmails(parsed.data.emails)

    if (!normalizedEmails) {
      return NextResponse.json({ error: '참조 이메일을 1개 이상 입력해 주세요' }, { status: 400 })
    }

    const id = randomUUID()
    await db.insert(clientCcGroup).values({
      id,
      tenantId,
      clientId,
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
    console.error('[POST /api/clients/[id]/cc-groups]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

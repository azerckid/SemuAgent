import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { client, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { createClientSchema } from '@/lib/validations/client'
import { now, toDBString } from '@/lib/time'

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const rows = await db
      .select({
        id: client.id,
        name: client.name,
        contactName: client.contactName,
        email: client.email,
        staffId: client.staffId,
        address: client.address,
        phone: client.phone,
        analysisNotes: client.analysisNotes,
        createdAt: client.createdAt,
        staffName: staff.name,
      })
      .from(client)
      .leftJoin(staff, eq(client.staffId, staff.id))
      .where(eq(client.tenantId, tenantId))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, contactName, email, staffId, address, phone, analysisNotes } = parsed.data

    const duplicateRows = await db
      .select({ id: client.id })
      .from(client)
      .where(
        and(
          eq(client.tenantId, tenantId),
          sql`lower(${client.email}) = ${email}`,
        ),
      )
      .limit(1)

    if (duplicateRows[0]) {
      return NextResponse.json(
        { error: '이미 등록된 고객사 이메일입니다. 기존 고객사를 수정하거나 담당 회계사를 변경해 주세요.' },
        { status: 409 },
      )
    }

    if (staffId) {
      const staffRows = await db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
        .limit(1)
      if (!staffRows[0]) {
        return NextResponse.json({ error: '담당자를 찾을 수 없습니다' }, { status: 404 })
      }
    }

    const id = crypto.randomUUID()
    await db.insert(client).values({
      id,
      tenantId,
      staffId: staffId ?? null,
      name,
      contactName,
      email,
      address: address ?? null,
      phone: phone ?? null,
      analysisNotes: analysisNotes ?? null,
      createdAt: toDBString(now()),
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

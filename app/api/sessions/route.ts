import { and, desc, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, staff, uploadSession } from '@/lib/db/schema'
import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const rows = await db
      .select({
        id: uploadSession.id,
        accountingPeriod: uploadSession.accountingPeriod,
        status: uploadSession.status,
        expiresAt: uploadSession.expiresAt,
        lastAccessedAt: uploadSession.lastAccessedAt,
        createdAt: uploadSession.createdAt,
        clientName: client.name,
        clientEmail: client.email,
        staffName: staff.name,
      })
      .from(uploadSession)
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
      .where(and(eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .orderBy(desc(uploadSession.createdAt))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/sessions]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST() {
  return retiredLegacyEmailResponse()
}

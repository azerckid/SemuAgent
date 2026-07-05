import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { requestTemplate } from '@/lib/db/schema'
import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    const whereClause = clientId
      ? and(
          eq(requestTemplate.tenantId, tenantId),
          or(isNull(requestTemplate.clientId), eq(requestTemplate.clientId, clientId)),
        )
      : eq(requestTemplate.tenantId, tenantId)

    const rows = await db
      .select()
      .from(requestTemplate)
      .where(whereClause)

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/request-templates]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST() {
  return retiredLegacyEmailResponse()
}

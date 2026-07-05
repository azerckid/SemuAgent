import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { clientRequestSchedule } from '@/lib/db/schema'
import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId 필요' }, { status: 400 })
    }

    const rows = await db
      .select()
      .from(clientRequestSchedule)
      .where(and(
        eq(clientRequestSchedule.clientId, clientId),
        eq(clientRequestSchedule.tenantId, tenantId),
        isNull(clientRequestSchedule.deletedAt),
      ))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/request-schedules]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST() {
  return retiredLegacyEmailResponse()
}

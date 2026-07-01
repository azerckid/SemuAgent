import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff, uploadSession } from '@/lib/db/schema'
import { cancelRunningPayrollExtractionBatch } from '@/lib/services/payroll-extraction-service'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    const [staffRows, sessionRows] = await Promise.all([
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
      db
        .select({
          id: uploadSession.id,
          requestKind: uploadSession.requestKind,
        })
        .from(uploadSession)
        .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
        .limit(1),
    ])

    if (!staffRows[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const session = sessionRows[0]
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }
    if (session.requestKind !== 'payroll') {
      return NextResponse.json({ error: '급여정산 세션이 아닙니다' }, { status: 400 })
    }

    const result = await cancelRunningPayrollExtractionBatch({ sessionId, tenantId })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/payroll/extract/cancel]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

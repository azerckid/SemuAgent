import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { retireReviewAdaptiveModel } from '@/lib/reviews/adaptive-structuring-registry'

// retire는 이미 승인되어 재사용 중인 모델을 중단시키는 작업이라, 승인과 동급으로
// TENANT_ADMIN만 허용한다.
async function requireTenantAdmin() {
  const { user, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { tenantId }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantAdmin()
    const { id: modelId } = await params

    const result = await retireReviewAdaptiveModel({ tenantId, modelId })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/review/adaptive-models/[id]/retire]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

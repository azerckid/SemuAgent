import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { approvePayrollAdaptiveModel } from '@/lib/payroll/adaptive-structuring-registry'

// 승인된 모델은 tenant 전체에서 재사용되므로, 일반 담당자보다 강한 권한(TENANT_ADMIN)만 허용한다.
async function requireTenantAdmin() {
  const { user, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { tenantId, staffId: staffRows[0].id }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, staffId } = await requireTenantAdmin()
    const { id: modelId } = await params

    const result = await approvePayrollAdaptiveModel({ tenantId, modelId, approvedByStaffId: staffId })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/payroll/adaptive-models/[id]/approve]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

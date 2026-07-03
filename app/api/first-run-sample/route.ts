import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { deleteFirstRunSampleDataset } from '@/lib/first-run-sample/cleanup'
import { ensureFirstRunSampleDataset } from '@/lib/first-run-sample/seed'

const DASHBOARD_PATHS = [
  '/dashboard',
  '/dashboard/direct-upload',
  '/dashboard/bookkeeping',
  '/dashboard/vat',
  '/dashboard/payroll',
  '/dashboard/filing-support',
  '/dashboard/employees',
  '/dashboard/reminders',
]

function revalidateDashboards() {
  for (const path of DASHBOARD_PATHS) revalidatePath(path)
}

export async function POST() {
  try {
    const { user, tenantId } = await requireTenantSession()
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await ensureFirstRunSampleDataset({ tenantId, userId: user.id, source: 'manual_retry' })
    revalidateDashboards()

    if (result.status === 'failed') {
      return NextResponse.json({ ok: false, result, error: result.errorMessage ?? '샘플 데이터를 만들지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[POST /api/first-run-sample]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { user, tenantId } = await requireTenantSession()
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await deleteFirstRunSampleDataset({ tenantId })
    revalidateDashboards()

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[DELETE /api/first-run-sample]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '샘플 데이터를 삭제하지 못했습니다.' }, { status: 500 })
  }
}

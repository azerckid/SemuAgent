import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { BOOKKEEPING_ACCOUNT_CATEGORIES } from '@/lib/bookkeeping/account-categories'
import {
  canAccessClassificationSession,
  getActiveStaffForUser,
  getClassificationEligibility,
  getLatestBookkeepingClassification,
} from '@/lib/bookkeeping/classification-service'
import { attachPurposeAnswersToClassificationRows } from '@/lib/bookkeeping/transaction-purpose-classification-answers'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const canAccess = await canAccessClassificationSession({ sessionId, tenantId, staffRecord })
    if (!canAccess) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const [classification, eligibility] = await Promise.all([
      getLatestBookkeepingClassification({ sessionId, tenantId }),
      getClassificationEligibility({ sessionId, tenantId, staffRecord }),
    ])
    const rows = await attachPurposeAnswersToClassificationRows({
      tenantId,
      uploadSessionId: sessionId,
      currentClassificationRunId: classification.displayRun?.id,
      rows: classification.rows,
    })

    return NextResponse.json({
      categories: BOOKKEEPING_ACCOUNT_CATEGORIES,
      eligibility,
      run: classification.run,
      displayRun: classification.displayRun,
      progressRun: classification.progressRun,
      latestAttemptRun: classification.latestAttemptRun,
      rows,
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/account-classification]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

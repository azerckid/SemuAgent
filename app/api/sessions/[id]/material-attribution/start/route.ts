import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { runBookkeepingLedgerDraftPipeline } from '@/lib/bookkeeping/fiscal-year-ledger-pipeline'
import {
  getActiveStaffForPeriodAttribution,
  startBookkeepingMaterialAttribution,
} from '@/lib/bookkeeping/period-attribution-service'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await startBookkeepingMaterialAttribution({ sessionId, tenantId, staffRecord })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // 귀속기간 검토(재검토 포함)가 끝난 직후 자동으로 ledger merge -> 계정항목 초안
    // -> 전표 초안까지 진행한다. 자동 진행이 실패해도 검토 자체는 이미 끝났으므로
    // 이 응답을 깨뜨리지 않고 pipeline 결과만 같이 보여준다.
    let pipeline: Awaited<ReturnType<typeof runBookkeepingLedgerDraftPipeline>> | null = null
    try {
      pipeline = await runBookkeepingLedgerDraftPipeline({ sessionId, tenantId, staffRecord })
    } catch (pipelineError) {
      console.error('[POST /api/sessions/[id]/material-attribution/start] pipeline', pipelineError)
    }

    try {
      const { generateMissingRequestDraft } = await import('@/lib/email/missing-request')
      await generateMissingRequestDraft(sessionId, tenantId)
    } catch (draftError) {
      console.error('[POST /api/sessions/[id]/material-attribution/start] missing-request draft', draftError)
    }

    return NextResponse.json({ ...result, pipeline })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/material-attribution/start]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { runBookkeepingLedgerDraftPipeline } from '@/lib/bookkeeping/fiscal-year-ledger-pipeline'

const paramsSchema = z.object({
  id: z.string().trim().min(1),
})

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.flatten() }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await runBookkeepingLedgerDraftPipeline({
      sessionId: parsedParams.data.id,
      tenantId,
      staffRecord,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, steps: result.steps }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/sessions/[id]/bookkeeping-ledger/pipeline]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

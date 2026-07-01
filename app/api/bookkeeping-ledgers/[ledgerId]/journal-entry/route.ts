import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { listAccumulatedJournalVouchers } from '@/lib/bookkeeping/fiscal-year-ledger-journal-view'

const querySchema = z.object({
  period: z.string().trim().min(1).optional(),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ledgerId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { ledgerId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const parsed = querySchema.safeParse({
      period: new URL(req.url).searchParams.get('period') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await listAccumulatedJournalVouchers({
      tenantId,
      ledgerId,
      period: parsed.data.period,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/bookkeeping-ledgers/[ledgerId]/journal-entry]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { getOrCreateFiscalYearLedgerSummary } from '@/lib/bookkeeping/fiscal-year-ledger'

const paramsSchema = z.object({
  clientId: z.string().min(1),
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; year: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id, year } = await params
    const parsed = paramsSchema.safeParse({ clientId: id, fiscalYear: year })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const summary = await getOrCreateFiscalYearLedgerSummary({
      tenantId,
      clientId: parsed.data.clientId,
      fiscalYear: parsed.data.fiscalYear,
    })

    if (!summary) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json(summary)
  } catch (err) {
    console.error('[GET /api/clients/[id]/bookkeeping-ledgers/[year]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

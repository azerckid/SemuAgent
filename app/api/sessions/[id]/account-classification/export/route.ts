import * as XLSX from 'xlsx'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  formatClassificationRowsForExport,
  getActiveStaffForUser,
  getClassificationEligibility,
  getLatestBookkeepingClassification,
} from '@/lib/bookkeeping/classification-service'

const exportQuerySchema = z.object({
  scope: z.enum(['confirmed', 'all']).default('confirmed'),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const query = exportQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!query.success) {
      return NextResponse.json({ error: query.error.message }, { status: 400 })
    }

    const eligibility = await getClassificationEligibility({ sessionId, tenantId, staffRecord })
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 409 })
    }

    const { displayRun, rows } = await getLatestBookkeepingClassification({ sessionId, tenantId })
    if (!displayRun || rows.length === 0) {
      return NextResponse.json({ error: '다운로드할 분류 행이 없습니다.' }, { status: 404 })
    }
    if (displayRun.status !== 'completed') {
      return NextResponse.json({ error: '최신 계정항목 정리가 완료된 후 다운로드할 수 있습니다.' }, { status: 409 })
    }

    const exportRows = query.data.scope === 'confirmed'
      ? rows.filter((row) => row.status === 'confirmed')
      : rows

    const formattedRows = formatClassificationRowsForExport(exportRows)
    if (formattedRows.length === 0) {
      return NextResponse.json({
        error: query.data.scope === 'confirmed'
          ? '다운로드할 확정 행이 없습니다.'
          : '다운로드할 실제 거래 행이 없습니다.',
      }, { status: 409 })
    }

    const worksheet = XLSX.utils.json_to_sheet(formattedRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'account-classification')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `bookkeeping_account_classification_${sessionId}_${query.data.scope}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/account-classification/export]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

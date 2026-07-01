import * as XLSX from 'xlsx'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { buildJournalEntryVoucherExportAoa } from '@/lib/bookkeeping/journal-entry-voucher-lines'
import {
  canAccessJournalEntrySession,
  getActiveStaffForUser,
  getLatestBookkeepingJournalEntry,
} from '@/lib/bookkeeping/journal-entry-service'

const exportQuerySchema = z.object({
  scope: z.enum(['confirmed', 'all']).default('all'),
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
    const canAccess = await canAccessJournalEntrySession({ sessionId, tenantId, staffRecord })
    if (!canAccess) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const query = exportQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!query.success) {
      return NextResponse.json({ error: query.error.message }, { status: 400 })
    }

    const { run, voucherLines } = await getLatestBookkeepingJournalEntry({ sessionId, tenantId })
    if (!run || voucherLines.length === 0) {
      return NextResponse.json({ error: '다운로드할 전표 분개표 행이 없습니다.' }, { status: 404 })
    }
    if (run.status !== 'draft' && run.status !== 'completed') {
      return NextResponse.json({ error: '전표 분개표 생성 후 다운로드할 수 있습니다.' }, { status: 409 })
    }

    const exportLines = query.data.scope === 'confirmed'
      ? voucherLines.filter((line) => line.voucherStatus === 'confirmed')
      : voucherLines

    if (exportLines.length === 0) {
      return NextResponse.json({ error: '다운로드할 전표 행이 없습니다.' }, { status: 409 })
    }

    const worksheet = XLSX.utils.aoa_to_sheet(buildJournalEntryVoucherExportAoa(exportLines))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '전표분개표')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `bookkeeping_journal_entry_${sessionId}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/journal-entry/export]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

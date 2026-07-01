import * as XLSX from 'xlsx'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import {
  listAccumulatedJournalVouchers,
  toJournalEntryExportLines,
} from '@/lib/bookkeeping/fiscal-year-ledger-journal-view'
import { buildJournalEntryVoucherExportAoa } from '@/lib/bookkeeping/journal-entry-voucher-lines'

const querySchema = z.object({
  period: z.string().trim().min(1).optional(),
  scope: z.enum(['confirmed', 'all']).default('all'),
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

    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      period: url.searchParams.get('period') ?? undefined,
      scope: url.searchParams.get('scope') ?? undefined,
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

    const vouchers = parsed.data.scope === 'confirmed'
      ? result.vouchers.filter((item) => item.voucher.status === 'confirmed')
      : result.vouchers

    const exportLines = toJournalEntryExportLines(vouchers)
    if (exportLines.length === 0) {
      return NextResponse.json({ error: '다운로드할 전표 행이 없습니다.' }, { status: 404 })
    }

    const worksheet = XLSX.utils.aoa_to_sheet(buildJournalEntryVoucherExportAoa(exportLines))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '전표분개표')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `bookkeeping_ledger_journal_entry_${ledgerId}_${result.period.label}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[GET /api/bookkeeping-ledgers/[ledgerId]/journal-entry/export]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

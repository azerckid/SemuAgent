import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { JournalEntryVoucherLine } from '@/lib/bookkeeping/journal-entry-voucher-lines'
import { JournalEntryVoucherTableCard } from '@/app/(dashboard)/dashboard/_components/journal-entry-voucher-table-card'
import { buildLedgerPeriodOptions } from '../../_components/bookkeeping-fiscal-year-panel-helpers'

export function LedgerJournalEntryWorkspace({
  clientId,
  clientName,
  ledgerId,
  fiscalYear,
  periodLabel,
  periodValue,
  voucherLines,
  sessionCount,
  staleVoucherCount,
}: {
  clientId: string
  clientName: string
  ledgerId: string
  fiscalYear: number
  periodLabel: string
  periodValue: string
  voucherLines: JournalEntryVoucherLine[]
  sessionCount: number
  staleVoucherCount: number
}) {
  const periodOptions = buildLedgerPeriodOptions(fiscalYear).filter((option) => option.type !== 'month')

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">전표 분개표</h1>
            <Badge variant="secondary">누적 {sessionCount}개 세션</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {clientName} · {periodLabel} · 회계연도 장부에 누적된 전표 분개표를 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/clients/${clientId}#bookkeeping-ledger`} className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" />
            고객사로 돌아가기
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {periodOptions.map((option) => (
          <Link
            key={option.value}
            href={`/dashboard/clients/${clientId}/bookkeeping-ledger/journal-entry?period=${encodeURIComponent(option.value)}`}
            className={buttonVariants({ variant: periodValue === option.value ? 'default' : 'outline', size: 'sm' })}
          >
            {option.shortLabel}
          </Link>
        ))}
      </div>

      {staleVoucherCount > 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-amber-700">
            최신 자료나 계정항목 정리와 다시 맞춰봐야 하는 전표 {staleVoucherCount}건이 있습니다.
          </CardContent>
        </Card>
      ) : null}

      <JournalEntryVoucherTableCard
        voucherLines={voucherLines}
        exportHref={`/api/bookkeeping-ledgers/${ledgerId}/journal-entry/export?period=${encodeURIComponent(periodValue)}`}
        emptyMessage="선택한 기간의 누적 전표 분개표 초안이 없습니다."
      />
    </div>
  )
}

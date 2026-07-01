'use client'

import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DisplayStatus } from '@/lib/status-tone'
import { cn } from '@/lib/utils'
import type { ReviewAdaptiveStructuringEligibility } from '@/lib/reviews/adaptive-structuring-eligibility'
import { ReviewAccountClassificationPopup } from './review-account-classification-popup'
import { ReviewDeactivatedLedgerStatusChip } from './review-deactivated-ledger-status-chip'
import { ReviewJournalEntryPopup } from './review-journal-entry-popup'
import { ReviewMaterialStatusPopup } from './review-material-status-popup'
import { ReviewPeriodAttributionPopup } from './review-period-attribution-popup'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export type ReviewRequestListItem = {
  session: ReviewSession
  href: string
  displayClientName: string
  staffName: string
  accountingPeriodLabel: string
  requestMethodLabel: string
  isSelected: boolean
  materialStatus: DisplayStatus
  adaptiveStructuring: {
    eligibility: ReviewAdaptiveStructuringEligibility
  }
  periodAttributionStatus: DisplayStatus
  accountClassificationStatus: DisplayStatus
  journalEntryStatus: DisplayStatus
  fileCount: number
  transactionCount: number
  accountClassificationDeactivated?: boolean
  journalEntryDeactivated?: boolean
}

export function ReviewRequestList({
  items,
  onNavigate,
}: {
  items: ReviewRequestListItem[]
  onNavigate?: (sessionId: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="table-fixed [&_td]:px-3 [&_th]:px-3">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>고객사</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>기장 기간</TableHead>
            <TableHead>요청 방식</TableHead>
            <TableHead>자료 상태</TableHead>
            <TableHead>귀속기간</TableHead>
            <TableHead>계정항목</TableHead>
            <TableHead>전표분개</TableHead>
            <TableHead className="text-right">자료/거래</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.session.id} className={item.isSelected ? 'bg-primary/5' : undefined}>
              <TableCell className="truncate font-medium text-foreground" title={item.displayClientName}>
                <Link
                  href={item.href}
                  aria-current={item.isSelected ? 'page' : undefined}
                  className="block truncate rounded-sm text-foreground hover:text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    if (item.isSelected) {
                      event.preventDefault()
                      return
                    }
                    onNavigate?.(item.session.id)
                  }}
                >
                  {item.displayClientName}
                </Link>
              </TableCell>
              <TableCell className="truncate text-muted-foreground" title={item.staffName}>{item.staffName}</TableCell>
              <TableCell className="whitespace-nowrap">{item.accountingPeriodLabel}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{item.requestMethodLabel}</TableCell>
              <TableCell>
                <ReviewMaterialStatusPopup
                  status={item.materialStatus}
                  displayClientName={item.displayClientName}
                  accountingPeriod={item.accountingPeriodLabel}
                  session={item.session}
                  adaptiveStructuring={item.adaptiveStructuring}
                />
              </TableCell>
              <TableCell>
                <ReviewPeriodAttributionPopup
                  status={item.periodAttributionStatus}
                  displayClientName={item.displayClientName}
                  accountingPeriod={item.accountingPeriodLabel}
                  session={item.session}
                />
              </TableCell>
              <TableCell>
                {item.accountClassificationDeactivated ? (
                  <ReviewDeactivatedLedgerStatusChip status={item.accountClassificationStatus} />
                ) : (
                  <ReviewAccountClassificationPopup
                    status={item.accountClassificationStatus}
                    displayClientName={item.displayClientName}
                    accountingPeriod={item.accountingPeriodLabel}
                    session={item.session}
                  />
                )}
              </TableCell>
              <TableCell>
                {item.journalEntryDeactivated ? (
                  <ReviewDeactivatedLedgerStatusChip status={item.journalEntryStatus} />
                ) : (
                  <ReviewJournalEntryPopup
                    status={item.journalEntryStatus}
                    displayClientName={item.displayClientName}
                    accountingPeriod={item.accountingPeriodLabel}
                    session={item.session}
                  />
                )}
              </TableCell>
              <TableCell className={cn('whitespace-nowrap text-right tabular-nums text-muted-foreground')}>
                {item.fileCount} / {item.transactionCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

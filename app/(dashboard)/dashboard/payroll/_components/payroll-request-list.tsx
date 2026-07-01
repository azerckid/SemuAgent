import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PayrollAdaptiveStructuringEligibility } from '@/lib/payroll/adaptive-structuring-eligibility'
import type { PayrollDraftRow, PayrollRow } from '@/lib/payroll/load-payroll-summary-by-event-id'
import type { PayrollDisplayStatus } from '@/lib/payroll/payroll-status'
import type { PayrollResultExcelDownloadState } from '@/lib/sessions/payroll-source-download'
import { PayrollExcelStatusPopup } from './payroll-excel-status-popup'
import { PayrollExtractionStatusPopup } from './payroll-extraction-status-popup'
import { PayrollMaterialStatusPopup } from './payroll-material-status-popup'
import type { PayrollUploadedFile } from './payroll-uploaded-files-panel'

export type PayrollRequestListItem = {
  eventId: string
  href: string
  displayClientName: string
  staffName: string
  accountingPeriod: string
  requestMethodLabel: string
  rowCount: number
  isSelected: boolean
  materialStatus: PayrollDisplayStatus
  extractionStatus: PayrollDisplayStatus
  excelStatus: PayrollDisplayStatus
  materialPopup: {
    files: PayrollUploadedFile[]
    sessionId: string | null
    continueUploadHref: string | null
    showCancelButton: boolean
  }
  extractionPopup: {
    rows: PayrollRow[]
    sessionId: string | null
    reviewNotice: string | null
    successMessage: string | null
    rerunDisabled: boolean
    sessionDetailLink: { show: boolean; label: string } | null
    adaptiveStructuring: {
      eligibility: PayrollAdaptiveStructuringEligibility
      candidateFiles: { id: string; originalFilename: string }[]
    } | null
  }
  excelPopup: {
    sessionId: string | null
    passCount: number
    failCount: number
    latestDraft: PayrollDraftRow | null
    resultDownloadState: PayrollResultExcelDownloadState
  }
}

export function PayrollRequestList({ items }: { items: PayrollRequestListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="table-fixed [&_td]:px-3 [&_th]:px-3">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>고객사</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>급여 기간</TableHead>
            <TableHead>요청 방식</TableHead>
            <TableHead>자료 상태</TableHead>
            <TableHead>추출 상태</TableHead>
            <TableHead>엑셀 상태</TableHead>
            <TableHead className="text-right">row</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.eventId} className={item.isSelected ? 'bg-primary/5' : undefined}>
              <TableCell className="truncate font-medium text-foreground" title={item.displayClientName}>
                <Link
                  href={item.href}
                  aria-current={item.isSelected ? 'page' : undefined}
                  className="block truncate rounded-sm text-foreground hover:text-primary hover:underline"
                >
                  {item.displayClientName}
                </Link>
              </TableCell>
              <TableCell className="truncate text-muted-foreground" title={item.staffName}>
                {item.staffName}
              </TableCell>
              <TableCell className="whitespace-nowrap">{item.accountingPeriod}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{item.requestMethodLabel}</TableCell>
              <TableCell>
                <PayrollMaterialStatusPopup
                  status={item.materialStatus}
                  eventId={item.eventId}
                  displayClientName={item.displayClientName}
                  accountingPeriod={item.accountingPeriod}
                  files={item.materialPopup.files}
                  sessionId={item.materialPopup.sessionId}
                  continueUploadHref={item.materialPopup.continueUploadHref}
                  showCancelButton={item.materialPopup.showCancelButton}
                />
              </TableCell>
              <TableCell>
                <PayrollExtractionStatusPopup
                  status={item.extractionStatus}
                  displayClientName={item.displayClientName}
                  accountingPeriod={item.accountingPeriod}
                  rows={item.extractionPopup.rows}
                  sessionId={item.extractionPopup.sessionId}
                  reviewNotice={item.extractionPopup.reviewNotice}
                  successMessage={item.extractionPopup.successMessage}
                  rerunDisabled={item.extractionPopup.rerunDisabled}
                  sessionDetailLink={item.extractionPopup.sessionDetailLink}
                  adaptiveStructuring={item.extractionPopup.adaptiveStructuring}
                />
              </TableCell>
              <TableCell>
                <PayrollExcelStatusPopup
                  status={item.excelStatus}
                  displayClientName={item.displayClientName}
                  accountingPeriod={item.accountingPeriod}
                  selectionHref={item.href}
                  sessionId={item.excelPopup.sessionId}
                  passCount={item.excelPopup.passCount}
                  failCount={item.excelPopup.failCount}
                  latestDraft={item.excelPopup.latestDraft}
                  resultDownloadState={item.excelPopup.resultDownloadState}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{item.rowCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

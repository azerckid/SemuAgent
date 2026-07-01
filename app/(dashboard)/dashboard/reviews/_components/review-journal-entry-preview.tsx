import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS,
  journalEntryVoucherLineToExportRow,
  type JournalEntryVoucherLine,
} from '@/lib/bookkeeping/journal-entry-voucher-lines'

export function ReviewJournalEntryPreview({ lines }: { lines: JournalEntryVoucherLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        전표분개 초안이 생성되면 이 영역에 결과가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS.map((header, index) => (
              // 헤더에 'Code'가 두 번(계정과목 Code, 거래처 Code) 나오므로
              // 텍스트가 아니라 컬럼 인덱스를 key로 쓴다.
              <TableHead key={index} className="whitespace-nowrap">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.journalEntryRowId + line.side}>
              {journalEntryVoucherLineToExportRow(line).map((value, index) => (
                <TableCell key={index} className="max-w-48 truncate whitespace-nowrap">
                  {value}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

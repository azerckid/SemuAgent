import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { formatClassificationRowsForExport } from '@/lib/bookkeeping/export'

const PLAIN_COLUMNS = ['거래일자', '입금', '출금', 'AI추천', '추천 근거', '원천파일'] as const

export function ReviewAccountClassificationPreview({
  rows,
}: {
  rows: ReturnType<typeof formatClassificationRowsForExport>
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        계정항목 정리가 완료되면 이 영역에 결과가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">거래일자</TableHead>
            <TableHead className="whitespace-nowrap">거래처 / 적요</TableHead>
            <TableHead className="whitespace-nowrap">입금</TableHead>
            <TableHead className="whitespace-nowrap">출금</TableHead>
            <TableHead className="whitespace-nowrap">AI추천</TableHead>
            <TableHead className="whitespace-nowrap">추천 근거</TableHead>
            <TableHead className="whitespace-nowrap">원천파일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="whitespace-nowrap">{row.거래일자}</TableCell>
              <TableCell className="min-w-48 max-w-64">
                <p className="truncate font-medium text-foreground">{row.거래처 || '-'}</p>
                <p className="truncate text-xs text-muted-foreground">{row.적요 || '-'}</p>
              </TableCell>
              {PLAIN_COLUMNS.slice(1).map((column) => (
                <TableCell key={column} className="max-w-48 truncate whitespace-nowrap">
                  {row[column]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

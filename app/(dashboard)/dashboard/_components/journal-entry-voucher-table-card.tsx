'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS,
  type JournalEntryVoucherLine,
} from '@/lib/bookkeeping/journal-entry-voucher-lines'
import { cn } from '@/lib/utils'

function formatAmount(value: number) {
  return value.toLocaleString('ko-KR')
}

function memoNeedsExpandToggle(memo: string) {
  const text = memo.trim()
  return text.length > 30 || text.includes('\n')
}

function JournalEntryMemoCell({
  memo,
  journalEntryRowId,
  expanded,
  onToggle,
}: {
  memo: string
  journalEntryRowId: string
  expanded: boolean
  onToggle: (journalEntryRowId: string) => void
}) {
  const text = memo.trim()
  if (!text) {
    return <span className="text-muted-foreground">-</span>
  }

  const canExpand = memoNeedsExpandToggle(text)

  if (!canExpand) {
    return <p className="min-w-48 max-w-xs truncate text-sm">{text}</p>
  }

  return (
    <button
      type="button"
      className={cn(
        'flex min-w-48 max-w-xs gap-1 text-left',
        expanded ? 'items-start' : 'items-center',
      )}
      aria-expanded={expanded}
      aria-label={expanded ? '적요 접기' : '적요 펼치기'}
      onClick={() => onToggle(journalEntryRowId)}
    >
      <ChevronRight
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform',
          expanded ? 'mt-0.5 rotate-90' : undefined,
        )}
      />
      <span className={cn('min-w-0 flex-1 text-sm wrap-break-word', !expanded && 'truncate')}>{text}</span>
    </button>
  )
}

// 자료 검토 > 전표 분개표와 회계연도 장부 누적 전표 분개표가 같은 모양을 쓰도록
// 검색/테이블/적요 펼치기를 한 곳에 모았다. 둘 중 한쪽만 고치면 벌어지는 일을 막는다.
export function JournalEntryVoucherTableCard({
  voucherLines,
  exportHref,
  emptyMessage = '계정항목 정리 후 전표 분개표를 생성할 수 있습니다.',
}: {
  voucherLines: JournalEntryVoucherLine[]
  exportHref: string
  emptyMessage?: string
}) {
  const [query, setQuery] = useState('')
  const [expandedMemoRowIds, setExpandedMemoRowIds] = useState<Set<string>>(() => new Set())

  const filteredVoucherLines = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return voucherLines
    return voucherLines.filter((line) =>
      [
        line.entryDate,
        line.voucherNumber,
        line.accountName,
        line.counterparty,
        line.memo,
        line.side === 'debit' ? '차변' : '대변',
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [query, voucherLines])

  function toggleMemoRow(journalEntryRowId: string) {
    setExpandedMemoRowIds((current) => {
      const next = new Set(current)
      if (next.has(journalEntryRowId)) next.delete(journalEntryRowId)
      else next.add(journalEntryRowId)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>전표 분개표</CardTitle>
            <CardDescription>아래 표와 다운로드 파일은 동일한 전표 행 형식입니다.</CardDescription>
          </div>
          <Link
            href={exportHref}
            className={cn(buttonVariants({ variant: 'outline' }), voucherLines.length === 0 && 'pointer-events-none opacity-50')}
          >
            <Download className="size-4" />
            전표 분개표 엑셀
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="전표번호, 계정과목, 거래처, 적요 검색"
          className="max-w-sm"
        />

        {filteredVoucherLines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {voucherLines.length === 0 ? emptyMessage : '검색 조건에 맞는 전표 행이 없습니다.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS.map((header, index) => (
                    <TableHead key={`${header}-${index}`}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVoucherLines.map((line) => (
                  <TableRow
                    key={`${line.journalEntryRowId}-${line.side}-${line.accountName}`}
                    className={line.side === 'credit' ? 'bg-muted/20' : undefined}
                  >
                    <TableCell className="whitespace-nowrap text-sm">{line.entryDate || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium">{line.voucherNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{line.side === 'debit' ? '차변' : '대변'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{line.accountCode || ''}</TableCell>
                    <TableCell className="min-w-40 whitespace-nowrap text-sm">{line.accountName || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatAmount(line.debitAmountKrw)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatAmount(line.creditAmountKrw)}</TableCell>
                    <TableCell className="min-w-40 whitespace-nowrap text-sm">{line.counterparty || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{line.counterpartyCode || ''}</TableCell>
                    <TableCell className="min-w-48 text-sm">
                      <JournalEntryMemoCell
                        memo={line.memo}
                        journalEntryRowId={line.journalEntryRowId}
                        expanded={expandedMemoRowIds.has(line.journalEntryRowId)}
                        onToggle={toggleMemoRow}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

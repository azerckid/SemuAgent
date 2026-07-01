import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fromISO } from '@/lib/time'
import { cn } from '@/lib/utils'
import { consoleBadgeClass, consoleCardDescriptionClass, consoleCardTitleClass } from './mail-console-styles'
import type { MailHistoryEmailType, MailHistoryRow } from './mail-console-types'

interface MailHistoryPanelProps {
  history: MailHistoryRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
    sentCount: number
    failedCount: number
  }
}

const EMAIL_TYPE_LABEL: Record<MailHistoryEmailType, string> = {
  upload_request: '자료 요청',
  missing_request: '보충 요청',
  completion_thanks: '완료 감사',
  reminder: '리마인더',
  staff_notification: '내부 알림',
  transaction_purpose_request: '거래 용도 확인',
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('MM/dd HH:mm') : '-'
}

function buildHistoryPageHref(page: number) {
  const searchParams = new URLSearchParams()
  searchParams.set('tab', 'history')
  if (page > 1) searchParams.set('historyPage', String(page))
  return `/dashboard/emails?${searchParams.toString()}`
}

function emailStatusBadge(row: MailHistoryRow) {
  if (row.status === 'sent') {
    return <Badge variant="success" className={consoleBadgeClass}>발송됨</Badge>
  }
  if (row.status === 'failed') {
    return <Badge variant="destructive" className={consoleBadgeClass}>실패</Badge>
  }
  if (row.status === 'draft') {
    return <Badge variant="secondary" className={consoleBadgeClass}>초안</Badge>
  }
  return <Badge variant="secondary" className={consoleBadgeClass}>거부</Badge>
}

export function MailHistoryPanel({ history, pagination }: MailHistoryPanelProps) {
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className={consoleCardTitleClass}>발송 이력</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            발송 결과를 50건씩 확인합니다. 자동으로 발송되는 리마인더 메일과 관리자가 결정한 보충 요청 메일이 포함되어 있습니다.
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="success" className={consoleBadgeClass}>발송 {pagination.sentCount}</Badge>
          <Badge variant={pagination.failedCount > 0 ? 'destructive' : 'secondary'} className={consoleBadgeClass}>
            실패 {pagination.failedCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-semibold text-foreground">아직 발송 이력이 없습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">
              요청 메일이나 보충 요청 메일이 발송되면 이 탭에 표시됩니다.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객사</TableHead>
                <TableHead>메일</TableHead>
                <TableHead>수신자</TableHead>
                <TableHead>발송</TableHead>
                <TableHead className="text-right">세션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-semibold text-foreground">{row.clientName}</div>
                    <div className="text-xs text-muted-foreground">{row.accountingPeriod}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{EMAIL_TYPE_LABEL[row.type]}</div>
                    <div className="max-w-[280px] truncate text-xs text-muted-foreground">{row.subject}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] truncate text-xs text-muted-foreground">{row.toEmail}</div>
                    {row.ccEmail && (
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">CC {row.ccEmail}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {emailStatusBadge(row)}
                      <span className="text-xs text-muted-foreground">{formatDate(row.sentAt ?? row.createdAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/sessions/${row.sessionId}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      보기
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex min-h-12 flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            {pagination.total === 0
              ? '발송 이력 0건'
              : `페이지 ${pagination.page.toLocaleString('ko-KR')} / ${lastPage.toLocaleString('ko-KR')}`}
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={pagination.page <= 1}
              href={buildHistoryPageHref(Math.max(1, pagination.page - 1))}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                pagination.page <= 1 && 'pointer-events-none opacity-40',
              )}
            >
              이전
            </Link>
            <Link
              aria-disabled={pagination.page >= lastPage}
              href={buildHistoryPageHref(Math.min(lastPage, pagination.page + 1))}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                pagination.page >= lastPage && 'pointer-events-none opacity-40',
              )}
            >
              다음
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

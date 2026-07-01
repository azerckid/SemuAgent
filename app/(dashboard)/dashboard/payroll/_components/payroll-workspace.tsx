import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PayrollSummary } from '@/lib/payroll/load-payroll-summary-by-event-id'
import {
  DOUZONE_UPLOAD_PREVIEW_ALLOWANCE_GROUP_LABEL,
  DOUZONE_UPLOAD_PREVIEW_EARNING_FIELDS,
  DOUZONE_UPLOAD_PREVIEW_IDENTITY_FIELDS,
  getDouzoneUploadPreviewCellValue,
  isDouzoneUploadPreviewNumericField,
} from '@/lib/payroll/douzone-upload-preview'
import { PayrollRequestList, type PayrollRequestListItem } from './payroll-request-list'

function buildPayrollHref(params: { eventId?: string; q?: string; page?: number }) {
  const searchParams = new URLSearchParams()
  if (params.eventId) searchParams.set('eventId', params.eventId)
  if (params.q) searchParams.set('q', params.q)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  const query = searchParams.toString()
  return query ? `/dashboard/payroll?${query}` : '/dashboard/payroll'
}

const EXCEL_PREVIEW_ALLOWANCE_COLUMN_COUNT = DOUZONE_UPLOAD_PREVIEW_EARNING_FIELDS.length

function formatPreviewCellValue(value: string | number | null, numeric?: boolean) {
  if (numeric) {
    if (typeof value !== 'number') return '-'
    return value.toLocaleString('ko-KR')
  }
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

export function PayrollWorkspace({
  items,
  query,
  page,
  pageSize,
  totalEvents,
  selectedSummary,
  summaryNotFound = false,
  appliedRuleBasis = null,
}: {
  items: PayrollRequestListItem[]
  query: string
  page: number
  pageSize: number
  totalEvents: number
  selectedSummary: PayrollSummary | null
  summaryNotFound?: boolean
  appliedRuleBasis?: { clientId: string; label: string | null } | null
}) {
  const lastPage = Math.max(1, Math.ceil(totalEvents / pageSize))
  const selectedEventId = selectedSummary?.event.id

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">급여정산</h1>
            <Badge variant="info">Base</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            요청 목록을 테이블로 스캔하고, 자료/추출/엑셀 상태는 각각 팝업으로 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/direct-upload?kind=payroll" className={buttonVariants()}>
            담당자 직접 업로드
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{query ? '검색 결과에 해당하는 요청이 없습니다' : '급여정산 요청이 없습니다'}</CardTitle>
            <CardDescription>
              {query
                ? '다른 고객사명이나 회계기간으로 다시 검색해 보세요.'
                : '기본업무메일에서 급여정산 자료 요청 메일을 발송하면 이 화면에서 진행 상태를 모아 볼 수 있습니다.'}
            </CardDescription>
            <form action="/dashboard/payroll" method="get" className="mt-2 flex gap-2">
              <Input type="search" name="q" defaultValue={query} placeholder="고객사명, 담당자, 급여기간, 요청 방식 검색" className="h-9" />
              <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'h-9 shrink-0')}>
                검색
              </button>
            </form>
          </CardHeader>
          {query ? (
            <CardContent>
              <Link href="/dashboard/payroll" className={buttonVariants()}>
                검색 초기화
              </Link>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">급여 요청 목록</CardTitle>
              <CardDescription>요청별 자료·추출·엑셀 상태를 한 행에서 확인합니다.</CardDescription>
              <form action="/dashboard/payroll" method="get" className="mt-2 flex gap-2">
                <Input type="search" name="q" defaultValue={query} placeholder="고객사명, 담당자, 급여기간, 요청 방식 검색" className="h-9" />
                <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'h-9 shrink-0')}>
                  검색
                </button>
              </form>
              {query ? (
                <Link href="/dashboard/payroll" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  검색 초기화
                </Link>
              ) : null}
            </CardHeader>
            <CardContent>
              <PayrollRequestList items={items} />
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>
                  {totalEvents === 0 ? '요청 0건' : `페이지 ${page.toLocaleString('ko-KR')} / ${lastPage.toLocaleString('ko-KR')}`}
                </span>
                <div className="flex gap-2">
                  <Link
                    aria-disabled={page <= 1}
                    href={buildPayrollHref({ eventId: selectedEventId, q: query, page: Math.max(1, page - 1) })}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      page <= 1 && 'pointer-events-none opacity-40',
                    )}
                  >
                    이전
                  </Link>
                  <Link
                    aria-disabled={page >= lastPage}
                    href={buildPayrollHref({ eventId: selectedEventId, q: query, page: Math.min(lastPage, page + 1) })}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      page >= lastPage && 'pointer-events-none opacity-40',
                    )}
                  >
                    다음
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">엑셀 결과 미리보기</CardTitle>
              <CardDescription>
                선택한 요청의 초안이 생성되면 다운로드 전에 업로드용 엑셀(A~U)과 같은 표 형태로 확인합니다.
              </CardDescription>
              {appliedRuleBasis && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={appliedRuleBasis.label ? 'info' : 'secondary'}>
                    적용 기준: {appliedRuleBasis.label ?? '기본 법정 기준 + 자료 기반 계산'}
                  </Badge>
                  <Link
                    href={`/dashboard/clients/${appliedRuleBasis.clientId}?tab=payrollRule`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    급여기준 보기 →
                  </Link>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {summaryNotFound ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  요청한 급여 요청을 찾을 수 없습니다.
                </div>
              ) : selectedSummary?.generatedDraft ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    {selectedSummary.displayClientName} · {selectedSummary.event.accountingPeriod} — 이 표는 검수용 미리보기입니다. 실제 다운로드 파일은 기존 템플릿의 시트, 컬럼, 서식, 수식을 보존합니다. 다운로드는 엑셀 상태 팝업에서 진행하세요.
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          {DOUZONE_UPLOAD_PREVIEW_IDENTITY_FIELDS.map((field) => (
                            <TableHead
                              key={field.field}
                              rowSpan={2}
                              className="whitespace-nowrap align-bottom"
                            >
                              {field.label}
                            </TableHead>
                          ))}
                          <TableHead
                            colSpan={EXCEL_PREVIEW_ALLOWANCE_COLUMN_COUNT}
                            className="border-l text-center"
                          >
                            {DOUZONE_UPLOAD_PREVIEW_ALLOWANCE_GROUP_LABEL}
                          </TableHead>
                        </TableRow>
                        <TableRow>
                          {DOUZONE_UPLOAD_PREVIEW_EARNING_FIELDS.map((field) => (
                            <TableHead
                              key={field.field}
                              className={cn(
                                'whitespace-nowrap',
                                field.field === 'base_salary' && 'border-l',
                                isDouzoneUploadPreviewNumericField(field.field) && 'text-right',
                              )}
                            >
                              {field.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSummary.rows
                          .filter((row) => row.aiVerdict === 'pass')
                          .map((row) => (
                            <TableRow key={row.id}>
                              {DOUZONE_UPLOAD_PREVIEW_IDENTITY_FIELDS.map((field) => (
                                <TableCell key={field.field} className="whitespace-nowrap">
                                  {formatPreviewCellValue(getDouzoneUploadPreviewCellValue(row, field.field))}
                                </TableCell>
                              ))}
                              {DOUZONE_UPLOAD_PREVIEW_EARNING_FIELDS.map((field) => (
                                <TableCell
                                  key={field.field}
                                  className={cn(
                                    'whitespace-nowrap tabular-nums',
                                    field.field === 'base_salary' && 'border-l',
                                    isDouzoneUploadPreviewNumericField(field.field) && 'text-right',
                                  )}
                                >
                                  {formatPreviewCellValue(
                                    getDouzoneUploadPreviewCellValue(row, field.field),
                                    isDouzoneUploadPreviewNumericField(field.field),
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  결과 엑셀 초안이 생성되면 이 영역에 다운로드 전 미리보기 표가 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

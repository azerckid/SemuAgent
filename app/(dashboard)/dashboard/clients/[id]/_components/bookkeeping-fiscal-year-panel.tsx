'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import {
  LEDGER_STATUS_META,
  buildLedgerPeriodOptions,
  summarizeLedgerPeriod,
  type LedgerMonthView,
} from './bookkeeping-fiscal-year-panel-helpers'

type FiscalYearLedgerSummary = {
  ledger: {
    id: string
    fiscalYear: number
    status: string
  }
  months: LedgerMonthView[]
}

type ClassificationRow = {
  id: string
  periodMonth: string
  transactionDate: string | null
  merchantName: string | null
  description: string | null
  amountKrw: number | null
  direction: string
  recommendedAccount: string | null
  recommendationConfidence?: 'high' | 'medium' | 'low'
  finalAccount: string | null
  status: string
  sourceFilename?: string | null
}

type ClassificationResult = {
  ok: true
  sessionCount: number
  excludedUnknownDateCount: number
  excludedNotAcceptedFileCount: number
  rows: ClassificationRow[]
}

type ViewState =
  | { status: 'idle' | 'loading' }
  | { status: 'classification'; data: ClassificationResult }
  | { status: 'error'; message: string }

const numberFormatter = new Intl.NumberFormat('ko-KR')

function formatKrw(value: number | null | undefined) {
  if (value == null) return '-'
  return `${numberFormatter.format(value)}원`
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    suggested: '추천',
    needs_decision: '검토필요',
    confirmed: '확정',
    unclassified: '미분류',
    excluded: '제외',
    draft: '초안',
    completed: '완료',
  }
  return labels[status] ?? status
}

function monthLabel(month: string | null | undefined) {
  if (!month) return '-'
  const monthValue = month.split('-')[1]
  return monthValue ? `${Number(monthValue)}월` : month
}

function effectiveAccount(row: ClassificationRow) {
  return row.finalAccount ?? row.recommendedAccount ?? 'unclassified'
}

function accountLabel(account: string | null | undefined) {
  return labelForBookkeepingAccountCategory(account) || '-'
}

function amountByDirection(row: ClassificationRow, direction: 'income' | 'expense') {
  if (row.direction !== direction) return '-'
  return formatKrw(row.amountKrw)
}

function signedAmount(row: ClassificationRow) {
  const amount = row.amountKrw ?? 0
  return row.direction === 'expense' ? -amount : amount
}

function rowAttributionLabel(row: ClassificationRow) {
  if (row.status === 'excluded') return '제외'
  if (row.status === 'unclassified' && !row.finalAccount) return '미분류'
  if (row.finalAccount && row.finalAccount !== row.recommendedAccount) return '담당'
  return 'AI'
}

function rowAttributionBadgeVariant(row: ClassificationRow) {
  const label = rowAttributionLabel(row)
  if (label === 'AI') return 'success' as const
  if (label === '담당') return 'info' as const
  if (label === '미분류') return 'warning' as const
  return 'secondary' as const
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? '데이터를 불러오지 못했습니다.')
  }
  return payload as T
}

export function BookkeepingFiscalYearPanel({
  clientId,
  summary,
}: {
  clientId: string
  summary: FiscalYearLedgerSummary
}) {
  const fiscalYear = summary.ledger.fiscalYear
  const [period, setPeriod] = useState(String(fiscalYear))
  const [viewState, setViewState] = useState<ViewState>({ status: 'idle' })

  const periodOptions = useMemo(() => buildLedgerPeriodOptions(fiscalYear), [fiscalYear])
  const yearOptions = periodOptions.filter((option) => option.type === 'year' || option.type === 'half' || option.type === 'quarter')
  const periodSummary = useMemo(
    () => summarizeLedgerPeriod({ fiscalYear, months: summary.months, period }),
    [fiscalYear, period, summary.months],
  )
  const selectedPeriodLabel = periodSummary.option.label

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function load() {
      setViewState({ status: 'loading' })
      try {
        const data = await fetchJson<ClassificationResult>(
          `/api/bookkeeping-ledgers/${summary.ledger.id}/account-classification?period=${encodeURIComponent(period)}`,
          controller.signal,
        )
        if (cancelled) return
        setViewState({ status: 'classification', data })
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        setViewState({ status: 'error', message: error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.' })
      }
    }
    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [period, summary.ledger.id])

  return (
    <section id="bookkeeping-ledger" className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-semibold text-gray-950">기장 연간 장부</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            월별로 누적된 자료, 계정항목 정리, 전표 초안 상태를 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/dashboard/clients/${clientId}?ledgerYear=${fiscalYear - 1}#bookkeeping-ledger`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            {fiscalYear - 1}
          </Link>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
            {fiscalYear}
          </span>
          <Link
            href={`/dashboard/clients/${clientId}?ledgerYear=${fiscalYear + 1}#bookkeeping-ledger`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            {fiscalYear + 1}
          </Link>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">표시 월</p>
            <p className="mt-1 text-lg font-semibold text-gray-950">12개월</p>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">포함 자료</p>
            <p className="mt-1 text-lg font-semibold text-gray-950">
              {numberFormatter.format(summary.months.reduce((sum, month) => sum + month.counts.includedMaterialCount, 0))}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">계정항목 정리</p>
            <p className="mt-1 text-lg font-semibold text-gray-950">
              {numberFormatter.format(summary.months.reduce((sum, month) => sum + month.counts.completedClassificationRunCount, 0))}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">전표 초안</p>
            <p className="mt-1 text-lg font-semibold text-gray-950">
              {numberFormatter.format(summary.months.reduce((sum, month) => sum + month.counts.journalEntryRunCount, 0))}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {yearOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  period === option.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {summary.months.map((month) => {
              const meta = LEDGER_STATUS_META[month.status]
              const isSelected = period === month.periodMonth
              return (
                <div
                  key={month.id}
                  className={`min-h-28 rounded-md border p-3 text-left transition ${
                    isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <button type="button" onClick={() => setPeriod(month.periodMonth)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-950">{Number(month.periodMonth.slice(5, 7))}월</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1 text-xs text-gray-500">
                      <span>자료 {month.counts.includedMaterialCount}</span>
                      <span>계정 {month.counts.completedClassificationRunCount}</span>
                      <span>전표 {month.counts.journalEntryRunCount}</span>
                    </div>
                  </button>
                  {month.lastUploadSessionId ? (
                    <Link
                      href={`/dashboard/sessions/${month.lastUploadSessionId}`}
                      className="mt-3 inline-flex text-xs font-medium text-blue-700 hover:underline"
                    >
                      최근 세션 보기
                    </Link>
                  ) : (
                    <p className="mt-3 text-xs text-gray-400">최근 세션 없음</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-md border border-gray-200">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-gray-950">{selectedPeriodLabel} 누적 보기</p>
              <p className="mt-0.5 text-xs text-gray-500">
                자료 {periodSummary.totals.includedMaterialCount}건 · 계정항목 {periodSummary.totals.completedClassificationRunCount}건 · 전표 {periodSummary.totals.journalEntryRunCount}건
              </p>
            </div>
            <Link
              href={`/dashboard/clients/${clientId}/bookkeeping-ledger/journal-entry?period=${encodeURIComponent(period)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              전표 분개표 보기
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="min-h-48 p-4">{renderAccumulatedView(viewState)}</div>
        </div>
      </div>
    </section>
  )
}

function renderAccumulatedView(viewState: ViewState) {
  switch (viewState.status) {
    case 'idle':
    case 'loading':
      return <div className="py-12 text-center text-sm text-gray-400">누적 데이터를 불러오는 중입니다.</div>
    case 'error':
      return <div className="rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-700">{viewState.message}</div>
    case 'classification':
      return <ClassificationPreview data={viewState.data} />
  }
}

function ClassificationPreview({ data }: { data: ClassificationResult }) {
  if (data.rows.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-400">선택한 기간의 누적 계정항목 정리 결과가 없습니다.</div>
  }

  const groups = Array.from(data.rows.reduce((map, row) => {
    const account = effectiveAccount(row)
    const group = map.get(account) ?? {
      account,
      rows: [] as ClassificationRow[],
      monthly: new Map<string, { count: number; amount: number }>(),
      totalAmount: 0,
    }
    const month = row.periodMonth
    const monthSummary = group.monthly.get(month) ?? { count: 0, amount: 0 }
    monthSummary.count += 1
    monthSummary.amount += signedAmount(row)
    group.monthly.set(month, monthSummary)
    group.rows.push(row)
    group.totalAmount += signedAmount(row)
    map.set(account, group)
    return map
  }, new Map<string, {
    account: string
    rows: ClassificationRow[]
    monthly: Map<string, { count: number; amount: number }>
    totalAmount: number
  }>()).values()).sort((a, b) => {
    if (a.account === 'unclassified') return -1
    if (b.account === 'unclassified') return 1
    return accountLabel(a.account).localeCompare(accountLabel(b.account), 'ko-KR')
  })

  const monthKeys = Array.from(new Set(data.rows.map((row) => row.periodMonth))).sort()

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const isUnclassifiedGroup = group.account === 'unclassified'
        return (
          <details
            key={group.account}
            className={`rounded-lg border ${
              isUnclassifiedGroup ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'
            }`}
            open={isUnclassifiedGroup}
          >
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-semibold ${isUnclassifiedGroup ? 'text-amber-900' : 'text-gray-950'}`}>
                      {accountLabel(group.account)}
                    </h3>
                    <Badge variant={isUnclassifiedGroup ? 'warning' : 'secondary'}>총 {group.rows.length}건</Badge>
                  </div>
                  <p className={`mt-1 text-xs ${isUnclassifiedGroup ? 'text-amber-800/80' : 'text-gray-500'}`}>
                    합계 {formatKrw(Math.abs(group.totalAmount))}
                  </p>
                </div>
                <div className="grid min-w-[18rem] flex-1 grid-cols-2 gap-2 md:grid-cols-3">
                  {monthKeys.map((month) => {
                    const monthSummary = group.monthly.get(month)
                    return (
                      <div key={month} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="flex items-baseline gap-2 text-sm text-gray-600">
                          <span className="font-medium">{monthLabel(month)}</span>
                          <span className="font-semibold text-gray-950">{monthSummary?.count ?? 0}건</span>
                          <span className="text-xs text-gray-500">{formatKrw(Math.abs(monthSummary?.amount ?? 0))}</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </summary>
            <div className="border-t border-gray-100 p-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>월</TableHead>
                      <TableHead>일자</TableHead>
                      <TableHead>거래처 / 적요</TableHead>
                      <TableHead>입금</TableHead>
                      <TableHead>출금</TableHead>
                      <TableHead>계정항목</TableHead>
                      <TableHead>원천 파일</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">{monthLabel(row.periodMonth)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{row.transactionDate ?? '-'}</TableCell>
                        <TableCell className="min-w-64">
                          <p className="font-medium text-gray-950">{row.merchantName ?? '거래처 미확인'}</p>
                          <p className="line-clamp-2 text-xs text-gray-500">{row.description ?? '-'}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium text-emerald-700">
                          {amountByDirection(row, 'income')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium text-slate-700">
                          {amountByDirection(row, 'expense')}
                        </TableCell>
                        <TableCell className="min-w-40">
                          <p className="text-sm font-medium text-gray-950">{accountLabel(row.finalAccount ?? row.recommendedAccount)}</p>
                          {row.recommendedAccount && row.finalAccount && row.finalAccount !== row.recommendedAccount ? (
                            <p className="mt-1 text-xs text-gray-500">추천: {accountLabel(row.recommendedAccount)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-36 text-xs text-gray-500">{row.sourceFilename ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={rowAttributionBadgeVariant(row)}>{rowAttributionLabel(row)}</Badge>
                          <p className="mt-1 text-xs text-gray-500">{statusLabel(row.status)}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}

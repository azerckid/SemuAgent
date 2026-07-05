'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, RefreshCw, RotateCcw, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isDisplayableClassificationRow } from '@/lib/bookkeeping/classification-rows'
import { cn } from '@/lib/utils'

type Category = { key: string; label: string }
type Eligibility = { eligible: true; reason: string } | { eligible: false; reason: string; workType: string }
type Run = {
  id: string
  status: 'draft' | 'running' | 'completed' | 'failed' | 'superseded'
  extractedRowCount: number
  confirmedRowCount: number
  unclassifiedRowCount: number
  errorMessage: string | null
}
type Row = {
  id: string
  transactionDate: string | null
  sourceType: string
  merchantName: string | null
  description: string | null
  amountKrw: number | null
  direction: string
  recommendedAccount: string | null
  recommendationConfidence: 'high' | 'medium' | 'low'
  recommendationReason: string | null
  finalAccount: string | null
  staffMemo: string | null
  status: 'suggested' | 'needs_decision' | 'confirmed' | 'unclassified' | 'excluded'
  sourceFilename: string | null
  purposeAnswer: {
    id: string
    requestId: string
    requestStatus: string
    isStale: boolean
    status: 'pending' | 'answered' | 'staff_confirmed'
    purposeCode: string | null
    purposeLabel: string | null
    purposeMemo: string | null
    answeredAt: string | null
    staffFinalAccount: string | null
    staffMemo: string | null
  } | null
}

type InitialData = {
  categories: Category[]
  eligibility: Eligibility
  run: Run | null
  displayRun: Run | null
  progressRun: Run | null
  latestAttemptRun: Run | null
  rows: Row[]
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return '-'
  return `${value.toLocaleString('ko-KR')}원`
}

function amountByDirection(row: Row, direction: 'income' | 'expense') {
  if (row.direction !== direction) return '-'
  return formatAmount(row.amountKrw)
}

function categoryLabel(categories: Category[], key: string | null) {
  if (!key) return '-'
  return categories.find((category) => category.key === key)?.label ?? key
}

function needsStaffAttention(row: Row) {
  if (row.status === 'needs_decision' || row.status === 'unclassified') return true
  if (row.purposeAnswer?.status === 'pending' || row.purposeAnswer?.status === 'answered') return true
  if (row.finalAccount && row.recommendedAccount && row.finalAccount !== row.recommendedAccount) return true
  if (row.finalAccount && !row.recommendedAccount) return true
  return false
}

function purposeAnswerText(row: Row) {
  const answer = row.purposeAnswer
  if (!answer) return '-'
  return answer.purposeMemo?.trim()
    || answer.purposeLabel
    || answer.purposeCode
    || '답변 도착'
}

export function AccountClassificationWorkspace({
  sessionId,
  clientName,
  accountingPeriod,
  initialData,
}: {
  sessionId: string
  clientName: string
  accountingPeriod: string
  initialData: InitialData
}) {
  const [data, setData] = useState(initialData)
  const [message, setMessage] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRefreshingLatest, setIsRefreshingLatest] = useState(false)
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set())
  const isRunRunning = Boolean(data.progressRun)
  const isBusy = isStarting || isCancelling || isRefreshingLatest || savingRowIds.size > 0
  const statusRun = data.progressRun ?? data.displayRun ?? data.run
  const showAttemptFailure = data.latestAttemptRun?.status === 'failed' && !data.progressRun

  const previewRows = useMemo(() => data.rows.filter(isDisplayableClassificationRow), [data.rows])
  const canEditRows = data.displayRun?.status === 'completed'

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/account-classification`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '새로고침에 실패했습니다.')
    setData(json)
  }, [sessionId])

  useEffect(() => {
    if (!isRunRunning) return

    const intervalId = window.setInterval(() => {
      refresh().catch(() => undefined)
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [isRunRunning, refresh])

  async function reflectLatestAnswers() {
    setMessage(null)
    setIsRefreshingLatest(true)
    try {
      await refresh()
      setMessage('최신 답변과 담당자 수정 내용을 반영했습니다.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '최신 상태 반영에 실패했습니다.')
    } finally {
      setIsRefreshingLatest(false)
    }
  }

  function startClassification(options?: { reset?: boolean }) {
    const isReset = Boolean(options?.reset)
    setMessage(null)
    setIsStarting(true)
    fetch(`/api/sessions/${sessionId}/account-classification/start`, { method: 'POST' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '계정항목 정리에 실패했습니다.')
        await refresh()
        setMessage(isReset ? `${json.rowCount ?? 0}개 거래 행을 초기화 후 다시 분석했습니다.` : `${json.rowCount ?? 0}개 거래 행을 정리했습니다.`)
      })
      .catch(async (err) => {
        setMessage(err instanceof Error ? err.message : '계정항목 정리에 실패했습니다.')
        await refresh().catch(() => undefined)
      })
      .finally(() => setIsStarting(false))
  }

  function resetClassification() {
    if (data.displayRun && !window.confirm('현재 계정항목 정리 결과를 초기화하고 AI 계정항목 분석을 다시 실행합니다. 담당자가 수정한 내용이 영향을 받을 수 있습니다. 계속할까요?')) return
    startClassification({ reset: Boolean(data.displayRun) })
  }

  function cancelClassification() {
    setMessage(null)
    setIsCancelling(true)
    fetch(`/api/sessions/${sessionId}/account-classification/cancel`, { method: 'POST' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '계정항목 정리 중단에 실패했습니다.')
        await refresh()
        setMessage((json.cancelledCount ?? 0) > 0 ? '계정항목 정리를 중단했습니다.' : '진행 중인 계정항목 정리가 없습니다.')
      })
      .catch(async (err) => {
        setMessage(err instanceof Error ? err.message : '계정항목 정리 중단에 실패했습니다.')
        await refresh().catch(() => undefined)
      })
      .finally(() => setIsCancelling(false))
  }

  function updateRow(row: Row, patch: Partial<Row>) {
    setMessage(null)
    const previousRow = data.rows.find((item) => item.id === row.id) ?? row
    const payload = {
      finalAccount: patch.finalAccount ?? row.finalAccount,
      staffMemo: patch.staffMemo ?? row.staffMemo,
      status: patch.status ?? row.status,
      purposeRequestRowId:
        (patch.status ?? row.status) === 'confirmed' && (row.purposeAnswer?.status === 'answered' || row.purposeAnswer?.status === 'staff_confirmed')
          ? row.purposeAnswer.id
          : undefined,
    }

    setSavingRowIds((prev) => new Set(prev).add(row.id))
    setData((prev) => ({
      ...prev,
      rows: prev.rows.map((item) => {
        if (item.id !== row.id) return item
        const nextPurposeAnswer = payload.purposeRequestRowId && item.purposeAnswer
          ? {
            ...item.purposeAnswer,
            status: 'staff_confirmed' as const,
            staffFinalAccount: payload.finalAccount ?? null,
            staffMemo: payload.staffMemo ?? null,
          }
          : item.purposeAnswer

        return {
          ...item,
          finalAccount: payload.finalAccount ?? null,
          staffMemo: payload.staffMemo ?? null,
          status: payload.status,
          purposeAnswer: nextPurposeAnswer,
        }
      }),
    }))

    fetch(`/api/sessions/${sessionId}/account-classification/rows/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '행 저장에 실패했습니다.')
      })
      .catch((err) => {
        setData((prev) => ({
          ...prev,
          rows: prev.rows.map((item) => (item.id === row.id ? previousRow : item)),
        }))
        setMessage(err instanceof Error ? err.message : '행 저장에 실패했습니다.')
      })
      .finally(() => {
        setSavingRowIds((prev) => {
          const next = new Set(prev)
          next.delete(row.id)
          return next
        })
      })
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">기장 계정항목 정리</h1>
            <Badge variant={statusRun?.status === 'completed' ? 'success' : statusRun?.status === 'failed' ? 'destructive' : 'secondary'}>
              {statusRun ? statusRun.status : '미실행'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {clientName} · {accountingPeriod} · 전표 분개표로 넘길 실제 거래행의 계정항목을 정리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/reviews?sessionId=${sessionId}`} className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" />
            자료 검토
          </Link>
          {isRunRunning || isStarting ? (
            <Button variant="outline" onClick={cancelClassification} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              정리 중단
            </Button>
          ) : null}
          {data.displayRun ? (
            <>
              <Button variant="outline" onClick={reflectLatestAnswers} disabled={isBusy || isRunRunning}>
                {isRefreshingLatest ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                최신답변반영
              </Button>
              <Button variant="outline" onClick={resetClassification} disabled={!data.eligibility.eligible || isBusy || isRunRunning}>
                {isStarting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                초기화
              </Button>
            </>
          ) : (
            <Button onClick={() => startClassification()} disabled={!data.eligibility.eligible || isBusy || isRunRunning}>
              {isStarting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              계정항목 정리 시작
            </Button>
          )}
        </div>
      </div>

      {!data.eligibility.eligible && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{data.eligibility.reason}</CardContent>
        </Card>
      )}

      {message && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      )}

      {showAttemptFailure && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {data.latestAttemptRun?.errorMessage ?? '계정항목 추천 생성에 실패했습니다. 다시 실행하거나 수동으로 정리해 주세요.'}
            {data.displayRun ? ' 이전에 완료된 정리 결과는 아래에 그대로 표시됩니다.' : null}
          </CardContent>
        </Card>
      )}

      {isRunRunning && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
            <span>계정항목 정리가 진행 중입니다. 오래 걸리면 정리 중단 후 다시 실행할 수 있습니다.</span>
            <Button variant="outline" size="sm" onClick={cancelClassification} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              정리 중단
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>계정항목 미리보기</CardTitle>
                <Badge variant="success">{previewRows.length}건</Badge>
              </div>
              <CardDescription>
                선택한 요청의 기간이 겹치는 달에 대해 fiscal-year ledger에 누적된 계정항목 정리 결과를 확인합니다.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/api/sessions/${sessionId}/account-classification/export?scope=all`}
                className={cn(buttonVariants({ variant: 'outline' }), (!canEditRows || data.rows.length === 0) && 'pointer-events-none opacity-50')}
              >
                <Download className="size-4" />
                전체 검토표 엑셀
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {previewRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {data.rows.length === 0
                ? '분류할 거래 행이 아직 없습니다. 계정항목 정리를 시작해 주세요.'
                : '표시할 거래 행이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">거래일자</TableHead>
                    <TableHead className="whitespace-nowrap">거래처 / 적요</TableHead>
                    <TableHead className="whitespace-nowrap">입금</TableHead>
                    <TableHead className="whitespace-nowrap">출금</TableHead>
                    <TableHead className="whitespace-nowrap">AI추천</TableHead>
                    <TableHead className="whitespace-nowrap">계정항목</TableHead>
                    <TableHead className="whitespace-nowrap">추천 근거</TableHead>
                    <TableHead className="whitespace-nowrap">고객 답변</TableHead>
                    <TableHead className="whitespace-nowrap">원천파일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(needsStaffAttention(row) && 'bg-amber-50/70 hover:bg-amber-50')}
                    >
                      <TableCell className="whitespace-nowrap">{row.transactionDate ?? '-'}</TableCell>
                      <TableCell className="min-w-48 max-w-72">
                        <p className="truncate font-medium text-foreground">{row.merchantName ?? '-'}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.description ?? '-'}</p>
                      </TableCell>
                      <TableCell className="max-w-32 truncate whitespace-nowrap text-emerald-700">
                        {amountByDirection(row, 'income')}
                      </TableCell>
                      <TableCell className="max-w-32 truncate whitespace-nowrap text-slate-700">
                        {amountByDirection(row, 'expense')}
                      </TableCell>
                      <TableCell className="max-w-40 truncate whitespace-nowrap">
                        {categoryLabel(data.categories, row.recommendedAccount)}
                      </TableCell>
                      <TableCell className="min-w-44">
                        <Select
                          value={row.finalAccount ?? ''}
                          onChange={(event) => updateRow(row, {
                            finalAccount: event.target.value || null,
                            status: event.target.value ? 'confirmed' : row.status,
                          })}
                          disabled={!canEditRows || savingRowIds.has(row.id)}
                        >
                          <option value="">선택</option>
                          {data.categories.map((category) => (
                            <option key={category.key} value={category.key}>{category.label}</option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-56 truncate whitespace-nowrap">
                        {row.recommendationReason ?? '-'}
                      </TableCell>
                      <TableCell className="max-w-48 truncate whitespace-nowrap">
                        {purposeAnswerText(row)}
                      </TableCell>
                      <TableCell className="max-w-48 truncate whitespace-nowrap">
                        {row.sourceFilename ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

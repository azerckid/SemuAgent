'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2, Mail, PencilLine, RefreshCw, RotateCcw, Send, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isDisplayableClassificationRow } from '@/lib/bookkeeping/classification-rows'
import {
  resolvePurposeTemplate,
  type PurposeTemplateContext,
} from '@/lib/bookkeeping/transaction-purpose-template'
import type { PurposeRequestDraftView } from '@/lib/bookkeeping/transaction-purpose-service'
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

function formatDateOnly(value: string | null) {
  if (!value) return '별도 안내'
  return value.slice(0, 10)
}

function resolvePreviewText(text: string, ctx: PurposeTemplateContext) {
  return resolvePurposeTemplate(text, ctx)
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
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [isCreatingPurpose, setIsCreatingPurpose] = useState(false)
  const [isSendingPurpose, setIsSendingPurpose] = useState(false)
  const [isCancellingPurpose, setIsCancellingPurpose] = useState(false)
  const [purposeDraft, setPurposeDraft] = useState<PurposeRequestDraftView | null>(null)
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set())
  const isRunRunning = Boolean(data.progressRun)
  const isBusy = isStarting || isCancelling || isRefreshingLatest || isCreatingPurpose || isSendingPurpose || isCancellingPurpose || savingRowIds.size > 0
  const statusRun = data.progressRun ?? data.displayRun ?? data.run
  const showAttemptFailure = data.latestAttemptRun?.status === 'failed' && !data.progressRun

  const previewRows = useMemo(() => data.rows.filter(isDisplayableClassificationRow), [data.rows])
  const canEditRows = data.displayRun?.status === 'completed'
  const purposePreviewSubject = purposeDraft
    ? resolvePreviewText(purposeDraft.request.subjectSnapshot, purposeDraft.templateContext)
    : ''
  const purposePreviewBody = purposeDraft
    ? resolvePreviewText(purposeDraft.request.bodySnapshot, purposeDraft.templateContext)
    : ''

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

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  const createPurposeRequest = async () => {
    if (selectedRowIds.size === 0) return
    setMessage(null)
    setIsCreatingPurpose(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transaction-purpose-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedClassificationRowIds: [...selectedRowIds] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : '거래 용도 확인 요청 생성에 실패했습니다.')
      if (!json.id) throw new Error('생성된 확인 요청을 찾을 수 없습니다.')

      const detailRes = await fetch(`/api/transaction-purpose-requests/${json.id}`, { cache: 'no-store' })
      const detailJson = await detailRes.json()
      if (!detailRes.ok || !detailJson.ok) {
        throw new Error(typeof detailJson.error === 'string' ? detailJson.error : '메일 미리보기를 불러오지 못했습니다.')
      }
      setPurposeDraft({
        request: detailJson.request,
        rows: detailJson.rows,
        templateContext: detailJson.templateContext,
      })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '거래 용도 확인 요청 생성에 실패했습니다.')
    } finally {
      setIsCreatingPurpose(false)
    }
  }

  const cancelPurposeDraft = async () => {
    if (!purposeDraft) return
    setMessage(null)
    setIsCancellingPurpose(true)
    try {
      const res = await fetch(`/api/transaction-purpose-requests/${purposeDraft.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : '확인 요청 취소에 실패했습니다.')
      }
      setPurposeDraft(null)
      setSelectedRowIds(new Set())
      setMessage('계정항목 확인요청 메일 발송을 취소했습니다.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '확인 요청 취소에 실패했습니다.')
    } finally {
      setIsCancellingPurpose(false)
    }
  }

  const sendPurposeRequestMail = async () => {
    if (!purposeDraft) return
    setMessage(null)
    setIsSendingPurpose(true)
    try {
      const res = await fetch(`/api/transaction-purpose-requests/${purposeDraft.request.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : '계정항목 확인요청 메일 발송에 실패했습니다.')
      }
      setPurposeDraft(null)
      setSelectedRowIds(new Set())
      await refresh()
      setMessage('계정항목 확인요청 메일을 발송했습니다.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '계정항목 확인요청 메일 발송에 실패했습니다.')
    } finally {
      setIsSendingPurpose(false)
    }
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
              {selectedRowIds.size > 0 && (
                <span className="self-center text-xs text-muted-foreground">{selectedRowIds.size}건 선택</span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={createPurposeRequest}
                disabled={selectedRowIds.size === 0 || isCreatingPurpose || isBusy || Boolean(purposeDraft)}
              >
                {isCreatingPurpose ? '메일 준비 중...' : '계정항목 확인요청 메일 보내기'}
              </Button>
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
                    <TableHead className="w-10"></TableHead>
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
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          aria-label="거래 용도 확인 요청에 포함"
                          checked={selectedRowIds.has(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                          disabled={row.status === 'excluded'}
                          className="size-4"
                        />
                      </TableCell>
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

      <Dialog open={Boolean(purposeDraft)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
          {purposeDraft && (
            <>
              <DialogHeader className="border-b px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <Mail className="size-3.5" />
                      발송 전 확인
                    </div>
                    <DialogTitle className="text-xl font-semibold text-foreground">
                      계정항목 확인요청 메일 보내기
                    </DialogTitle>
                    <DialogDescription>
                      아직 발송되지 않았습니다. 수신자, 메일 내용, 고객에게 확인받을 거래를 확인한 뒤 발송합니다.
                    </DialogDescription>
                  </div>
                  <Badge variant="info">{purposeDraft.rows.length}건</Badge>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">고객사</p>
                    <p className="mt-1 font-semibold text-foreground">{purposeDraft.templateContext.clientName}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">답변 기한</p>
                    <p className="mt-1 font-semibold text-foreground">{formatDateOnly(purposeDraft.request.dueAt)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">확인 거래</p>
                    <p className="mt-1 font-semibold text-foreground">{purposeDraft.rows.length}건</p>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">메일 미리보기</p>
                    <p className="text-xs text-muted-foreground">메일 본문에는 거래 상세를 길게 넣지 않고, 고객은 링크 안에서 거래별 사용 용도를 입력합니다.</p>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">수신</p>
                      <p className="mt-1 text-sm text-foreground">{purposeDraft.templateContext.clientName} 담당자</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">제목</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{purposePreviewSubject}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">본문</p>
                      <pre className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-3 text-xs leading-5 text-foreground">
                        {purposePreviewBody}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">고객에게 확인받을 거래</p>
                    <p className="text-xs text-muted-foreground">고객은 계정항목을 고르지 않고, 각 거래의 사용 용도 설명만 입력합니다.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">거래일</TableHead>
                          <TableHead className="whitespace-nowrap">거래처 / 적요</TableHead>
                          <TableHead className="whitespace-nowrap text-right">금액</TableHead>
                          <TableHead className="whitespace-nowrap">AI추천</TableHead>
                          <TableHead className="whitespace-nowrap">확인 사유</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purposeDraft.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap text-xs">{row.sourceDisplayDate ?? '-'}</TableCell>
                            <TableCell className="min-w-48 max-w-72">
                              <p className="truncate text-sm font-medium text-foreground">{row.sourceDisplayCounterparty ?? '-'}</p>
                              <p className="truncate text-xs text-muted-foreground">{row.sourceDisplayMemo ?? '-'}</p>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-medium">
                              {formatAmount(row.sourceDisplayAmountKrw)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {categoryLabel(data.categories, row.aiRecommendedAccount)}
                            </TableCell>
                            <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                              {row.ambiguityReason ?? row.staffQuestion ?? '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  고객 답변은 계정항목을 자동 확정하지 않습니다. 고객은 사용 용도만 설명하고, 최종 계정항목은 담당자가 확인합니다.
                </p>
              </div>

              <div className="border-t bg-muted/50 px-6 pt-4">
                <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelPurposeDraft}
                    disabled={isCancellingPurpose || isSendingPurpose}
                  >
                    {isCancellingPurpose ? '취소 중...' : '취소'}
                  </Button>
                  <Link
                    href={`/dashboard/sessions/${sessionId}/transaction-purpose-requests/${purposeDraft.request.id}`}
                    className={cn(buttonVariants({ variant: 'outline' }), (isCancellingPurpose || isSendingPurpose) && 'pointer-events-none opacity-50')}
                  >
                    <PencilLine className="size-4" />
                    메일 문구 수정
                  </Link>
                  <Button type="button" onClick={sendPurposeRequestMail} disabled={isSendingPurpose || isCancellingPurpose}>
                    {isSendingPurpose ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {isSendingPurpose ? '발송 중...' : '메일 발송'}
                  </Button>
                </div>
                <div className="h-8 shrink-0" aria-hidden="true" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

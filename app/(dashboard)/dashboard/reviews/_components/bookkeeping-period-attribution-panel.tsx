'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  ReviewMaterialAttribution,
  ReviewMaterialAttributionSummary,
  ReviewSession,
} from '@/lib/reviews/review-workspace-types'
import { getBookkeepingMaterialAttributionStartState } from '@/lib/bookkeeping/period-attribution-eligibility'
import { isOutOfCloseScope } from '@/lib/bookkeeping/period-scope'
import { buildRequestedPeriodGapPresentation } from '@/lib/reviews/period-scope-presentation'
import { cn } from '@/lib/utils'

type Decision = ReviewMaterialAttribution['recommendation']
type PeriodGroup = {
  key: string
  label: string
  helper: string
  rows: ReviewMaterialAttribution[]
  files: FileGroup[]
  amountKrw: number
  include: number
  hold: number
  excludeDuplicate: number
  referenceOnly: number
  possibleDuplicate: number
  unresolved: number
}

type FileGroup = {
  key: string
  label: string
  rows: ReviewMaterialAttribution[]
  exceptionRows: ReviewMaterialAttribution[]
  amountKrw: number
  include: number
  hold: number
  excludeDuplicate: number
  referenceOnly: number
  possibleDuplicate: number
  unknown: number
  unresolved: number
}

type AttributionState =
  | { status: 'idle' | 'loading'; rows: ReviewMaterialAttribution[]; summary: ReviewMaterialAttributionSummary | null; error: string | null }
  | { status: 'ready'; rows: ReviewMaterialAttribution[]; summary: ReviewMaterialAttributionSummary; error: string | null }

const relationLabels: Record<ReviewMaterialAttribution['periodRelation'], string> = {
  requested: '요청월',
  prior: '이전월',
  future: '이후월',
  unknown: '분류 제외',
}

function formatAmount(value: number | null) {
  if (value === null) return '-'
  return `${value.toLocaleString('ko-KR')}원`
}

function decisionFor(row: ReviewMaterialAttribution): Decision {
  return row.staffDecision ?? row.recommendation
}

function formatPeriodLabel(period: string) {
  return /^\d{4}-\d{2}$/.test(period) ? `${period} 귀속` : period
}

function parsePeriod(period: string) {
  const match = period.match(/^(20\d{2})-(\d{2})$/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year: Number(match[1]), month }
}

function periodIndex(period: string) {
  const parsed = parsePeriod(period)
  return parsed ? parsed.year * 12 + parsed.month : Number.MAX_SAFE_INTEGER
}

function closePeriodMonths(closePeriod: string) {
  const [startRaw, endRaw] = closePeriod.split('~')
  const start = parsePeriod(startRaw ?? '')
  const end = parsePeriod(endRaw ?? '')
  if (!start || !end) return []

  const months: string[] = []
  let cursor = start.year * 12 + start.month
  const endIndex = end.year * 12 + end.month
  while (cursor <= endIndex && months.length < 12) {
    const year = Math.floor((cursor - 1) / 12)
    const month = ((cursor - 1) % 12) + 1
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    cursor += 1
  }
  return months
}

function helperForGroup(key: string, summary: ReviewMaterialAttributionSummary) {
  if (key === 'unknown') return '거래행으로 확정되지 않아 월별 집계에서 제외된 자료입니다.'
  if (key === summary.requestedPeriod) return '이번 요청월에 바로 반영할 후보입니다.'

  const relation = key < summary.requestedPeriod ? 'prior' : 'future'
  if (isOutOfCloseScope({
    attributedPeriod: key,
    periodRelation: relation,
    closePeriod: summary.closePeriod,
  })) {
    return `마감범위(${summary.closePeriod}) 밖 자료입니다. 요청기간과 맞지 않는 자료이므로 보충요청 대상입니다.`
  }

  if (key < summary.requestedPeriod) return '마감범위 안 이전월 자료입니다. 요청기간 자료 보충 여부를 확인해 주세요.'
  return '마감범위 안 이후월 자료입니다. 참고자료 또는 다음 기간 자료인지 확인합니다.'
}

function isExceptionRow(row: ReviewMaterialAttribution) {
  return row.periodRelation === 'unknown'
}

function unresolvedReason(row: ReviewMaterialAttribution) {
  if (row.periodRelation === 'unknown') {
    return '사유: 귀속월을 확정할 거래일자, 증빙일자, 승인일 또는 파일/시트의 월 표시가 부족합니다. 원본 자료에서 해당 일자나 귀속월 표시를 확인해 주세요.'
  }
  return '사유: 귀속기간은 확정되었습니다. 계정항목이나 거래 성격 문제는 계정항목 정리 단계에서 확인합니다.'
}

function unresolvedSummary(rows: ReviewMaterialAttribution[]) {
  const unknown = rows.filter((row) => row.periodRelation === 'unknown').length
  const parts = []
  if (unknown > 0) parts.push(`분류 제외 ${unknown}건`)
  return parts.length > 0 ? `사유: ${parts.join(', ')}` : null
}

function buildFileGroups(rows: ReviewMaterialAttribution[]) {
  const grouped = new Map<string, ReviewMaterialAttribution[]>()

  for (const row of rows) {
    const key = row.sourceLabel || '출처 미확인'
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  return Array.from(grouped.entries())
    .map(([key, fileRows]) => {
      const decisions = fileRows.map(decisionFor)
      return {
        key,
        label: key,
        rows: fileRows,
        exceptionRows: fileRows.filter(isExceptionRow),
        amountKrw: fileRows.reduce((sum, row) => sum + (row.amountKrw ?? 0), 0),
        include: decisions.filter((decision) => decision === 'include').length,
        hold: decisions.filter((decision) => decision === 'hold').length,
        excludeDuplicate: decisions.filter((decision) => decision === 'exclude_duplicate').length,
        referenceOnly: decisions.filter((decision) => decision === 'reference_only').length,
        possibleDuplicate: fileRows.filter((row) => row.duplicateStatus === 'possible_duplicate').length,
        unknown: fileRows.filter((row) => row.periodRelation === 'unknown').length,
        unresolved: fileRows.filter(isExceptionRow).length,
      }
    })
    .sort((a, b) => {
      const exceptionDelta = b.exceptionRows.length - a.exceptionRows.length
      if (exceptionDelta !== 0) return exceptionDelta
      return a.label.localeCompare(b.label, 'ko-KR')
    })
}

function getStartState(session: ReviewSession) {
  return getBookkeepingMaterialAttributionStartState({
    sessionStatus: session.status,
    files: session.files,
    workType: session.workType,
  })
}

export function BookkeepingPeriodAttributionPanel({ session }: { session: ReviewSession | null }) {
  const router = useRouter()
  const [state, setState] = useState<AttributionState>(() => {
    if (session?.materialAttributionSummary) {
      return {
        status: 'ready',
        rows: session.materialAttributions,
        summary: session.materialAttributionSummary,
        error: null,
      }
    }
    return {
      status: 'idle',
      rows: session?.materialAttributions ?? [],
      summary: null,
      error: null,
    }
  })
  const [isPending, startTransition] = useTransition()

  async function load() {
    if (!session || session.workType !== 'bookkeeping') return
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    const res = await fetch(`/api/sessions/${session.id}/material-attribution`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setState({ status: 'idle', rows: [], summary: null, error: data.error ?? '귀속기간 검토 정보를 불러오지 못했습니다.' })
      return
    }
    setState({ status: 'ready', rows: data.rows, summary: data.summary, error: null })
  }

  const periodGroups = useMemo<PeriodGroup[]>(() => {
    if (!state.summary) return []
    const closeMonths = closePeriodMonths(state.summary.closePeriod)
    const grouped = new Map<string, ReviewMaterialAttribution[]>()

    for (const month of closeMonths) grouped.set(month, [])
    grouped.set('unknown', [])

    for (const row of state.rows) {
      const key = row.attributedPeriod && parsePeriod(row.attributedPeriod)
        ? row.attributedPeriod
        : 'unknown'
      grouped.set(key, [...(grouped.get(key) ?? []), row])
    }

    return Array.from(grouped.entries())
      .filter(([key, rows]) => rows.length > 0 || closeMonths.includes(key))
      .map(([key, rows]) => {
        const decisions = rows.map(decisionFor)
        return {
          key,
          label: key === 'unknown' ? '분류 제외' : formatPeriodLabel(key),
          helper: helperForGroup(key, state.summary!),
          rows,
          files: buildFileGroups(rows),
          amountKrw: rows.reduce((sum, row) => sum + (row.amountKrw ?? 0), 0),
          include: decisions.filter((decision) => decision === 'include').length,
          hold: decisions.filter((decision) => decision === 'hold').length,
          excludeDuplicate: decisions.filter((decision) => decision === 'exclude_duplicate').length,
          referenceOnly: decisions.filter((decision) => decision === 'reference_only').length,
          possibleDuplicate: rows.filter((row) => row.duplicateStatus === 'possible_duplicate').length,
          unresolved: rows.filter(isExceptionRow).length,
        }
      })
      .sort((a, b) => {
        if (a.key === 'unknown') return 1
        if (b.key === 'unknown') return -1
        return periodIndex(a.key) - periodIndex(b.key)
      })
  }, [state.rows, state.summary])

  if (!session || session.workType !== 'bookkeeping') return null

  const sessionId = session.id
  const startState = getStartState(session)
  const startLabel = state.rows.length > 0 ? '귀속기간 재검토' : '귀속기간 검토 시작'
  const unresolvedTotal = state.summary ? state.summary.unknown : 0
  const requestedPeriodGap = state.summary ? buildRequestedPeriodGapPresentation(state.summary) : null

  function startReview() {
    startTransition(async () => {
      const res = await fetch(`/api/sessions/${sessionId}/material-attribution/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setState((prev) => ({ ...prev, error: data.error ?? '귀속기간 검토를 시작하지 못했습니다.' }))
        return
      }
      await load()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>기장 귀속기간 검토</CardTitle>
            <CardDescription>
              AI가 엑셀표로 넘길 수 없는 항목만 표시합니다. 자동 반영·중복 제외·참고자료는 요약으로만 확인합니다.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={state.summary && state.summary.unknown > 0 ? 'warning' : 'secondary'}>
              {state.summary ? `${state.summary.include}건 포함` : '미실행'}
            </Badge>
            <Button size="sm" variant={state.rows.length > 0 ? 'outline' : 'default'} onClick={startReview} disabled={!startState.eligible || isPending}>
              {isPending ? '처리 중' : startLabel}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!startState.eligible && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {startState.reason}
          </div>
        )}
        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </div>
        )}
        {requestedPeriodGap && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3',
              requestedPeriodGap.tone === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-950',
            )}
          >
            <div className="space-y-1 text-sm">
              {requestedPeriodGap.messageLines.map((line, index) => (
                <p key={line} className={index === 0 ? 'font-semibold' : ''}>{line}</p>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-80">{requestedPeriodGap.periodContext}</p>
            {requestedPeriodGap.scopeDetail && (
              <p className="mt-1 text-xs font-medium">{requestedPeriodGap.scopeDetail}</p>
            )}
          </div>
        )}
        {state.summary && (
          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground">요청월 / 마감기간</dt>
              <dd className="mt-1 font-semibold">{state.summary.requestedPeriod} · {state.summary.closePeriod}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground">귀속월 그룹</dt>
              <dd className="mt-1 font-semibold">{periodGroups.filter((group) => group.key !== 'unknown').length}개</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground">분류 제외</dt>
              <dd className={`mt-1 font-semibold ${unresolvedTotal > 0 ? 'text-red-600' : ''}`}>
                {unresolvedTotal > 0
                  ? `사유: 월별 거래행에서 제외 ${state.summary.unknown}건`
                  : '없음'}
              </dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground">자동 정리</dt>
              <dd className="mt-1 font-semibold">
                반영 {state.summary.include} · 중복 제외 {state.summary.excludeDuplicate}
              </dd>
            </div>
          </dl>
        )}
        {state.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            아직 귀속기간 검토 결과가 없습니다.
          </div>
        ) : (
          <div className="grid gap-3">
            {periodGroups.map((group) => {
              const hasExceptions = group.unresolved > 0
              const groupReason = unresolvedSummary(group.rows)
              return (
                <details key={group.key} className="group rounded-lg border p-3" open={hasExceptions}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{group.label}</p>
                        <Badge variant={group.key === 'unknown' ? 'warning' : 'secondary'}>{group.rows.length}건</Badge>
                        {group.include > 0 && <Badge variant="success">반영 {group.include}</Badge>}
                        {group.unresolved > 0 && <Badge variant="warning">분류 제외 {group.unresolved}</Badge>}
                        {group.excludeDuplicate > 0 && <Badge variant="secondary">중복 자동 제외 {group.excludeDuplicate}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{group.helper}</p>
                      {groupReason && <p className="mt-1 text-xs font-medium text-red-600">{groupReason}</p>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>금액 합계 {formatAmount(group.amountKrw)}</p>
                      <p className="mt-1">펼쳐서 상세 확인</p>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 border-t pt-3">
                    {group.rows.length === 0 && (
                      <div className="rounded-md bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        이 귀속월로 추출된 거래가 없습니다.
                      </div>
                    )}
                    {group.files.map((fileGroup) => {
                      const fileReason = unresolvedSummary(fileGroup.rows)
                      return (
                        <details key={fileGroup.key} className="rounded-md bg-muted/30 p-3" open={fileGroup.exceptionRows.length > 0}>
                          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{fileGroup.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                거래 {fileGroup.rows.length}건 · 금액 합계 {formatAmount(fileGroup.amountKrw)}
                              </p>
                              {fileReason && <p className="mt-1 text-xs font-medium text-red-600">{fileReason}</p>}
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              {fileGroup.include > 0 && <Badge variant="success">반영 {fileGroup.include}</Badge>}
                              {fileGroup.unresolved > 0 && <Badge variant="warning">분류 제외 {fileGroup.unresolved}</Badge>}
                              {fileGroup.excludeDuplicate > 0 && <Badge variant="secondary">중복 자동 제외 {fileGroup.excludeDuplicate}</Badge>}
                              {fileGroup.referenceOnly > 0 && <Badge variant="secondary">참고 {fileGroup.referenceOnly}</Badge>}
                            </div>
                          </summary>
                          <div className="mt-3 grid gap-2 border-t pt-3">
                            {fileGroup.exceptionRows.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                AI가 판단하지 못한 항목이 없습니다. 세부 거래는 계정항목 정리와 전표 엑셀에서 확인합니다.
                              </p>
                            ) : (
                              fileGroup.exceptionRows.map((row) => (
                                <div key={row.id} className="grid gap-2 rounded-md bg-background p-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="warning">{relationLabels[row.periodRelation]}</Badge>
                                      {decisionFor(row) === 'hold' && <Badge variant="warning">분류 제외</Badge>}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {row.evidenceDate ?? row.attributedPeriod ?? '기간 미확인'} · {formatAmount(row.amountKrw)} · {row.counterparty ?? '거래처 미확인'}
                                    </p>
                                    <div className="mt-2 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-xs">
                                      <p className="font-medium text-red-700">확인 위치: {row.sourceLabel}</p>
                                      <p className="mt-1 text-red-700">내용: {row.description || '원문 행 내용을 추출하지 못했습니다.'}</p>
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-red-600">{unresolvedReason(row)}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

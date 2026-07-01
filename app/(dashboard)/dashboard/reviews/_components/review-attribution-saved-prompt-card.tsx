'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE,
  ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_USER_MESSAGE,
} from '@/lib/reviews/attribution-saved-prompt-errors'
import {
  buildRequestedPeriodGapPresentation,
  hasRequestedPeriodDataGap,
} from '@/lib/reviews/period-scope-presentation'
import type { ReviewMaterialAttributionSummary } from '@/lib/reviews/review-workspace-types'
import { cn } from '@/lib/utils'

function isTableNotReadyMessage(message: string) {
  return (
    message.includes(ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE) ||
    message.includes(ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_USER_MESSAGE)
  )
}

function readApiError(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const error = (data as { error?: unknown }).error
    if (typeof error === 'string') return error
  }
  return fallback
}

type SavedPrompt = {
  id: string
  name: string
  description: string | null
  promptText: string
  explanationKo: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

type RunRow = {
  id: string
  fileLabel: string | null
  evidenceDate: string | null
  attributedPeriod: string | null
  periodRelation: string
  counterparty: string | null
  description: string | null
  amountKrw: number | null
  duplicateStatus: string
  aiRecommendation: string
  staffDecision: string | null
}

type RunSummary = {
  totalRows: number
  matchedRows: number
  amountSumKrw: number
  needsReviewRows: number
}

const periodRelationLabels: Record<string, string> = {
  requested: '요청월',
  prior: '이전월',
  future: '이후월',
  unknown: '분류 제외',
}

const decisionLabels: Record<string, string> = {
  include: '포함',
  hold: '보류',
  exclude_duplicate: '중복 제외',
  reference_only: '참고',
}

function formatAmount(value: number | null) {
  if (value === null) return '-'
  return `${value.toLocaleString('ko-KR')}원`
}

export function ReviewAttributionSavedPromptCard({
  sessionId,
  clientName,
  accountingPeriodLabel,
  attributionRowCount,
  materialAttributionSummary,
}: {
  sessionId: string | null
  clientName: string | null
  accountingPeriodLabel: string | null
  attributionRowCount: number
  materialAttributionSummary: ReviewMaterialAttributionSummary | null
}) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [createPromptText, setCreatePromptText] = useState('')
  const [runExplanation, setRunExplanation] = useState<string | null>(null)
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)
  const [runRows, setRunRows] = useState<RunRow[]>([])
  const [tableReady, setTableReady] = useState(true)
  const [setupWarning, setSetupWarning] = useState<string | null>(null)
  // 삭제(소프트) 확인 모달 열림 상태.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const attributionReady = attributionRowCount > 0
  const requestedPeriodGap = materialAttributionSummary && hasRequestedPeriodDataGap(materialAttributionSummary)
    ? buildRequestedPeriodGapPresentation(materialAttributionSummary)
    : null
  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId],
  )
  // 요청 기간 부재 시 추출 차단. 그 외에는 귀속 결과가 없어도 클릭 후 notReady로 안내한다.
  const extractDisabled = !selectedPromptId || running || !tableReady || Boolean(requestedPeriodGap)

  const loadPrompts = useCallback(async () => {
    setLoadingPrompts(true)
    setError(null)
    setSetupWarning(null)
    try {
      const response = await fetch('/api/reviews/attribution-prompts?includeInactive=true', { cache: 'no-store' })
      const data = (await response.json()) as { prompts?: SavedPrompt[]; tableReady?: boolean }
      if (!response.ok) {
        throw new Error(readApiError(data, '저장 프롬프트 목록을 불러오지 못했습니다.'))
      }
      if (data.tableReady === false) {
        setTableReady(false)
        setPrompts([])
        setSelectedPromptId('')
        setSetupWarning(ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_USER_MESSAGE)
        return
      }

      setTableReady(true)
      setSetupWarning(null)
      const prompts = data.prompts ?? []
      const activePrompts = prompts.filter((prompt) => prompt.isActive)
      setPrompts(prompts)
      setSelectedPromptId((current) => {
        if (current && activePrompts.some((prompt) => prompt.id === current)) return current
        return activePrompts[0]?.id ?? ''
      })
      if (activePrompts.length === 0) {
        setShowCreateForm(true)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '저장 프롬프트 목록을 불러오지 못했습니다.')
    } finally {
      setLoadingPrompts(false)
    }
  }, [])

  useEffect(() => {
    // 마운트 시 1회 저장 프롬프트 목록을 불러온다(의도된 fetch-on-mount).
    // loadPrompts가 시작 시 loading 상태를 동기적으로 set하므로 규칙을 이 줄에 한해 끈다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPrompts()
  }, [loadPrompts])

  // 세션이 바뀌면 직전 실행 결과를 렌더 중에 초기화한다(effect 내 setState 회피 — React 권장 패턴).
  const [resultSessionId, setResultSessionId] = useState(sessionId)
  if (sessionId !== resultSessionId) {
    setResultSessionId(sessionId)
    setRunExplanation(null)
    setRunSummary(null)
    setRunRows([])
    setError(null)
    setSetupWarning(null)
  }

  async function handleRun() {
    if (!sessionId || !selectedPromptId) return
    setRunning(true)
    setError(null)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/review/attribution-prompts/${selectedPromptId}/run`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(readApiError(data, '프롬프트 실행에 실패했습니다.'))
      }

      setRunExplanation(data.prompt?.explanationKo ?? selectedPrompt?.explanationKo ?? null)
      setRunSummary(data.summary ?? null)
      setRunRows(data.rows ?? [])

      if (data.status === 'notReady') {
        setError(typeof data.notReadyReason === 'string'
          ? data.notReadyReason
          : '자료상태·귀속기간 판단 결과가 없습니다. 자료가 검토되어 귀속기간 판단이 생기면 추출할 수 있습니다.')
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '프롬프트 실행에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  async function handleDelete() {
    if (!selectedPromptId) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/reviews/attribution-prompts/${selectedPromptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(readApiError(data, '프롬프트 삭제에 실패했습니다.'))
      }
      setDeleteDialogOpen(false)
      setRunExplanation(null)
      setRunSummary(null)
      setRunRows([])
      await loadPrompts()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '프롬프트 삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/reviews/attribution-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          promptText: createPromptText,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(readApiError(data, '이 프롬프트를 안전한 검토 조건으로 해석하지 못했습니다. 금액, 기간 관계, 거래처, 적요, 중복 상태처럼 명확한 조건으로 다시 입력해 주세요.'))
      }

      setCreateName('')
      setCreatePromptText('')
      setShowCreateForm(false)
      await loadPrompts()
      if (data.prompt?.id) {
        setSelectedPromptId(data.prompt.id)
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '프롬프트 저장에 실패했습니다.'
      if (isTableNotReadyMessage(message)) {
        setTableReady(false)
        setSetupWarning(ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_USER_MESSAGE)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!sessionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">프롬프트 검토</CardTitle>
          <CardDescription>자료 검토 요청 목록에서 세션을 선택하면 저장 프롬프트로 귀속기간 항목을 추출할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">프롬프트 검토</CardTitle>
            <CardDescription>
              {clientName} · {accountingPeriodLabel} · 귀속기간 판단 {attributionRowCount.toLocaleString('ko-KR')}건
            </CardDescription>
          </div>
          <Badge variant="info">AI 해석</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {requestedPeriodGap ? (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-sm',
              requestedPeriodGap.tone === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-950',
            )}
          >
            <p className="font-semibold">{requestedPeriodGap.headline}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="attribution-prompt-select" className="text-sm font-medium text-foreground">
              저장 프롬프트
            </label>
            <select
              id="attribution-prompt-select"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedPromptId}
              onChange={(event) => setSelectedPromptId(event.target.value)}
              disabled={loadingPrompts || prompts.filter((prompt) => prompt.isActive).length === 0}
            >
              {prompts.filter((prompt) => prompt.isActive).length === 0 ? (
                <option value="">저장된 프롬프트 없음</option>
              ) : (
                prompts
                  .filter((prompt) => prompt.isActive)
                  .map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))
              )}
            </select>
          </div>
          {selectedPrompt ? (
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(true)}>
              삭제
            </Button>
          ) : null}
          <Button
            type="button"
            variant={extractDisabled ? 'secondary' : 'default'}
            onClick={() => void handleRun()}
            disabled={extractDisabled}
          >
            {running ? '추출 중…' : '이 프롬프트로 추출'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowCreateForm((current) => !current)}>
            {showCreateForm ? '새 프롬프트 입력 닫기' : '새 프롬프트'}
          </Button>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>저장 프롬프트 삭제</DialogTitle>
              <DialogDescription>
                {selectedPrompt
                  ? `'${selectedPrompt.name}' 프롬프트를 삭제할까요? 목록에서 사라집니다. 다시 필요하면 새로 만들 수 있습니다.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>
                취소
              </DialogClose>
              <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={saving}>
                {saving ? '삭제 중…' : '삭제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedPrompt ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            <span className="font-medium">AI 해석: </span>
            {runExplanation ?? selectedPrompt.explanationKo}
          </p>
        ) : null}

        {showCreateForm ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <div>
              <label htmlFor="attribution-prompt-name" className="text-sm font-medium text-foreground">
                프롬프트 이름
              </label>
              <Input
                id="attribution-prompt-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="예: 200만원 이상 거래, 제목을 꼭 입력해주세요"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="attribution-prompt-text" className="text-sm font-medium text-foreground">
                자연어 프롬프트
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                금액·거래처·기간·키워드로 원하는 거래 조건을 일상어로 적으면, AI가 해당 거래만 골라 표로 보여줍니다.
              </p>
              <Textarea
                id="attribution-prompt-text"
                value={createPromptText}
                onChange={(event) => setCreatePromptText(event.target.value)}
                placeholder={'예) 200만원 이상 거래만 보여줘\n예) ○○상사와의 거래만\n예) 12월 거래만 추려서 확인'}
                className="mt-1 min-h-24"
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || !createName.trim() || !createPromptText.trim() || !tableReady}
            >
              {saving ? '해석·저장 중…' : '해석하고 저장'}
            </Button>
          </div>
        ) : null}

        {setupWarning ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p>{setupWarning}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void loadPrompts()} disabled={loadingPrompts}>
              {loadingPrompts ? '불러오는 중…' : '다시 불러오기'}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {runSummary ? (
          <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm sm:grid-cols-3">
            <p>매칭 {runSummary.matchedRows.toLocaleString('ko-KR')}건 / 전체 {runSummary.totalRows.toLocaleString('ko-KR')}건</p>
            <p>금액 합계 {formatAmount(runSummary.amountSumKrw)}</p>
            <p>담당자 결정 필요 {runSummary.needsReviewRows.toLocaleString('ko-KR')}건</p>
          </div>
        ) : null}

        {runSummary && runRows.length === 0 && attributionReady ? (
          <p className="text-sm text-muted-foreground">이 프롬프트에 맞는 귀속기간 항목이 없습니다.</p>
        ) : null}

        {runRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일</TableHead>
                  <TableHead>증빙일</TableHead>
                  <TableHead>귀속월</TableHead>
                  <TableHead>요청기간 관계</TableHead>
                  <TableHead>거래처</TableHead>
                  <TableHead>적요</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>중복</TableHead>
                  <TableHead>AI 추천</TableHead>
                  <TableHead>담당자 결정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[140px] truncate" title={row.fileLabel ?? undefined}>
                      {row.fileLabel ?? '-'}
                    </TableCell>
                    <TableCell>{row.evidenceDate ?? '-'}</TableCell>
                    <TableCell>{row.attributedPeriod ?? '-'}</TableCell>
                    <TableCell>{periodRelationLabels[row.periodRelation] ?? row.periodRelation}</TableCell>
                    <TableCell className="max-w-[120px] truncate" title={row.counterparty ?? undefined}>
                      {row.counterparty ?? '-'}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={row.description ?? undefined}>
                      {row.description ?? '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(row.amountKrw)}</TableCell>
                    <TableCell>{row.duplicateStatus === 'possible_duplicate' ? '의심' : '-'}</TableCell>
                    <TableCell>{decisionLabels[row.aiRecommendation] ?? row.aiRecommendation}</TableCell>
                    <TableCell>
                      {row.staffDecision ? (decisionLabels[row.staffDecision] ?? row.staffDecision) : '미결정'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

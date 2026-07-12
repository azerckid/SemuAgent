'use client'

import { ChevronDown, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReclassificationSavingsCandidate } from '@/lib/vat/reclassification-savings'
import type { VatReclassificationMutationInput } from '@/lib/validations/vat-reclassification'

interface VatReclassificationSavingsSectionProps {
  readonly periodKey: string
  readonly candidates: ReclassificationSavingsCandidate[]
}

type DialogMode = 'reclassify' | 'keep_as_is'

export function VatReclassificationSavingsSection({
  periodKey,
  candidates,
}: VatReclassificationSavingsSectionProps) {
  const pendingCandidates = candidates.filter((candidate) => candidate.userDecision === 'pending')
  if (pendingCandidates.length === 0) return null

  return (
    <section
      className="grid gap-3"
      data-vat-reclassification-savings
      data-vat-reclassification-candidates={pendingCandidates.length}
    >
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">추가 공제 가능성</h2>
        <p className="text-xs text-company-fg-subtle">접대비로 처리된 매입 중 다시 확인할 거래</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#bbf7d0] bg-company-surface shadow-company-card">
        {pendingCandidates.map((candidate) => (
          <VatReclassificationSavingsRow
            key={candidate.reviewRowId}
            periodKey={periodKey}
            candidate={candidate}
          />
        ))}
      </div>
    </section>
  )
}

function VatReclassificationSavingsRow({
  periodKey,
  candidate,
}: {
  readonly periodKey: string
  readonly candidate: ReclassificationSavingsCandidate
}) {
  const router = useRouter()
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(input: VatReclassificationMutationInput) {
    startTransition(async () => {
      const response = await fetch(`/api/vat/reclassification-reviews/${candidate.reviewRowId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await response.json().catch(() => null) as { error?: unknown } | null
      if (!response.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : '재분류 결정을 저장하지 못했습니다.')
        return
      }

      toast.success(input.action === 'reclassify'
        ? '공제 가능한 매입으로 재분류했습니다.'
        : '접대비 유지 결정을 저장했습니다.')
      setDialogMode(null)
      router.refresh()
    })
  }

  return (
    <>
      <details className="group border-b border-company-border last:border-b-0">
        <summary className="grid cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-[#fafafa] md:grid-cols-[minmax(220px,1.2fr)_minmax(190px,1fr)_minmax(180px,auto)_20px] md:gap-[18px]">
          <div>
            <p className="text-[13px] font-semibold text-foreground">{candidate.description}</p>
            <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">
              {candidate.counterparty ?? '상대처 미확인'}
            </p>
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-company-fg-muted">
              접대비 → <strong className="text-foreground">{suggestedCategoryLabel(candidate.evaluation.suggestedCategory)}</strong>
            </p>
            <p className="mt-0.5 text-[11px] text-company-fg-subtle">
              신뢰도 {confidenceLabel(candidate.evaluation.confidence)}
            </p>
          </div>
          <div className="md:text-right">
            <strong className="block text-[15px] text-[#16a34a] tabular-nums">
              최대 {formatCurrency(candidate.potentialSavingsKrw)}원
            </strong>
            <span className="text-[11px] text-company-fg-subtle">추가 공제 가능성</span>
          </div>
          <ChevronDown className="size-4 text-company-fg-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="mx-4 mb-3.5 grid gap-3 rounded-lg border border-company-border bg-[#fafafa] px-3.5 py-3 md:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-bold tracking-[0.03em] text-company-fg-subtle uppercase">왜 후보인가</p>
            <p className="mt-1 text-xs leading-5 text-company-fg-muted">
              {candidate.evaluation.factors.map((factor) => factor.summary).join(' ')}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-bold tracking-[0.03em] text-company-fg-subtle uppercase">확정 전 필요</p>
            <p className="mt-1 text-xs leading-5 text-company-fg-muted">
              {candidate.evaluation.missingToConfirm.join(' · ')}
            </p>
            <p className={candidate.eligibleEvidence.present
              ? 'mt-1 text-[11.5px] font-semibold text-[#15803d]'
              : 'mt-1 text-[11.5px] font-semibold text-[#b91c1c]'}>
              {candidate.eligibleEvidence.present
                ? `증빙 확인됨 · ${candidate.eligibleEvidence.label}`
                : candidate.eligibleEvidence.label}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-company-border pt-3 md:col-span-2">
            <p className="mr-auto text-[11.5px] text-company-fg-subtle">
              표시 금액은 원장에 저장된 매입세액 기준의 최대 가능 금액이며 확정 절세액이 아닙니다.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogMode('keep_as_is')}
            >
              접대비 유지
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending || !candidate.eligibleEvidence.present}
              title={candidate.eligibleEvidence.present ? undefined : '적격증빙을 먼저 연결해 주세요.'}
              onClick={() => setDialogMode('reclassify')}
            >
              공제로 재분류
            </Button>
          </div>
        </div>
      </details>

      {dialogMode ? (
        <VatReclassificationDecisionDialog
          mode={dialogMode}
          periodKey={periodKey}
          candidate={candidate}
          isPending={isPending}
          onClose={() => setDialogMode(null)}
          onSubmit={submit}
        />
      ) : null}
    </>
  )
}

function VatReclassificationDecisionDialog({
  mode,
  periodKey,
  candidate,
  isPending,
  onClose,
  onSubmit,
}: {
  readonly mode: DialogMode
  readonly periodKey: string
  readonly candidate: ReclassificationSavingsCandidate
  readonly isPending: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: VatReclassificationMutationInput) => void
}) {
  const [targetCategory, setTargetCategory] = useState<'welfare_expense' | 'meeting_expense'>(
    candidate.evaluation.suggestedCategory ?? 'welfare_expense',
  )
  const [businessContext, setBusinessContext] = useState('')
  const [reason, setReason] = useState('')

  function submit() {
    if (mode === 'keep_as_is') {
      onSubmit({
        action: 'keep_as_is',
        periodKey,
        expectedFingerprint: candidate.candidateFingerprint,
        reason: reason.trim() || undefined,
      })
      return
    }
    if (businessContext.trim().length < 2) {
      toast.error('업무 목적 또는 참석자를 입력해 주세요.')
      return
    }
    onSubmit({
      action: 'reclassify',
      periodKey,
      expectedFingerprint: candidate.candidateFingerprint,
      targetCategory,
      businessContext: businessContext.trim(),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'reclassify' ? '공제로 재분류' : '접대비 유지'}</DialogTitle>
          <DialogDescription>
            {mode === 'reclassify'
              ? '업무 목적 또는 참석자를 확인한 뒤 사용자가 직접 공제 결정을 확정합니다.'
              : '현재 접대비 불공제 분류를 유지하고 같은 거래를 다시 묻지 않습니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {mode === 'reclassify' ? (
            <>
              <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
                재분류 항목
                <Select
                  value={targetCategory}
                  disabled={isPending}
                  onChange={(event) => setTargetCategory(event.target.value as typeof targetCategory)}
                >
                  <option value="welfare_expense">복리후생비</option>
                  <option value="meeting_expense">회의비</option>
                </Select>
              </label>
              <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
                업무 목적 또는 참석자
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={businessContext}
                  disabled={isPending}
                  placeholder="예: 개발팀 전원 참석, 분기 회고 회식"
                  onChange={(event) => setBusinessContext(event.target.value)}
                />
                <span className="text-right text-[11px] font-normal text-company-fg-subtle">{businessContext.length}/500</span>
              </label>
              <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] font-medium text-[#166534]">
                {candidate.eligibleEvidence.label}이 연결되어 있습니다.
              </p>
            </>
          ) : (
            <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
              유지 사유 (선택)
              <Textarea
                rows={4}
                maxLength={500}
                value={reason}
                disabled={isPending}
                placeholder="예: 외부 거래처 미팅 비용"
                onChange={(event) => setReason(event.target.value)}
              />
              <span className="text-right text-[11px] font-normal text-company-fg-subtle">{reason.length}/500</span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>취소</Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {mode === 'reclassify' ? '공제로 확정' : '접대비 유지 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function suggestedCategoryLabel(value: ReclassificationSavingsCandidate['evaluation']['suggestedCategory']) {
  if (value === 'welfare_expense') return '복리후생비 후보'
  if (value === 'meeting_expense') return '회의비 후보'
  return '분류 확인 후보'
}

function confidenceLabel(value: ReclassificationSavingsCandidate['evaluation']['confidence']) {
  if (value === 'high') return '높음'
  if (value === 'medium') return '중간'
  return '낮음'
}

function formatCurrency(value: number) {
  return value.toLocaleString('ko-KR')
}

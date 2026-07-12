'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  defaultDifferentVatDecision,
  finalDecisionForVatProvisionalJudgment,
  missingRequiredEvidenceForVatDecision,
  vatTaxTreatmentDecisionLabel,
  vatTaxTreatmentDecisionOptions,
} from '@/lib/vat/tax-treatment-actions'
import type {
  VatTaxTreatmentDisplayRow,
  VatTaxTreatmentFinalDecision,
  VatTaxTreatmentMutationInput,
} from '@/lib/validations/vat-tax-treatment'

export type VatTaxTreatmentDialogMode = 'different' | 'resolve_handoff' | 'hold' | 'expert_review'

interface VatTaxTreatmentDecisionDialogProps {
  readonly row: VatTaxTreatmentDisplayRow
  readonly mode: VatTaxTreatmentDialogMode
  readonly isPending: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: VatTaxTreatmentMutationInput, successMessage: string) => void
}

export function VatTaxTreatmentDecisionDialog({
  row,
  mode,
  isPending,
  onClose,
  onSubmit,
}: VatTaxTreatmentDecisionDialogProps) {
  const isDecisionMode = mode === 'different' || mode === 'resolve_handoff'
  const [decision, setDecision] = useState<VatTaxTreatmentFinalDecision>(() => (
    mode === 'resolve_handoff'
      ? finalDecisionForVatProvisionalJudgment(row.provisionalJudgment) ?? defaultDifferentVatDecision(row)
      : defaultDifferentVatDecision(row)
  ))
  const [reason, setReason] = useState(row.userActionReason ?? '')
  const [prorationPercent, setProrationPercent] = useState('50')
  const decisionOptions = vatTaxTreatmentDecisionOptions(row.direction)

  function submit() {
    if (mode === 'hold' || mode === 'expert_review') {
      onSubmit({
        action: mode,
        periodKey: row.periodKey,
        recommendationFingerprint: row.recommendationFingerprint,
        reason: reason.trim() || undefined,
      }, mode === 'hold'
        ? '이 거래의 부가세 판단을 보류했습니다.'
        : '전문가 확인 대상으로 표시했습니다.')
      return
    }

    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      toast.error('다르게 확정하는 근거를 입력해 주세요.')
      return
    }
    if (missingRequiredEvidenceForVatDecision(row, decision)) {
      toast.error('영세율·면세 확정에 필요한 증빙을 먼저 확인해 주세요.')
      return
    }

    const prorationRateBps = decision === 'prorated'
      ? parseProrationRateBps(prorationPercent)
      : undefined
    if (decision === 'prorated' && prorationRateBps === null) {
      toast.error('안분율은 0보다 크고 100 이하인 숫자로 입력해 주세요.')
      return
    }

    onSubmit({
      action: 'confirm_different',
      periodKey: row.periodKey,
      recommendationFingerprint: row.recommendationFingerprint,
      finalDecision: decision,
      reason: normalizedReason,
      ...(prorationRateBps === undefined || prorationRateBps === null ? {} : { prorationRateBps }),
    }, `${vatTaxTreatmentDecisionLabel(decision)}로 확정했습니다.`)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle(mode)}</DialogTitle>
          <DialogDescription>{dialogDescription(mode)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {mode === 'resolve_handoff' && row.humanHandoff ? (
            <div className="grid gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-3 text-[12.5px]">
              <p className="font-semibold text-[#92400e]">{row.humanHandoff.question}</p>
              <p className="text-[#a16207]">{row.humanHandoff.decisionImpact}</p>
            </div>
          ) : null}

          {isDecisionMode ? (
            <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
              최종 판단
              <Select
                value={decision}
                disabled={isPending}
                onChange={(event) => setDecision(event.target.value as VatTaxTreatmentFinalDecision)}
              >
                {decisionOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ) : null}

          {isDecisionMode && decision === 'prorated' ? (
            <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
              공제 안분율 (%)
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="100"
                step="0.01"
                value={prorationPercent}
                disabled={isPending}
                onChange={(event) => setProrationPercent(event.target.value)}
              />
            </label>
          ) : null}

          <label className="grid gap-1.5 text-[12.5px] font-semibold text-foreground">
            {mode === 'resolve_handoff' ? '답변과 판단 근거' : mode === 'different' ? '판단 근거' : '메모 (선택)'}
            <Textarea
              rows={4}
              maxLength={500}
              value={reason}
              disabled={isPending}
              placeholder={dialogPlaceholder(mode)}
              onChange={(event) => setReason(event.target.value)}
            />
            <span className="text-right text-[11px] font-normal text-company-fg-subtle">{reason.length}/500</span>
          </label>

          {isDecisionMode && missingRequiredEvidenceForVatDecision(row, decision) ? (
            <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]">
              이 판단에 필요한 증빙이 아직 확인되지 않아 저장할 수 없습니다.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            취소
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {dialogSubmitLabel(mode)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseProrationRateBps(value: string) {
  const percent = Number(value.trim())
  const bps = percent * 100
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100 || !Number.isInteger(bps)) return null
  return bps
}

function dialogTitle(mode: VatTaxTreatmentDialogMode) {
  if (mode === 'resolve_handoff') return '질문에 답하고 판단 확정'
  if (mode === 'different') return '부가세 판단을 다르게 확정'
  if (mode === 'hold') return '부가세 판단 보류'
  return '전문가 확인 표시'
}

function dialogDescription(mode: VatTaxTreatmentDialogMode) {
  if (mode === 'resolve_handoff') return '확인한 사실과 최종 판단을 함께 남깁니다.'
  if (mode === 'different') return 'AI·규칙 판단과 다른 최종 처리를 선택하고 근거를 남깁니다.'
  if (mode === 'hold') return '추가 자료를 확인할 때까지 이 거래의 판단을 보류합니다.'
  return '세무 전문가의 별도 확인이 필요한 거래로 표시합니다.'
}

function dialogPlaceholder(mode: VatTaxTreatmentDialogMode) {
  if (mode === 'resolve_handoff') return '확인한 사실과 이 판단을 선택한 이유를 입력해 주세요.'
  if (mode === 'different') return '예: 업무무관 사용으로 매입세액 불공제'
  if (mode === 'hold') return '예: 거래처 확인서 수령 후 판단'
  return '예: 영세율 적용 요건 검토 필요'
}

function dialogSubmitLabel(mode: VatTaxTreatmentDialogMode) {
  if (mode === 'resolve_handoff') return '판단 확정'
  if (mode === 'different') return '다르게 확정'
  if (mode === 'hold') return '보류 저장'
  return '전문가 확인 저장'
}

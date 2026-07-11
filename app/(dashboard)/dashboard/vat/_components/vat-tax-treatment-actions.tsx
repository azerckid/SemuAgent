'use client'

import { useRouter } from 'next/navigation'
import { Check, Loader2, Pause, PencilLine, UserRoundSearch } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  canApplyVatTaxTreatmentRecommendation,
  finalDecisionForVatRecommendation,
  vatTaxTreatmentDecisionLabel,
} from '@/lib/vat/tax-treatment-actions'
import type {
  VatTaxTreatmentDisplayRow,
  VatTaxTreatmentMutationInput,
} from '@/lib/validations/vat-tax-treatment'
import {
  vatTaxTreatmentMutationSuccessSchema,
  type VatTaxTreatmentMutationSuccess,
} from '@/lib/validations/vat-tax-treatment'
import {
  VatTaxTreatmentDecisionDialog,
  type VatTaxTreatmentDialogMode,
} from './vat-tax-treatment-decision-dialog'

type MutationResult =
  | VatTaxTreatmentMutationSuccess
  | { ok: false; message: string }

let latestVatUndoSequence = 0

interface VatTaxTreatmentActionsProps {
  readonly row: VatTaxTreatmentDisplayRow
}

export function VatTaxTreatmentActions({ row }: VatTaxTreatmentActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogMode, setDialogMode] = useState<VatTaxTreatmentDialogMode | null>(null)
  const canApply = canApplyVatTaxTreatmentRecommendation(row)

  function openDialog(mode: VatTaxTreatmentDialogMode) {
    setDialogMode(mode)
  }

  function runMutation(input: VatTaxTreatmentMutationInput, successMessage: string) {
    startTransition(async () => {
      const result = await patchVatTaxTreatment(row.rowId, input)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      setDialogMode(null)
      showVatUndoableToast({
        row,
        message: successMessage,
        undoToken: result.undoToken,
        router,
      })
      router.refresh()
    })
  }

  function applyRecommendation() {
    if (!canApply || row.finalDecision) return
    const finalDecision = finalDecisionForVatRecommendation(row.recommendation)
    runMutation(
      {
        action: 'apply_recommendation',
        periodKey: row.periodKey,
        recommendationFingerprint: row.recommendationFingerprint,
      },
      finalDecision ? `${vatTaxTreatmentDecisionLabel(finalDecision)}로 확정했습니다.` : '추천 판단을 적용했습니다.',
    )
  }

  return (
    <>
      <div>
        <p className="text-[12.5px] font-semibold text-foreground">
          {userActionStatusLabel(row)}
        </p>
        {row.userActionReason ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-company-fg-subtle">{row.userActionReason}</p>
        ) : null}
        <div className="mt-2 flex max-w-[260px] flex-wrap gap-1.5">
          {row.finalDecision ? (
            <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => openDialog('different')}>
              <PencilLine aria-hidden="true" />
              변경
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="xs"
                disabled={!canApply || isPending}
                title={canApply ? undefined : '추가 사실이나 증빙을 확인한 뒤 다르게 확정해 주세요.'}
                onClick={applyRecommendation}
              >
                {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                적용
              </Button>
              <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => openDialog('different')}>
                <PencilLine aria-hidden="true" />
                다르게
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={isPending || row.userActionStatus === 'held'}
                onClick={() => openDialog('hold')}
              >
                <Pause aria-hidden="true" />
                보류
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={isPending || row.userActionStatus === 'expert_review'}
                onClick={() => openDialog('expert_review')}
              >
                <UserRoundSearch aria-hidden="true" />
                전문가 확인
              </Button>
            </>
          )}
        </div>
      </div>

      {dialogMode ? (
        <VatTaxTreatmentDecisionDialog
          key={dialogMode}
          row={row}
          mode={dialogMode}
          isPending={isPending}
          onClose={() => setDialogMode(null)}
          onSubmit={runMutation}
        />
      ) : null}
    </>
  )
}

async function patchVatTaxTreatment(
  rowId: string,
  input: VatTaxTreatmentMutationInput,
): Promise<MutationResult> {
  const response = await fetch(`/api/vat/tax-treatments/${rowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      ok: false,
      message: typeof body?.error === 'string' ? body.error : '부가세 판단 저장에 실패했습니다.',
    }
  }
  const parsed = vatTaxTreatmentMutationSuccessSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, message: '부가세 판단 저장 결과를 확인할 수 없습니다.' }
  }
  return parsed.data
}

function showVatUndoableToast(params: {
  row: VatTaxTreatmentDisplayRow
  message: string
  undoToken: string | null
  router: { refresh: () => void }
}) {
  const sequence = latestVatUndoSequence + 1
  latestVatUndoSequence = sequence
  if (!params.undoToken) {
    toast.success(params.message)
    return
  }

  toast.success(params.message, {
    action: {
      label: '되돌리기',
      onClick: () => {
        if (sequence !== latestVatUndoSequence) {
          toast.error('가장 최근 작업만 되돌릴 수 있습니다.')
          return
        }
        void patchVatTaxTreatment(params.row.rowId, {
          action: 'undo',
          periodKey: params.row.periodKey,
          undoToken: params.undoToken!,
        }).then((result) => {
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          latestVatUndoSequence += 1
          toast.success('부가세 판단을 되돌렸습니다.')
          params.router.refresh()
        })
      },
    },
  })
}

function userActionStatusLabel(row: VatTaxTreatmentDisplayRow) {
  if (row.userActionStatus === 'confirmed' && row.finalDecision) {
    return `사용자 확정 · ${vatTaxTreatmentDecisionLabel(row.finalDecision)}`
  }
  if (row.userActionStatus === 'held') return '보류'
  if (row.userActionStatus === 'expert_review') return '전문가 확인'
  return '미확정'
}

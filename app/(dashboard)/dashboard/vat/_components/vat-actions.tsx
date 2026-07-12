'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { VatDeductionReviewRow } from '@/lib/vat/summary'
import { cn } from '@/lib/utils'

interface VatDeductionActionButtonsProps {
  readonly review: VatDeductionReviewRow
}

export function VatDeductionActionButtons({ review }: VatDeductionActionButtonsProps) {
  const router = useRouter()
  const [isProrationOpen, setIsProrationOpen] = useState(false)
  const [prorationPercent, setProrationPercent] = useState(() => (
    review.prorationRateBps != null ? String(review.prorationRateBps / 100) : '50'
  ))
  const [isPending, startTransition] = useTransition()

  function runAction(label: string, payload: DeductionPatchPayload) {
    if (label === '안분 계산') setIsProrationOpen(false)

    startTransition(async () => {
      const result = await patchDeductionReview(review.id, payload)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(label === '공제' || label === '공제 확정'
        ? '매입세액을 공제로 확정했습니다.'
        : label === '불공제 확정'
          ? '매입세액을 불공제로 확정했습니다.'
          : '안분 공제율을 저장했습니다.')
      router.refresh()
    })
  }

  function submitProration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const rateBps = parseProrationRateBps(prorationPercent)
    if (rateBps == null) {
      toast.error('공제 비율은 0보다 크고 100 이하인 숫자여야 합니다.')
      return
    }
    runAction('안분 계산', {
      decision: 'prorated',
      reason: review.reason || undefined,
      prorationRateBps: rateBps,
    })
  }

  if (isProrationOpen) {
    return (
      <form className="inline-flex items-center gap-1.5" onSubmit={submitProration}>
        <label className="sr-only" htmlFor={`vat-proration-${review.id}`}>안분 공제율</label>
        <input
          id={`vat-proration-${review.id}`}
          type="number"
          min="0.01"
          max="100"
          step="0.01"
          inputMode="decimal"
          value={prorationPercent}
          disabled={isPending}
          onChange={(event) => setProrationPercent(event.target.value)}
          className="h-[27px] w-[72px] rounded-[7px] border border-company-border-strong bg-company-surface px-2 text-[11.5px] font-semibold text-foreground tabular-nums"
        />
        <span className="text-[11px] font-semibold text-company-fg-subtle">%</span>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[7px] border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1 text-[11.5px] font-semibold text-[#d97706] disabled:cursor-wait disabled:opacity-70"
        >
          저장
        </button>
        <button
          type="button"
          disabled={isPending}
          className="rounded-[7px] border border-company-border-strong bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => setIsProrationOpen(false)}
        >
          취소
        </button>
      </form>
    )
  }

  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {review.actionLabels.map((label) => (
        <button
          key={label}
          type="button"
          disabled={isPending || label === '확정됨'}
          className={cn(
            'rounded-[7px] border border-company-border-strong bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-75',
            label.includes('불공제') && 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
            label === '확정됨' && 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
          )}
          onClick={() => {
            if (label === '안분 계산') {
              setIsProrationOpen(true)
              return
            }
            const payload = payloadForAction(label, review)
            if (payload) runAction(label, payload)
          }}
        >
          {isPending && label !== '확정됨' ? '처리 중' : label}
        </button>
      ))}
    </div>
  )
}

type DeductionPatchPayload =
  | { decision: 'deductible'; reason?: string }
  | { decision: 'non_deductible'; reason: string }
  | { decision: 'prorated'; reason?: string; prorationRateBps: number }

function payloadForAction(label: string, review: VatDeductionReviewRow): DeductionPatchPayload | null {
  if (label === '공제' || label === '공제 확정') {
    return { decision: 'deductible', reason: review.reason || undefined }
  }
  if (label === '불공제 확정') {
    return { decision: 'non_deductible', reason: review.reason || '사용자 불공제 확정' }
  }
  return null
}

function parseProrationRateBps(value: string) {
  const ratePercent = Number(value.trim())
  if (!Number.isFinite(ratePercent) || ratePercent <= 0 || ratePercent > 100) {
    return null
  }
  return Math.round(ratePercent * 100)
}

async function patchDeductionReview(reviewId: string, payload: DeductionPatchPayload) {
  const response = await fetch(`/api/vat/deduction-reviews/${reviewId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseMutationResponse(response)
}

async function parseMutationResponse(response: Response): Promise<{ ok: true } | { ok: false; message: string }> {
  const data = await response.json().catch(() => null) as { error?: unknown } | null
  if (!response.ok) {
    return {
      ok: false,
      message: typeof data?.error === 'string' ? data.error : '요청을 처리하지 못했습니다.',
    }
  }
  return { ok: true }
}

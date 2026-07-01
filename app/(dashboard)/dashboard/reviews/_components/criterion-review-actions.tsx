'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  getDisplayStaffNote,
  getStaffCriterionResolutionLabel,
  hasStaffCriterionResolution,
  shouldShowOptionalReasonInput,
} from './criterion-review-ui'
import type { SubmissionStatusKey } from '@/lib/reviews/review-submission-status'
import type { ReviewValidation } from '@/lib/reviews/review-workspace-types'

type ReviewStatus = 'overridden' | 'excluded'

export function CriterionReviewActions({
  sessionId,
  sessionStatus,
  validation,
  submissionStatusKey,
}: {
  sessionId: string
  sessionStatus: string
  validation: ReviewValidation
  submissionStatusKey: SubmissionStatusKey
}) {
  const router = useRouter()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [staffNote, setStaffNote] = useState(validation.staffNote ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isResolved = hasStaffCriterionResolution(validation)
  const canShow =
    isResolved ||
    shouldShowOptionalReasonInput({
      sessionStatus,
      validation,
      submissionStatusKey,
    })

  if (!canShow) {
    return null
  }

  const savedNote = getDisplayStaffNote(validation.staffNote)
  const resolutionLabel = isResolved ? getStaffCriterionResolutionLabel(validation.reviewStatus) : null

  const closePanel = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false
    }
    setIsOpen(false)
  }

  const submitReview = (reviewStatus: ReviewStatus) => {
    const trimmedNote = staffNote.trim()
    if (!trimmedNote) {
      toast.error('담당자 승인/제외에는 사유 메모가 필요합니다.')
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/criteria/${validation.id}/review`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewStatus, staffNote: trimmedNote }),
          },
        )
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(body?.error ?? '담당자 검토를 저장하지 못했습니다.')
          return
        }

        toast.success(
          reviewStatus === 'excluded'
            ? '해당 없음/제외 처리를 저장했습니다.'
            : '담당자 승인을 저장했습니다.',
        )
        closePanel()
        router.refresh()
      } catch {
        toast.error('담당자 검토를 저장하지 못했습니다.')
      }
    })
  }

  return (
    <div className="inline-block max-w-xs text-left">
      <details
        ref={detailsRef}
        className="relative inline-block text-left"
        onToggle={(event) => {
          const open = event.currentTarget.open
          setIsOpen(open)
          if (open) {
            setStaffNote(validation.staffNote ?? '')
          }
        }}
      >
        <summary
          className={cn(
            'inline-flex cursor-pointer list-none items-center whitespace-nowrap [&::-webkit-details-marker]:hidden',
            isResolved
              ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'
              : 'rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground',
          )}
        >
          {isResolved ? resolutionLabel : '사유 입력'}
        </summary>
        <div className="mt-2 min-w-[240px] rounded-lg border border-border bg-background p-3 sm:min-w-[320px]">
          <label className="block text-xs font-semibold text-foreground">예외 처리 사유</label>
          <Textarea
            value={staffNote}
            onChange={(event) => setStaffNote(event.target.value)}
            placeholder="예: 해당 기간 카드 사용 없음 확인"
            rows={3}
            disabled={isPending}
            className="mt-2 min-h-16 bg-background text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => submitReview('overridden')}
            >
              담당자 승인
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => submitReview('excluded')}
            >
              해당 없음/제외
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={closePanel}
            >
              취소
            </Button>
          </div>
        </div>
      </details>
      {isResolved && savedNote && !isOpen ? (
        <p className="mt-1 text-xs text-muted-foreground">{savedNote}</p>
      ) : null}
    </div>
  )
}

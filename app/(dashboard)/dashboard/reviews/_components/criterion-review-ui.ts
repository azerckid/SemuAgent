import type { ReviewValidation } from '@/lib/reviews/review-workspace-types'
import type { SubmissionStatusKey } from '@/lib/reviews/review-submission-status'
import {
  isMaterialCriterion,
  isRequiredCriterion,
  isUnresolvedRequiredMaterial,
} from '@/lib/sessions/completion-eligibility'

const REVIEWABLE_SESSION_STATUSES = ['needs_resubmission', 'ready_for_accountant'] as const

export function isReviewableSessionStatus(status: string) {
  return (REVIEWABLE_SESSION_STATUSES as readonly string[]).includes(status)
}

export function shouldShowOptionalReasonInput(params: {
  sessionStatus: string
  validation: Pick<
    ReviewValidation,
    'criterionType' | 'requiredness' | 'validationStatus' | 'reviewStatus' | 'staffNote'
  >
  submissionStatusKey: SubmissionStatusKey
}) {
  if (!isReviewableSessionStatus(params.sessionStatus)) return false
  if (!isEligibleCriterionReviewTarget(params.validation)) return false
  if (hasStaffCriterionResolution(params.validation)) return false
  if (params.submissionStatusKey !== 'none') return false
  return isUnresolvedRequiredMaterial(params.validation)
}

export function hasStaffCriterionResolution(
  validation: Pick<ReviewValidation, 'validationStatus' | 'reviewStatus' | 'staffNote'>,
) {
  return (
    validation.validationStatus !== 'satisfied' &&
    (validation.reviewStatus === 'overridden' || validation.reviewStatus === 'excluded')
  )
}

export function getStaffCriterionResolutionLabel(reviewStatus: string) {
  if (reviewStatus === 'overridden') return '승인했음'
  if (reviewStatus === 'excluded') return '제외했음'
  return null
}

const HIDDEN_STAFF_NOTE_VALUES = new Set(['없음', '-'])

export function getDisplayStaffNote(staffNote: string | null | undefined) {
  const trimmed = staffNote?.trim() ?? ''
  if (!trimmed || HIDDEN_STAFF_NOTE_VALUES.has(trimmed)) {
    return null
  }
  return trimmed
}

export function isEligibleCriterionReviewTarget(
  validation: Pick<ReviewValidation, 'criterionType' | 'requiredness'>,
) {
  return isMaterialCriterion(validation) && isRequiredCriterion(validation)
}

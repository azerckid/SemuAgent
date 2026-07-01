import { describe, expect, it } from 'vitest'
import {
  getDisplayStaffNote,
  getStaffCriterionResolutionLabel,
  hasStaffCriterionResolution,
  shouldShowOptionalReasonInput,
} from './criterion-review-ui'

describe('criterion-review-ui', () => {
  it('shows optional reason input only for no-submission required material rows in reviewable sessions', () => {
    expect(shouldShowOptionalReasonInput({
      sessionStatus: 'needs_resubmission',
      submissionStatusKey: 'none',
      validation: {
        criterionType: 'material',
        requiredness: 'required',
        validationStatus: 'missing',
        reviewStatus: 'ai_suggested',
        staffNote: null,
      },
    })).toBe(true)

    expect(shouldShowOptionalReasonInput({
      sessionStatus: 'needs_resubmission',
      submissionStatusKey: 'submitted',
      validation: {
        criterionType: 'material',
        requiredness: 'required',
        validationStatus: 'missing',
        reviewStatus: 'ai_suggested',
        staffNote: null,
      },
    })).toBe(false)

    expect(shouldShowOptionalReasonInput({
      sessionStatus: 'needs_resubmission',
      submissionStatusKey: 'none',
      validation: {
        criterionType: 'material',
        requiredness: 'optional',
        validationStatus: 'missing',
        reviewStatus: 'ai_suggested',
        staffNote: null,
      },
    })).toBe(false)

    expect(shouldShowOptionalReasonInput({
      sessionStatus: 'completed',
      submissionStatusKey: 'none',
      validation: {
        criterionType: 'material',
        requiredness: 'required',
        validationStatus: 'missing',
        reviewStatus: 'ai_suggested',
        staffNote: null,
      },
    })).toBe(false)
  })

  it('hides optional reason input after staff resolution is recorded', () => {
    expect(hasStaffCriterionResolution({
      validationStatus: 'missing',
      reviewStatus: 'excluded',
      staffNote: '해당 월 매출 없음',
    })).toBe(true)

    expect(hasStaffCriterionResolution({
      validationStatus: 'missing',
      reviewStatus: 'overridden',
      staffNote: null,
    })).toBe(true)

    expect(shouldShowOptionalReasonInput({
      sessionStatus: 'needs_resubmission',
      submissionStatusKey: 'none',
      validation: {
        criterionType: 'material',
        requiredness: 'required',
        validationStatus: 'missing',
        reviewStatus: 'excluded',
        staffNote: '해당 월 매출 없음',
      },
    })).toBe(false)
  })

  it('returns concise completed-state labels', () => {
    expect(getStaffCriterionResolutionLabel('overridden')).toBe('승인했음')
    expect(getStaffCriterionResolutionLabel('excluded')).toBe('제외했음')
  })

  it('hides placeholder staff note values from result display', () => {
    expect(getDisplayStaffNote('없음')).toBeNull()
    expect(getDisplayStaffNote('-')).toBeNull()
    expect(getDisplayStaffNote('  없음  ')).toBeNull()
    expect(getDisplayStaffNote('해당 월 매출 없음')).toBe('해당 월 매출 없음')
  })
})

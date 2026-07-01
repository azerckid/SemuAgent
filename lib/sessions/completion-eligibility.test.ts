import { describe, expect, it } from 'vitest'
import {
  buildCompletionCriteriaSummary,
  computeCompletionEligibility,
  isCriterionResolved,
  isMissingRequestDraftTarget,
  isUnresolvedRequiredMaterial,
  resolveSessionStatusAfterReview,
} from './completion-eligibility'

function criterion(overrides: Partial<{
  criterionType: string | null
  requiredness: string
  validationStatus: string
  reviewStatus: string
}> = {}) {
  return {
    criterionType: 'material' as string | null,
    requiredness: 'required',
    validationStatus: 'missing',
    reviewStatus: 'ai_suggested',
    ...overrides,
  }
}

describe('computeCompletionEligibility', () => {
  it('returns not eligible when there are no criteria', () => {
    const result = computeCompletionEligibility([])

    expect(result.eligible).toBe(false)
    expect(result.blockReason).toBe('no_criteria')
  })

  it('treats all AI-satisfied required material as normal completion eligibility', () => {
    const result = computeCompletionEligibility([
      criterion({ validationStatus: 'satisfied', reviewStatus: 'ai_suggested' }),
    ])

    expect(result).toMatchObject({
      eligible: true,
      completionKind: 'normal',
      unresolvedRequiredCount: 0,
      hasStaffExceptionResolution: false,
    })
  })

  it('treats staff excluded missing items as exception completion eligibility', () => {
    const result = computeCompletionEligibility([
      criterion({ validationStatus: 'missing', reviewStatus: 'excluded' }),
    ])

    expect(result).toMatchObject({
      eligible: true,
      completionKind: 'exception',
      hasStaffExceptionResolution: true,
    })
  })

  it('keeps missing required items unresolved until staff overrides them', () => {
    expect(isUnresolvedRequiredMaterial(criterion())).toBe(true)
    expect(isCriterionResolved(criterion({ reviewStatus: 'confirmed' }))).toBe(false)

    const result = computeCompletionEligibility([criterion()])
    expect(result.eligible).toBe(false)
    expect(result.blockReason).toBe('unresolved_required')
  })

  it('does not block completion on optional material criteria', () => {
    const result = computeCompletionEligibility([
      criterion({ validationStatus: 'satisfied' }),
      criterion({ requiredness: 'optional', validationStatus: 'missing' }),
    ])

    expect(result.eligible).toBe(true)
  })

  it('does not treat format_check-only sessions as completion eligible', () => {
    const result = computeCompletionEligibility([
      criterion({ criterionType: 'format_check', validationStatus: 'satisfied' }),
    ])

    expect(result.eligible).toBe(false)
    expect(result.blockReason).toBe('no_material_criteria')
  })
})

describe('resolveSessionStatusAfterReview', () => {
  it('promotes needs_resubmission to ready_for_accountant when eligible', () => {
    const eligibility = computeCompletionEligibility([
      criterion({ validationStatus: 'missing', reviewStatus: 'excluded' }),
    ])

    expect(resolveSessionStatusAfterReview({
      currentStatus: 'needs_resubmission',
      eligibility,
    })).toBe('ready_for_accountant')
  })

  it('demotes ready_for_accountant when required criteria become unresolved again', () => {
    const eligibility = computeCompletionEligibility([criterion()])

    expect(resolveSessionStatusAfterReview({
      currentStatus: 'ready_for_accountant',
      eligibility,
    })).toBe('needs_resubmission')
  })
})

describe('isMissingRequestDraftTarget', () => {
  it('excludes missing (not yet uploaded) validations', () => {
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'ai_suggested',
      validationStatus: 'missing',
    })).toBe(false)
  })

  it('includes uploaded-but-needs-follow-up validations', () => {
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'ai_suggested',
      validationStatus: 'non_compliant',
    })).toBe(true)
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'ai_suggested',
      validationStatus: 'uncertain',
    })).toBe(true)
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'ai_suggested',
      validationStatus: 'partially_satisfied',
    })).toBe(true)
  })

  it('excludes staff overridden and excluded validations', () => {
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'overridden',
      validationStatus: 'non_compliant',
    })).toBe(false)
    expect(isMissingRequestDraftTarget({
      reviewStatus: 'excluded',
      validationStatus: 'uncertain',
    })).toBe(false)
  })
})

describe('buildCompletionCriteriaSummary', () => {
  it('labels exception completion for staff records', () => {
    expect(buildCompletionCriteriaSummary({
      completionKind: 'exception',
      acceptedFileCount: 2,
    })).toBe('담당자 예외 검토 완료 · 부합 자료 2개')
  })
})

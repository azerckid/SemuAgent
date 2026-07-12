import { describe, expect, it } from 'vitest'
import {
  deriveVatTaxTreatmentJudgmentContract,
  provisionalJudgmentForFinalDecision,
  recommendationForProvisionalJudgment,
} from './tax-treatment-judgment'

describe('VAT judgment and workflow contract', () => {
  it('maps a decisive recommendation to an explicit provisional judgment', () => {
    expect(deriveVatTaxTreatmentJudgmentContract({
      recommendation: 'likely_deductible',
      aiRuntimeStatus: 'completed',
      finalDecision: null,
    })).toEqual({
      provisionalJudgment: 'deductible',
      judgmentWorkflowStatus: 'user_confirmation_pending',
    })
  })

  it('keeps a legacy unresolved rule as workflow state rather than a tax conclusion', () => {
    expect(deriveVatTaxTreatmentJudgmentContract({
      recommendation: 'needs_review',
      aiRuntimeStatus: 'not_requested',
      finalDecision: null,
    })).toEqual({
      provisionalJudgment: null,
      judgmentWorkflowStatus: 'judgment_pending',
    })
  })

  it('keeps AI failure separate from a tax conclusion', () => {
    expect(deriveVatTaxTreatmentJudgmentContract({
      recommendation: 'needs_review',
      aiRuntimeStatus: 'manual_fallback',
      finalDecision: null,
    })).toEqual({
      provisionalJudgment: null,
      judgmentWorkflowStatus: 'ai_temporary_error',
    })
  })

  it('uses the canonical user decision when the row is confirmed', () => {
    expect(deriveVatTaxTreatmentJudgmentContract({
      recommendation: 'needs_review',
      aiRuntimeStatus: 'not_requested',
      finalDecision: 'non_deductible',
    })).toEqual({
      provisionalJudgment: 'non_deductible',
      judgmentWorkflowStatus: 'user_confirmed',
    })
    expect(provisionalJudgmentForFinalDecision('prorated')).toBe('proration_required')
  })

  it('keeps human resolution separate from confidence and AI temporary errors', () => {
    expect(deriveVatTaxTreatmentJudgmentContract({
      recommendation: 'proration_required',
      aiRuntimeStatus: 'not_requested',
      finalDecision: null,
      humanResolutionRequired: true,
    })).toEqual({
      provisionalJudgment: 'proration_required',
      judgmentWorkflowStatus: 'human_resolution_required',
    })
  })

  it('converts provider judgments to the legacy recommendation only at the compatibility boundary', () => {
    expect(recommendationForProvisionalJudgment('zero_rated')).toBe('likely_zero_rated')
    expect(recommendationForProvisionalJudgment('non_deductible')).toBe('likely_non_deductible')
  })
})

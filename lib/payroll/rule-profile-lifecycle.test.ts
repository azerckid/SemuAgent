import { describe, expect, it } from 'vitest'
import {
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  type ClientPayrollRuleProfileV1,
} from '@/lib/validations/payroll-rule-profile'
import {
  countApprovalBlockingConflicts,
  countConflictRows,
  countNeedsReviewRows,
  effectivePeriodsOverlap,
  normalizeProfileForApproval,
} from './rule-profile-lifecycle'

function baseProfile(overrides: Partial<ClientPayrollRuleProfileV1> = {}): ClientPayrollRuleProfileV1 {
  return {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: 'client-1',
    effectiveFrom: '2026-06',
    sourcePriority: ['rule_document', 'statutory_default'],
    allowanceRules: [{
      sourceRuleId: 'doc-1',
      displayName: '식대',
      category: 'allowance',
      targetField: 'meal_allowance',
      formulaKind: 'fixed_amount',
      formulaJson: {},
      taxableTreatment: 'non_taxable',
      requiredInputs: [],
      sourceCitations: [{ sourceType: 'rule_document', reference: '임금규정' }],
      status: 'needs_review',
    }],
    deductionRules: [],
    taxabilityRules: [],
    statutoryFallbacks: [],
    requiredInputs: [],
    conflictItems: [],
    approvalChecklist: {
      sourcesReviewed: false,
      mappingReviewed: false,
      formulasReviewed: false,
      statutoryReviewed: false,
    },
    ...overrides,
  }
}

describe('effectivePeriodsOverlap', () => {
  it('겹치는 기간을 true로 판단한다', () => {
    expect(effectivePeriodsOverlap('2026-01', null, '2026-06', null)).toBe(true)
    expect(effectivePeriodsOverlap('2026-01', '2026-12', '2026-06', '2026-09')).toBe(true)
  })

  it('겹치지 않는 기간을 false로 판단한다', () => {
    expect(effectivePeriodsOverlap('2026-01', '2026-05', '2026-06', null)).toBe(false)
  })
})

describe('normalizeProfileForApproval', () => {
  it('needs_review row를 ready로 승격한다', () => {
    const result = normalizeProfileForApproval(baseProfile(), '2026-06')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.allowanceRules[0]?.status).toBe('ready')
    expect(countNeedsReviewRows(result.profile)).toBe(0)
  })

  it('excluded row는 그대로 유지한다', () => {
    const profile = baseProfile({
      allowanceRules: [{
        ...baseProfile().allowanceRules[0]!,
        status: 'excluded',
      }],
    })
    const result = normalizeProfileForApproval(profile, '2026-06')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.allowanceRules[0]?.status).toBe('excluded')
  })

  it('conflict row가 있으면 승인 정규화를 거부한다', () => {
    const profile = baseProfile({
      allowanceRules: [{
        ...baseProfile().allowanceRules[0]!,
        status: 'conflict',
      }],
    })
    const result = normalizeProfileForApproval(profile, '2026-06')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('conflict_rows')
    expect(countApprovalBlockingConflicts(profile)).toBe(1)
  })

  it('conflictItems만 있어도 승인 정규화를 거부한다', () => {
    const profile = baseProfile({
      conflictItems: [{
        ruleId: 'out-1',
        kind: 'other',
        detail: '더존 F~T 밖 공제 규칙',
      }],
    })
    const result = normalizeProfileForApproval(profile, '2026-06')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('conflict_rows')
    expect(countApprovalBlockingConflicts(profile)).toBe(1)
    expect(countConflictRows(profile)).toBe(0)
  })
})

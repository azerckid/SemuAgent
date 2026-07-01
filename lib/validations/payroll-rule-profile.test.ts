import { describe, expect, it } from 'vitest'
import {
  clientPayrollRuleProfileV1Schema,
  parseClientPayrollRuleProfile,
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  type ClientPayrollRuleProfileV1,
} from './payroll-rule-profile'

function validProfile(): ClientPayrollRuleProfileV1 {
  return {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: 'client-1',
    effectiveFrom: '2026-01',
    sourcePriority: ['mapping_table', 'rule_document', 'statutory_default'],
    allowanceRules: [
      {
        sourceRuleId: 'r1',
        displayName: '식대',
        category: 'allowance',
        targetField: 'meal_allowance',
        formulaKind: 'fixed_amount',
        formulaJson: { amount: 200000 },
        taxableTreatment: 'non_taxable',
        requiredInputs: [],
        sourceCitations: [{ sourceType: 'rule_document', reference: '임금규정 3조' }],
        status: 'ready',
      },
    ],
    deductionRules: [],
    taxabilityRules: [{ targetField: 'meal_allowance', treatment: 'non_taxable', nonTaxableLimit: 200000 }],
    statutoryFallbacks: [{ key: 'national_pension', basis: '기준보수월액 x 요율' }],
    requiredInputs: [{ key: 'regularHours', label: '소정근로시간' }],
    conflictItems: [],
    approvalChecklist: {
      sourcesReviewed: true,
      mappingReviewed: true,
      formulasReviewed: true,
      statutoryReviewed: true,
    },
  }
}

describe('clientPayrollRuleProfileV1Schema', () => {
  it('정상 프로필을 통과시킨다', () => {
    expect(clientPayrollRuleProfileV1Schema.safeParse(validProfile()).success).toBe(true)
  })

  it('schemaVersion이 다르면 거부한다(fail closed)', () => {
    const bad = { ...validProfile(), schemaVersion: 'client_payroll_rule_profile.v2' }
    expect(clientPayrollRuleProfileV1Schema.safeParse(bad).success).toBe(false)
  })

  it('알 수 없는 enum 값(category)을 거부한다', () => {
    const bad = validProfile()
    // @ts-expect-error 의도적으로 잘못된 enum
    bad.allowanceRules[0].category = 'unknown_category'
    expect(clientPayrollRuleProfileV1Schema.safeParse(bad).success).toBe(false)
  })

  it('알 수 없는 source type을 거부한다', () => {
    const bad = validProfile()
    // @ts-expect-error 의도적으로 잘못된 enum
    bad.sourcePriority = ['bank_statement']
    expect(clientPayrollRuleProfileV1Schema.safeParse(bad).success).toBe(false)
  })

  it('단가x수량 계산식과 법적 근거를 formulaJson으로 검증한다', () => {
    const ok = validProfile()
    ok.allowanceRules[0] = {
      ...ok.allowanceRules[0],
      displayName: '야근수당',
      targetField: 'night_work_allowance',
      formulaKind: 'unit_rate',
      formulaJson: {
        summary: '야근 1일당 100000원 x 야근일수',
        basisType: 'company_rule',
        lawBasis: [{ lawName: '근로기준법', article: '제56조', summary: '야간근로 가산임금' }],
        calculation: {
          expression: 'unitAmount * nightWorkDays',
          unitAmount: 100000,
          unit: 'day',
          quantityInputKey: 'nightWorkDays',
          multiplier: null,
          resultField: 'night_work_allowance',
        },
        amount: null,
      },
    }

    expect(clientPayrollRuleProfileV1Schema.safeParse(ok).success).toBe(true)
  })

  it('알 수 없는 formula/basis enum을 거부한다', () => {
    const badFormula = validProfile()
    // @ts-expect-error 의도적으로 잘못된 enum
    badFormula.allowanceRules[0].formulaKind = 'magic_formula'
    expect(clientPayrollRuleProfileV1Schema.safeParse(badFormula).success).toBe(false)

    const badBasis = validProfile()
    badBasis.allowanceRules[0].formulaJson = {
      ...badBasis.allowanceRules[0].formulaJson,
      // @ts-expect-error 의도적으로 잘못된 enum
      basisType: 'magic_basis',
    }
    expect(clientPayrollRuleProfileV1Schema.safeParse(badBasis).success).toBe(false)
  })

  it('잘못된 effective 기간 형식을 거부한다(2026-6 / 2026-13 / 임의 문자열)', () => {
    for (const value of ['2026-6', '2026-13', '2026-00', 'abc', '2026-06-15']) {
      const bad = { ...validProfile(), effectiveFrom: value }
      expect(clientPayrollRuleProfileV1Schema.safeParse(bad).success).toBe(false)
    }
  })

  it('effectiveTo가 effectiveFrom보다 앞서면 거부한다', () => {
    const bad = { ...validProfile(), effectiveFrom: '2026-06', effectiveTo: '2026-03' }
    expect(clientPayrollRuleProfileV1Schema.safeParse(bad).success).toBe(false)
  })

  it('effectiveTo가 effectiveFrom 이상이면 통과한다', () => {
    const ok = { ...validProfile(), effectiveFrom: '2026-01', effectiveTo: '2026-12' }
    expect(clientPayrollRuleProfileV1Schema.safeParse(ok).success).toBe(true)
  })
})

describe('parseClientPayrollRuleProfile', () => {
  it('정상 JSON 문자열을 파싱한다', () => {
    const json = JSON.stringify(validProfile())
    expect(parseClientPayrollRuleProfile(json)?.clientId).toBe('client-1')
  })

  it('깨진 JSON은 null을 반환한다', () => {
    expect(parseClientPayrollRuleProfile('{ not json')).toBeNull()
  })

  it('스키마 불일치 JSON은 null을 반환한다', () => {
    expect(parseClientPayrollRuleProfile(JSON.stringify({ foo: 'bar' }))).toBeNull()
  })
})

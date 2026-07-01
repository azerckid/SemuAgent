import { describe, expect, it } from 'vitest'
import { applyClientPayrollRuleProfileToRows, markConflictRowsForReview } from './rule-profile-apply'
import { resolvePayrollStoredVerdict } from './payroll-row-sanitization'
import {
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  type ClientPayrollRuleProfileV1,
  type PayrollRuleItem,
} from '@/lib/validations/payroll-rule-profile'
import type { PayrollExtractedRow } from '@/lib/validations/payroll'

function rule(overrides: Partial<PayrollRuleItem> & Pick<PayrollRuleItem, 'targetField'>): PayrollRuleItem {
  return {
    sourceRuleId: 'r1',
    displayName: '식대',
    category: 'allowance',
    formulaKind: 'fixed_amount',
    formulaJson: { amount: 200000, nonTaxableLimit: 200000 },
    taxableTreatment: 'non_taxable',
    requiredInputs: [],
    sourceCitations: [{ sourceType: 'rule_document', reference: '임금규정 p.3' }],
    status: 'ready',
    ...overrides,
  }
}

function profileWith(rules: PayrollRuleItem[]): ClientPayrollRuleProfileV1 {
  return {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: 'client-1',
    effectiveFrom: '2026-03',
    sourcePriority: ['rule_document', 'statutory_default'],
    allowanceRules: rules,
    deductionRules: [],
    taxabilityRules: [],
    statutoryFallbacks: [],
    requiredInputs: [],
    conflictItems: [],
    approvalChecklist: {
      sourcesReviewed: true,
      mappingReviewed: true,
      formulasReviewed: true,
      statutoryReviewed: true,
    },
  }
}

function row(overrides: Partial<PayrollExtractedRow> = {}): PayrollExtractedRow {
  return { confidence: 'high', ...overrides }
}

describe('applyClientPayrollRuleProfileToRows', () => {
  it('정액 규칙을 빈 칸에 채운다(전원 동일 금액)', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', formulaJson: { amount: 200000 } }),
    ])
    const rows = [row({ employeeName: '김OO' }), row({ employeeName: '이OO' })]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.rows[0].mealAllowance).toBe(200000)
    expect(result.rows[1].mealAllowance).toBe(200000)
    expect(result.filledCount).toBe(2)
    expect(result.appliedFields).toEqual(['meal_allowance'])
    expect(result.conflicts).toHaveLength(0)
  })

  it('이미 값이 있고 규정과 다르면 덮어쓰지 않고 충돌로 남긴다', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', formulaJson: { amount: 200000 } }),
    ])
    const rows = [row({ employeeName: '김OO', mealAllowance: 150000 })]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.rows[0].mealAllowance).toBe(150000) // 보존
    expect(result.filledCount).toBe(0)
    expect(result.conflicts).toEqual([
      { employeeIndex: 0, targetField: 'meal_allowance', ruleAmount: 200000, existingAmount: 150000 },
    ])
    expect(result.warnings.join(' ')).toContain('덮어쓰지 않았습니다')
  })

  it('이미 값이 규정과 일치하면 변경 없음·충돌 없음', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', formulaJson: { amount: 200000 } }),
    ])
    const rows = [row({ mealAllowance: 200000 })]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.filledCount).toBe(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('변동 계산(rate/hours_multiplier)은 자동 적용하지 않고 검토로 남긴다', () => {
    const profile = profileWith([
      rule({
        targetField: 'overtime_allowance',
        displayName: '연장근무',
        formulaKind: 'hours_multiplier',
        formulaJson: { summary: '통상시급 1.5배' },
      }),
    ])
    const rows = [row()]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.rows[0].overtimeAllowance).toBeUndefined()
    expect(result.filledCount).toBe(0)
    expect(result.skippedRules).toEqual([
      { displayName: '연장근무', targetField: 'overtime_allowance', reason: 'non_fixed_formula' },
    ])
    expect(result.warnings.join(' ')).toContain('직원별 입력이 필요')
  })

  it('단가x수량(unit_rate)은 구조화만 보존하고 자동 적용하지 않는다', () => {
    const profile = profileWith([
      rule({
        targetField: 'night_work_allowance',
        displayName: '야근수당',
        formulaKind: 'unit_rate',
        formulaJson: {
          basisType: 'company_rule',
          calculation: {
            expression: 'unitAmount * nightWorkDays',
            unitAmount: 100000,
            unit: 'day',
            quantityInputKey: 'nightWorkDays',
            resultField: 'night_work_allowance',
          },
        },
      }),
    ])
    const rows = [row({ employeeName: '김OO' })]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.rows[0].nightWorkAllowance).toBeUndefined()
    expect(result.filledCount).toBe(0)
    expect(result.skippedRules).toEqual([
      { displayName: '야근수당', targetField: 'night_work_allowance', reason: 'non_fixed_formula' },
    ])
  })

  it('fixed_amount인데 실행 가능한 금액이 없으면 채우지 않는다(missing_amount)', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', formulaJson: { summary: '월 20만원', nonTaxableLimit: 200000 } }),
    ])
    const rows = [row()]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.rows[0].mealAllowance).toBeUndefined()
    expect(result.filledCount).toBe(0)
    expect(result.skippedRules[0].reason).toBe('missing_amount')
  })

  it('conflict/excluded 상태 규칙과 미매핑 필드는 적용하지 않는다', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', status: 'conflict', formulaJson: { amount: 200000 } }),
      rule({ targetField: 'unmapped:foo', displayName: '알수없음', formulaJson: { amount: 100000 } }),
    ])
    const rows = [row()]

    const result = applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(result.filledCount).toBe(0)
    const reasons = result.skippedRules.map((s) => s.reason).sort()
    expect(reasons).toEqual(['excluded_status', 'unsupported_field'])
  })

  it('입력 rows를 변경하지 않는다(불변)', () => {
    const profile = profileWith([
      rule({ targetField: 'meal_allowance', formulaJson: { amount: 200000 } }),
    ])
    const original = row({ employeeName: '김OO' })
    const rows = [original]

    applyClientPayrollRuleProfileToRows({ profile, rows })

    expect(original.mealAllowance).toBeUndefined()
  })
})

describe('markConflictRowsForReview (결과 엑셀 안전 게이트)', () => {
  it('충돌 행에 검토 사유를 달아 fail로 강등되게 한다', () => {
    const sanitized = [
      { row: row({ mealAllowance: 150000 }), reviewReason: null as string | null },
      { row: row({ mealAllowance: 200000 }), reviewReason: null as string | null },
    ]
    markConflictRowsForReview(sanitized, [
      { employeeIndex: 0, targetField: 'meal_allowance', ruleAmount: 200000, existingAmount: 150000 },
    ])

    expect(sanitized[0].reviewReason).toContain('승인된 급여기준과 업로드 금액이 다릅니다')
    expect(sanitized[1].reviewReason).toBeNull()

    // 충돌 행은 기존 pass였어도 저장 시 fail로 강등돼 결과 엑셀 게이트를 막는다.
    const verdict = resolvePayrollStoredVerdict(
      { aiVerdict: 'pass', confidence: 'high' },
      sanitized[0].reviewReason,
    )
    expect(verdict.aiVerdict).toBe('fail')
  })

  it('기존 검토 사유가 있으면 보존한다(덮어쓰지 않음)', () => {
    const sanitized = [{ row: row(), reviewReason: '합계 행 의심' as string | null }]
    markConflictRowsForReview(sanitized, [
      { employeeIndex: 0, targetField: 'meal_allowance', ruleAmount: 200000, existingAmount: 150000 },
    ])

    expect(sanitized[0].reviewReason).toBe('합계 행 의심')
  })
})

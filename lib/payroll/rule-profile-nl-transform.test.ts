import { describe, expect, it, vi } from 'vitest'
import {
  classifyNaturalLanguageSecurityLane,
  ruleTransformResponseSchema,
  transformNaturalLanguageToRuleDraft,
  type StructureRulesResult,
} from './rule-profile-nl-transform'
// ruleTransformResponseSchema는 위 import로 사용

// 실제 provider가 parseAiJson에서 Zod 기본값을 적용하므로, mock도 스키마를 통과시켜
// 충실하게 만든다(formulaSummary/requiredInputs 등 기본값 채움 + 픽스처 검증).
function okAi(rules: unknown[]): (text: string) => Promise<StructureRulesResult> {
  const data = ruleTransformResponseSchema.parse({ rules, notes: [] })
  return vi.fn(async () => ({ success: true as const, data, model: 'mock' }))
}

const baseInput = { clientId: 'client-1', effectiveFrom: '2026-06', naturalLanguage: '식대는 월 20만원 비과세' }

describe('classifyNaturalLanguageSecurityLane', () => {
  it('주민번호·계좌번호·휴대폰이 있으면 tee_required', () => {
    expect(classifyNaturalLanguageSecurityLane('직원 871010-1234567 식대')).toBe('tee_required')
    expect(classifyNaturalLanguageSecurityLane('계좌 110-123-456789로 지급')).toBe('tee_required')
    expect(classifyNaturalLanguageSecurityLane('연락처 010-1234-5678')).toBe('tee_required')
  })
  it('규칙만 있으면 normal', () => {
    expect(classifyNaturalLanguageSecurityLane('식대는 월 20만원 비과세, 직책수당은 정액')).toBe('normal')
  })
})

describe('transformNaturalLanguageToRuleDraft', () => {
  it('민감정보가 섞이면 AI를 호출하지 않고 tee로 차단한다', async () => {
    const callAi = okAi([])
    const result = await transformNaturalLanguageToRuleDraft(
      { ...baseInput, naturalLanguage: '직원 871010-1234567 식대 20만' },
      callAi,
    )
    expect(result.status).toBe('blocked_tee')
    expect(callAi).not.toHaveBeenCalled()
  })

  it('정상 지급 규칙을 draft 프로필로 구조화하고 공제는 업로드 제외로 보존한다', async () => {
    const result = await transformNaturalLanguageToRuleDraft(
      baseInput,
      okAi([
        { displayName: '식대', category: 'allowance', targetField: '식대(퇴)', formulaKind: 'fixed_amount', taxableTreatment: 'non_taxable', nonTaxableLimit: 200000, requiredInputs: [], sourceQuote: '식대 20만 비과세' },
        { displayName: '국민연금', category: 'insurance', targetField: '국민연금', formulaKind: 'manual_input', taxableTreatment: 'unknown', requiredInputs: ['공단 고지액'], sourceQuote: '공단 고지액' },
      ]),
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.profile.sourcePriority).toEqual(['natural_language', 'statutory_default'])
    expect(result.profile.allowanceRules.map((r) => r.targetField)).toEqual(['meal_allowance'])
    // 공제(국민연금)는 더존 업로드 컬럼이 아니므로 프로필 row가 아니라 제외 사유로 보존된다.
    expect(result.profile.deductionRules).toHaveLength(0)
    expect(result.profile.conflictItems).toEqual([
      expect.objectContaining({
        ruleId: 'nl-2',
        kind: 'other',
        detail: expect.stringContaining('국민연금'),
      }),
    ])
    // Slice 4a: 단일 provider라 지원 필드여도 ready가 아니라 needs_review로 저장한다.
    expect(result.profile.allowanceRules[0].status).toBe('needs_review')
    expect(result.sourceSummary.sources[0].sourceType).toBe('natural_language')
    expect(JSON.parse(result.sourceSummary.sources[0].aiProviderMetadata ?? '{}')).toMatchObject({
      mode: 'single_provider_fallback',
      consensusPending: true,
    })
    expect(result.sourceHash).toHaveLength(64)
  })

  it('지원되지 않는 출력필드는 needs_review로 둔다', async () => {
    const result = await transformNaturalLanguageToRuleDraft(
      baseInput,
      okAi([
        { displayName: '직책수당', category: 'allowance', targetField: '직책수당', formulaKind: 'fixed_amount', taxableTreatment: 'taxable', requiredInputs: [], sourceQuote: '직책별 정액' },
      ]),
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.profile.allowanceRules[0].status).toBe('needs_review')
  })

  it('단가x수량 회사 규칙과 법정 계산 근거를 formulaJson에 보존한다', async () => {
    const result = await transformNaturalLanguageToRuleDraft(
      { ...baseInput, naturalLanguage: '야근은 1일 10만원, 근무표 야근일수 기준. 야간근로는 법정 0.5배 확인.' },
      okAi([
        {
          displayName: '야근수당',
          category: 'allowance',
          targetField: 'night_work_allowance',
          formulaKind: 'unit_rate',
          formulaSummary: '야근 1일당 100000원 x 야근일수',
          basisType: 'company_rule',
          lawBasis: [],
          calculation: {
            expression: 'unitAmount * nightWorkDays',
            unitAmount: 100000,
            unit: 'day',
            quantityInputKey: 'nightWorkDays',
            multiplier: null,
            resultField: 'night_work_allowance',
          },
          amount: null,
          taxableTreatment: 'taxable',
          requiredInputs: ['nightWorkDays'],
          sourceQuote: '야근은 1일 10만원, 근무표 야근일수 기준',
        },
        {
          displayName: '야간근로 가산',
          category: 'allowance',
          targetField: 'night_work_allowance',
          formulaKind: 'hours_multiplier',
          formulaSummary: '통상시급 x 야간근로시간 x 0.5',
          basisType: 'statutory_default',
          lawBasis: [{ lawName: '근로기준법', article: '제56조', summary: '야간근로 가산임금' }],
          calculation: {
            expression: 'ordinaryHourlyWage * nightWorkHours * 0.5',
            unitAmount: null,
            unit: 'hour',
            quantityInputKey: 'nightWorkHours',
            multiplier: 0.5,
            resultField: 'night_work_allowance',
          },
          amount: null,
          taxableTreatment: 'taxable',
          requiredInputs: ['ordinaryHourlyWage', 'nightWorkHours'],
          sourceQuote: '야간근로는 법정 0.5배',
        },
      ]),
    )

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.profile.allowanceRules).toHaveLength(2)
    expect(result.profile.allowanceRules[0].formulaKind).toBe('unit_rate')
    expect(result.profile.allowanceRules[0].formulaJson).toMatchObject({
      basisType: 'company_rule',
      amount: null,
      calculation: {
        expression: 'unitAmount * nightWorkDays',
        unitAmount: 100000,
        unit: 'day',
        quantityInputKey: 'nightWorkDays',
      },
    })
    expect(result.profile.allowanceRules[1].formulaJson).toMatchObject({
      basisType: 'statutory_default',
      lawBasis: [{ lawName: '근로기준법', article: '제56조', summary: '야간근로 가산임금' }],
      calculation: {
        expression: 'ordinaryHourlyWage * nightWorkHours * 0.5',
        quantityInputKey: 'nightWorkHours',
        multiplier: 0.5,
      },
    })
    // 구조화는 보존하지만 Slice 4a 단일 provider 산출이므로 승인 전 자동 ready가 아니다.
    expect(result.profile.allowanceRules.every((rule) => rule.status === 'needs_review')).toBe(true)
  })

  it('AI 실패 시 failed', async () => {
    const result = await transformNaturalLanguageToRuleDraft(baseInput, vi.fn(async () => ({ success: false as const, error: 'AI 오류' })))
    expect(result).toEqual({ status: 'failed', error: 'AI 오류' })
  })

  it('규칙이 0건이면 failed', async () => {
    const result = await transformNaturalLanguageToRuleDraft(baseInput, okAi([]))
    expect(result.status).toBe('failed')
  })

  it('더존 지급 항목이 없고 공제만 있으면 draft를 만들지 않는다', async () => {
    const result = await transformNaturalLanguageToRuleDraft(
      { ...baseInput, naturalLanguage: '국민연금은 공단 고지액으로 처리' },
      okAi([
        { displayName: '국민연금', category: 'insurance', targetField: '국민연금', formulaKind: 'manual_input', taxableTreatment: 'unknown', requiredInputs: ['공단 고지액'], sourceQuote: '공단 고지액' },
      ]),
    )
    expect(result).toEqual({
      status: 'failed',
      error: '더존 지급(F~T) 항목으로 변환할 수 있는 급여 규칙을 찾지 못했습니다',
    })
  })

  it('민감정보가 셀에 섞여 들어와도 저장 전 마스킹한다', async () => {
    const result = await transformNaturalLanguageToRuleDraft(
      baseInput,
      okAi([
        { displayName: '식대', category: 'allowance', targetField: 'meal_allowance', formulaKind: 'fixed_amount', taxableTreatment: 'non_taxable', requiredInputs: [], sourceQuote: '담당자 010-1234-5678 확인' },
      ]),
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.profile.allowanceRules[0].sourceCitations[0].reference).toBe('담당자 [민감정보] 확인')
  })
})

describe('ruleTransformResponseSchema', () => {
  it('알 수 없는 enum은 fail closed', () => {
    const bad = { rules: [{ displayName: '식대', category: 'bonus_pay', targetField: 'meal_allowance', formulaKind: 'fixed_amount', taxableTreatment: 'non_taxable' }] }
    expect(ruleTransformResponseSchema.safeParse(bad).success).toBe(false)
  })
})

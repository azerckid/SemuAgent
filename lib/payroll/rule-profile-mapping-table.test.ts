import { describe, expect, it } from 'vitest'
import {
  buildPayrollRuleProfileDraftFromMappingTable,
  sanitizeSensitiveText,
  type CreatePayrollRuleMappingDraftInput,
} from './rule-profile-mapping-table'

function validInput(overrides: Partial<CreatePayrollRuleMappingDraftInput> = {}): CreatePayrollRuleMappingDraftInput {
  return {
    effectiveFrom: '2026-06',
    effectiveTo: null,
    sourceLabel: '테스트 매핑표',
    mappingText: [
      '항목명,분류,출력필드,과세,비과세한도,계산종류,계산값,필요입력,출처',
      '식대,수당,meal_allowance,비과세,200000,수기입력,직원별 지급액,직원별 지급액,임금규정 p.3',
      '국민연금,보험,national_pension,미정,,수기입력,공단 고지액,공단 고지액,매핑표',
    ].join('\n'),
    ...overrides,
  }
}

describe('buildPayrollRuleProfileDraftFromMappingTable', () => {
  it('builds a draft payroll rule profile without AI', () => {
    const result = buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput(),
    })

    expect(result.securityLane).toBe('normal')
    expect(result.sourceSummary.sources).toEqual([
      expect.objectContaining({ sourceType: 'mapping_table', securityLane: 'normal' }),
    ])
    expect(result.profile).toMatchObject({
      clientId: 'client-1',
      effectiveFrom: '2026-06',
      sourcePriority: ['mapping_table', 'statutory_default'],
    })
    expect(result.profile.allowanceRules).toHaveLength(1)
    expect(result.profile.deductionRules).toHaveLength(0)
    expect(result.profile.allowanceRules[0]).toMatchObject({
      displayName: '식대',
      targetField: 'meal_allowance',
      taxableTreatment: 'non_taxable',
      status: 'ready',
    })
    expect(result.profile.taxabilityRules[0]).toMatchObject({
      targetField: 'meal_allowance',
      nonTaxableLimit: 200000,
    })
    expect(result.profile.conflictItems).toEqual([
      expect.objectContaining({
        ruleId: 'mapping-2',
        kind: 'other',
        detail: expect.stringContaining('국민연금'),
      }),
    ])
  })

  it('fails closed when required headers are missing', () => {
    expect(() => buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,과세,계산종류',
          '식대,수당,비과세,수기입력',
        ].join('\n'),
      }),
    })).toThrow('필수 헤더가 없습니다: 출력필드')
  })

  it('fails closed when no data rows exist', () => {
    expect(() => buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: '항목명,분류,출력필드,과세,계산종류\n',
      }),
    })).toThrow('매핑표에는 헤더와 최소 1개 데이터 행이 필요합니다')
  })

  it('marks unsupported target fields as needs_review', () => {
    const result = buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,출력필드,과세,계산종류',
          '특별수당,수당,client_custom_bonus,과세,수기입력',
        ].join('\n'),
      }),
    })

    expect(result.profile.allowanceRules[0]).toMatchObject({
      targetField: 'client_custom_bonus',
      status: 'needs_review',
    })
    expect(result.profile.taxabilityRules[0]).toMatchObject({
      note: '출력필드 매핑 검토필요',
    })
  })

  it('excludes deduction/tax/insurance rows from the Duzon upload profile', () => {
    const result = buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,출력필드,과세,계산종류',
          '식대,수당,meal_allowance,비과세,수기입력',
          '건강보험,보험,health_insurance,미정,수기입력',
          '소득세,세금,income_tax,미정,수기입력',
        ].join('\n'),
      }),
    })

    expect(result.profile.allowanceRules.map((rule) => rule.displayName)).toEqual(['식대'])
    expect(result.profile.deductionRules).toHaveLength(0)
    expect(result.profile.taxabilityRules.map((rule) => rule.targetField)).toEqual(['meal_allowance'])
    expect(result.profile.conflictItems).toHaveLength(2)
    expect(result.profile.conflictItems.map((item) => item.detail).join('\n')).toContain('더존 업로드 제외')
  })

  it('fails when the mapping table has no Duzon earning rules', () => {
    expect(() => buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,출력필드,과세,계산종류',
          '국민연금,보험,national_pension,미정,수기입력',
        ].join('\n'),
      }),
    })).toThrow('더존 지급(F~T) 항목으로 변환할 수 있는 규칙이 없습니다')
  })

  it('uses tab-delimited tables pasted from spreadsheets', () => {
    const result = buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명\t분류\t출력필드\t과세\t계산종류',
          '교통비\t수당\t교통비(퇴불)\t과세\t수기입력',
        ].join('\n'),
      }),
    })

    expect(result.profile.allowanceRules[0]).toMatchObject({
      targetField: 'transportation_allowance',
      status: 'ready',
    })
  })

  it('classifies sensitive-looking mapping text as tee_required and masks stored fields', () => {
    const result = buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,출력필드,과세,계산종류,계산값',
          '식대,수당,meal_allowance,비과세,수기입력,담당자 010-1234-5678 확인',
        ].join('\n'),
      }),
    })

    expect(result.securityLane).toBe('tee_required')
    expect(result.profile.allowanceRules[0]?.formulaJson).toEqual({
      raw: '담당자 [민감정보] 확인',
      nonTaxableLimit: null,
    })
  })

  it('fails closed on unsupported enum values', () => {
    expect(() => buildPayrollRuleProfileDraftFromMappingTable({
      clientId: 'client-1',
      input: validInput({
        mappingText: [
          '항목명,분류,출력필드,과세,계산종류',
          '식대,봉급류,meal_allowance,비과세,수기입력',
        ].join('\n'),
      }),
    })).toThrow()
  })
})

describe('sanitizeSensitiveText', () => {
  it('마스킹: 주민번호·휴대폰·이메일을 [민감정보]로 가린다(에러 메시지 노출 방지)', () => {
    expect(sanitizeSensitiveText('과세 값이 지원되지 않습니다: 871010-1234567')).toBe(
      '과세 값이 지원되지 않습니다: [민감정보]',
    )
    expect(sanitizeSensitiveText('연락처 010-1234-5678')).toBe('연락처 [민감정보]')
    expect(sanitizeSensitiveText('정상 메시지')).toBe('정상 메시지')
  })
})

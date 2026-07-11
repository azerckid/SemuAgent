import { describe, expect, it } from 'vitest'
import { lookupSimplifiedIncomeTax } from './simplified-tax-table'

// 값은 소득세법 시행령 별표2 조견표의 실제 공표 세액과 1:1 대조한다.
describe('lookupSimplifiedIncomeTax (별표2 직접 조회)', () => {
  it('공표 세액을 급여구간·공제대상가족수로 그대로 조회한다', () => {
    // 월 240만원 · 1명 → 32,380원
    expect(lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 2_400_000, dependentCount: 1 }))
      .toMatchObject({ inRange: true, incomeTaxKrw: 32_380 })
    // 월 300만원 · 1명 → 74,350원
    expect(lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 3_000_000, dependentCount: 1 }))
      .toMatchObject({ inRange: true, incomeTaxKrw: 74_350 })
    // 월 600만원 · 4명 → 376,970원
    expect(lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 6_000_000, dependentCount: 4 }))
      .toMatchObject({ inRange: true, incomeTaxKrw: 376_970 })
  })

  it('공제대상가족수가 늘면 같은 급여라도 세액이 줄어든다', () => {
    const one = lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 4_400_000, dependentCount: 1 })
    const three = lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 4_400_000, dependentCount: 3 })
    if (!one.inRange || !three.inRange) throw new Error('in range expected')
    expect(one.incomeTaxKrw).toBe(249_360)
    expect(three.incomeTaxKrw).toBe(158_490)
    expect(three.incomeTaxKrw).toBeLessThan(one.incomeTaxKrw)
  })

  it('지방소득세는 소득세의 10%를 원단위 절사한다', () => {
    const result = lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 6_000_000, dependentCount: 4 })
    if (!result.inRange) throw new Error('in range expected')
    expect(result.localIncomeTaxKrw).toBe(37_690)
  })

  it('80% 선택 시 표 세액의 80%를 10원 단위로 절사한다', () => {
    const result = lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 3_000_000, dependentCount: 1, withholdingRatePercent: 80 })
    if (!result.inRange) throw new Error('in range expected')
    // 74,350 × 0.8 = 59,480
    expect(result.incomeTaxKrw).toBe(59_480)
  })

  it('8~20세 자녀공제를 표 세액에서 차감한다(2명 → 29,160원)', () => {
    const result = lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 3_600_000, dependentCount: 4, childCountUnder20: 2 })
    if (!result.inRange) throw new Error('in range expected')
    // 4명 세액 57,160 − 29,160 = 28,000
    expect(result.baseTaxKrw).toBe(57_160)
    expect(result.childDeductionKrw).toBe(29_160)
    expect(result.incomeTaxKrw).toBe(28_000)
  })

  it('표 범위 밖 급여는 임의 추정하지 않고 inRange:false를 반환한다', () => {
    expect(lookupSimplifiedIncomeTax({ monthlyTaxableSalaryKrw: 9_000_000, dependentCount: 1 }))
      .toEqual({ inRange: false })
  })
})

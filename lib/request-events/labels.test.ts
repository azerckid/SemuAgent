import { describe, expect, it } from 'vitest'
import { getRequestEventCadenceLabel, getRequestEventDetailedCadenceLabel } from './labels'

describe('getRequestEventCadenceLabel', () => {
  it('payroll 요청은 frequency와 무관하게 정기로 표시한다', () => {
    expect(getRequestEventCadenceLabel({ requestKind: 'payroll', frequency: 'custom' })).toBe('정기')
    expect(getRequestEventCadenceLabel({ requestKind: 'payroll', frequency: 'monthly' })).toBe('정기')
  })

  it('일반 custom 요청은 비정기로 표시한다', () => {
    expect(getRequestEventCadenceLabel({ requestKind: 'general', frequency: 'custom' })).toBe('비정기')
  })

  it('일반 반복 요청은 정기로 표시한다', () => {
    expect(getRequestEventCadenceLabel({ requestKind: 'general', frequency: 'monthly' })).toBe('정기')
    expect(getRequestEventCadenceLabel({ requestKind: null, frequency: 'quarterly' })).toBe('정기')
  })
})

describe('getRequestEventDetailedCadenceLabel', () => {
  it('payroll 요청은 frequency와 무관하게 정기로 표시한다', () => {
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'payroll', frequency: 'monthly' })).toBe('정기')
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'payroll', frequency: 'custom' })).toBe('정기')
  })

  it('일반 반복 요청은 frequency별 세분화 라벨로 표시한다', () => {
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'monthly' })).toBe('월별')
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'quarterly' })).toBe('분기별')
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'semiannual' })).toBe('반기별')
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'annual' })).toBe('연간')
  })

  it('일반 custom 요청은 비정기로 표시한다', () => {
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'custom' })).toBe('비정기')
    expect(getRequestEventDetailedCadenceLabel({ requestKind: null, frequency: 'custom' })).toBe('비정기')
  })

  it('알 수 없는 frequency 값은 원본 문자열을 그대로 반환한다', () => {
    expect(getRequestEventDetailedCadenceLabel({ requestKind: 'general', frequency: 'unknown' })).toBe('unknown')
  })
})

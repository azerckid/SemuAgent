import { describe, expect, it } from 'vitest'
import { evaluateReclassificationCandidate } from './reclassification-evidence'

const EMPLOYEES = ['김대표', '이수민', '박지훈', '최민준']

describe('evaluateReclassificationCandidate (JC-041 VAI-9a v2, Brief 51 §4)', () => {
  it('참석자 전원이 내부 직원과 일치하면 높음(high) 등급, 복리후생비를 제안한다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '팀 회식',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민', '박지훈'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 320_000,
    })
    expect(result.confidence).toBe('high')
    expect(result.suggestedCategory).toBe('welfare_expense')
    expect(result.factors.some((f) => f.type === 'attendees_all_internal' && f.direction === 'supports')).toBe(true)
  })

  it('내부 행사 키워드만 있으면 중간(medium) 등급, 회의비를 제안한다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '팀 미팅 다과비',
      counterpartyName: '○○카페',
      attendeeNames: null,
      amountKrw: 45_000,
    })
    expect(result.confidence).toBe('medium')
    expect(result.suggestedCategory).toBe('meeting_expense')
  })

  it('참석자 정보가 없어도(null) 후보 자체는 낮음(low) 등급으로 계속 보여준다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '식대',
      attendeeNames: null,
      amountKrw: 150_000,
    })
    expect(result.confidence).toBe('low')
    expect(result.factors.some((f) => f.type === 'attendees_unknown')).toBe(true)
    expect(result.missingToConfirm).toContain('참석자 명단(전원 내부 직원인지 확인)')
  })

  it('외부 거래처 표현이 있어도 후보를 없애지 않고 등급만 낮춘다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '거래처 접대',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 320_000,
    })
    // attendees_all_internal(+2) - external_counterparty_named(-1) = +1 => medium
    expect(result.confidence).toBe('medium')
    expect(result.factors.some((f) => f.type === 'external_counterparty_named')).toBe(true)
  })

  it('내부 직함(대표·이사·팀장)은 외부 신호로 쓰지 않는다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '김대표님과 팀 회식',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 320_000,
    })
    expect(result.factors.some((f) => f.type === 'external_counterparty_named')).toBe(false)
    expect(result.confidence).toBe('high')
  })

  it('거래처명이 법인 형태(주식회사 등)면 감산 요인이 되지만 후보는 유지된다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '식사',
      counterpartyName: '주식회사 글로벌테크',
      attendeeNames: ['김대표'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 100_000,
    })
    expect(result.factors.some((f) => f.type === 'external_counterparty_named')).toBe(true)
    expect(result.confidence).not.toBe(undefined)
  })

  it('금액이 소액 식대 상한선을 넘으면 감점되지만 후보는 유지된다', () => {
    const result = evaluateReclassificationCandidate({
      // 내부 행사 키워드('회식' 등)를 의도적으로 피해 large_amount 요인만 격리한다.
      memoText: '식대',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 900_000,
    })
    // attendees_all_internal(+2) - large_amount(-1) = +1 => medium (여전히 후보)
    expect(result.confidence).toBe('medium')
    expect(result.factors.some((f) => f.type === 'large_amount')).toBe(true)
    expect(result.missingToConfirm).toContain('고액 지출의 업무 목적 소명 자료')
  })

  it('과거 접대비 유지 이력은 참고 신호로만 감점하고 후보를 없애지 않는다', () => {
    const result = evaluateReclassificationCandidate({
      // 내부 행사 키워드('회식' 등)를 의도적으로 피해
      // historical_pattern_entertainment 요인만 격리한다.
      memoText: '식대',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 280_000,
      pastUserDecisionForSimilarPattern: 'kept_as_entertainment',
    })
    // attendees_all_internal(+2) - historical_pattern_entertainment(-1) = +1 => medium
    expect(result.confidence).toBe('medium')
    expect(result.factors.some((f) => f.type === 'historical_pattern_entertainment')).toBe(true)
  })

  it('가산 요인이 하나도 없으면 suggestedCategory는 null이지만 등급은 여전히 매긴다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '식대',
      attendeeNames: ['정하늘'], // 명단에 없는 이름 -> 전원 내부 아님
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 80_000,
    })
    expect(result.suggestedCategory).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('모든 결과에 적격증빙 확인이 확정 필요 자료로 포함된다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '팀 회식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 280_000,
    })
    expect(result.missingToConfirm).toContain('적격증빙 확인 및 사용자 최종 확정')
  })

  it('참석자 중 일부가 명단에 없으면(외부인 포함) 전원 내부 가산 요인을 인정하지 않는다', () => {
    const result = evaluateReclassificationCandidate({
      memoText: '식대',
      attendeeNames: ['김대표', '외부인A'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 80_000,
    })
    expect(result.factors.some((f) => f.type === 'attendees_all_internal')).toBe(false)
  })
})

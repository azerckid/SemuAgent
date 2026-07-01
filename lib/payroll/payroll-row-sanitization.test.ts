import { describe, expect, it } from 'vitest'
import {
  parseStatedHeadcount,
  resolvePayrollStoredVerdict,
  sanitizePayrollExtractedRows,
} from './payroll-row-sanitization'

describe('parseStatedHeadcount', () => {
  it('"인원 : 6" / "총 인원 6명" / "6명"에서 인원수를 파싱한다', () => {
    expect(parseStatedHeadcount('인원 : 6')).toBe(6)
    expect(parseStatedHeadcount('총 인원 6명')).toBe(6)
    expect(parseStatedHeadcount('6명')).toBe(6)
  })

  it('인원수 표기가 없으면 null', () => {
    expect(parseStatedHeadcount('권충원')).toBeNull()
    expect(parseStatedHeadcount(null)).toBeNull()
  })
})

describe('sanitizePayrollExtractedRows — L3 needs_review 강등', () => {
  it('식별 정보가 없는 행은 삭제하지 않고 needs_review로 강등한다', () => {
    const { rows } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: '권충원', baseSalary: 5_000_000 },
      { employeeCode: null, employeeName: null, baseSalary: 1_234_000 },
    ])
    expect(rows).toHaveLength(2) // 삭제하지 않는다
    expect(rows[0].reviewReason).toBeNull()
    expect(rows[1].reviewReason).toContain('식별 정보')
  })

  it('식별이 약한 행(성명 없음)이 기본급 합과 일치하면 needs_review로 강등한다', () => {
    const { rows } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: '권충원', baseSalary: 5_000_000 },
      { employeeCode: '2', employeeName: '김은주', baseSalary: 2_740_000 },
      // 사원코드는 있으나 성명이 비어 식별이 약하고, 금액은 두 명의 합
      { employeeCode: '3', employeeName: null, baseSalary: 7_740_000 },
    ])
    const sumRow = rows.find((entry) => entry.row.employeeCode === '3')
    expect(sumRow?.reviewReason).toContain('합계 행')
  })

  // 리뷰 P2: 정상 사원코드+사원명을 모두 갖춘 실제 직원은 산술 일치만으로 강등하지 않는다.
  // (A 200 + B 200 = C 400이어도 C가 실제 직원이면 막으면 안 됨 — draft 생성 차단 방지)
  it('정상 식별(사원코드+사원명) 직원은 기본급 합과 일치해도 강등하지 않는다', () => {
    const { rows } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: '직원A', baseSalary: 2_000_000 },
      { employeeCode: '2', employeeName: '직원B', baseSalary: 2_000_000 },
      { employeeCode: '3', employeeName: '직원C', baseSalary: 4_000_000 },
    ])
    expect(rows.every((entry) => entry.reviewReason === null)).toBe(true)
  })

  it('실제 직원 1명만 있으면(합 기여자 부족) 합계-일치 강등을 하지 않는다', () => {
    const { rows } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: null, baseSalary: 5_000_000 },
      { employeeCode: '2', employeeName: null, baseSalary: 5_000_000 },
    ])
    // 식별이 약해도 합 기여자가 1명뿐이라 합계행으로 보지 않는다
    const byCode = rows.find((entry) => entry.row.employeeCode === '1')
    expect(byCode?.reviewReason).toBeNull()
  })
})

describe('sanitizePayrollExtractedRows — L4 인원수 교차검증', () => {
  it('원본 인원수와 실제 직원 수가 다르면 모순 warning을 낸다', () => {
    const { warnings } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: '권충원', baseSalary: 5_000_000 },
      { employeeCode: '2', employeeName: '김은주', baseSalary: 2_740_000 },
      { employeeCode: '인원 : 6', employeeName: null, baseSalary: 7_740_000 },
    ])
    expect(warnings.some((w) => w.includes('6명') && w.includes('2명'))).toBe(true)
  })

  it('인원수가 일치하면 모순 warning을 내지 않는다', () => {
    const { warnings } = sanitizePayrollExtractedRows([
      { employeeCode: '1', employeeName: '권충원', baseSalary: 5_000_000 },
      { employeeCode: '2', employeeName: '김은주', baseSalary: 2_740_000 },
      { employeeCode: '인원 : 2', employeeName: null, baseSalary: 7_740_000 },
    ])
    expect(warnings.some((w) => w.includes('적혀 있으나'))).toBe(false)
  })
})

// e2e 성격: 11.50.21 PM 디와이 원본 표를 AI가 추출했을 때의 행 모양 그대로를
// 추출 서비스가 저장하는 경로(정제 → 최종 판정)와 동일한 코드로 통과시켜
// 결과를 검증한다. (mock 단위 검증만으로는 파이프라인 버그를 놓친다는 원칙)
describe('디와이 원본 시나리오 — 추출→정제→저장 판정', () => {
  const extracted = [
    { employeeCode: '1', employeeName: '권충원', baseSalary: 5_000_000, aiVerdict: 'pass' as const },
    { employeeCode: '2', employeeName: '김은주', baseSalary: 2_740_000, aiVerdict: 'pass' as const },
    // 표 하단 합계행 — 성명 칸이 "인원 : 6", 금액은 두 직원의 합
    { employeeCode: '인원 : 6', employeeName: null, baseSalary: 7_740_000, aiVerdict: 'pass' as const },
  ]

  it('합계행은 저장 대상에서 빠지고, 실제 두 직원만 pass로 저장된다', () => {
    const { rows, removedSummaryRows, warnings } = sanitizePayrollExtractedRows(extracted)

    // 합계행은 L2로 완전히 제거되어 저장 대상에 없다
    expect(removedSummaryRows).toHaveLength(1)
    expect(removedSummaryRows[0].employeeCode).toBe('인원 : 6')
    expect(rows.map((entry) => entry.row.employeeName)).toEqual(['권충원', '김은주'])

    // 저장될 최종 판정(서비스와 동일한 헬퍼)
    const stored = rows.map((entry) => ({
      name: entry.row.employeeName,
      ...resolvePayrollStoredVerdict(entry.row, entry.reviewReason),
    }))
    expect(stored).toEqual([
      { name: '권충원', aiVerdict: 'pass', aiVerdictReason: null },
      { name: '김은주', aiVerdict: 'pass', aiVerdictReason: null },
    ])

    // 원본 모순(인원 6 vs 실제 2)은 warning으로 표면화된다
    expect(warnings.some((w) => w.includes('6명') && w.includes('2명'))).toBe(true)
  })
})

describe('resolvePayrollStoredVerdict', () => {
  it('강등 사유가 있으면 AI 판정과 무관하게 fail로 덮어쓴다', () => {
    expect(resolvePayrollStoredVerdict({ aiVerdict: 'pass' }, '합계 행으로 의심')).toEqual({
      aiVerdict: 'fail',
      aiVerdictReason: '합계 행으로 의심',
    })
  })

  it('강등 사유가 없으면 AI 판정을 유지한다', () => {
    expect(resolvePayrollStoredVerdict({ aiVerdict: 'pass' }, null)).toEqual({
      aiVerdict: 'pass',
      aiVerdictReason: null,
    })
  })

  it('aiVerdict가 없으면 high confidence만 pass로 인정한다', () => {
    expect(resolvePayrollStoredVerdict({ confidence: 'high' }, null).aiVerdict).toBe('pass')
    expect(resolvePayrollStoredVerdict({ confidence: 'low' }, null).aiVerdict).toBe('fail')
  })
})

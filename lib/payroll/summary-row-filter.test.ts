import { describe, expect, it } from 'vitest'
import {
  buildPayrollSummaryRowsWarning,
  isPayrollSummaryRow,
  splitPayrollSummaryRows,
} from './summary-row-filter'

describe('isPayrollSummaryRow', () => {
  it('사원코드 칸의 "인원 : 6" 합계행을 집계 행으로 식별한다', () => {
    expect(isPayrollSummaryRow({ employeeCode: '인원 : 6', employeeName: null })).toBe(true)
  })

  it('필드 전체가 집계 라벨이면 식별한다', () => {
    for (const label of ['합계', '총 계', '소계', '누계', '평균', '총인원', '인원수', '계']) {
      expect(isPayrollSummaryRow({ employeeName: label })).toBe(true)
    }
  })

  it('라벨 뒤 인원수 표기(": 6", "6명")가 붙어도 식별한다', () => {
    expect(isPayrollSummaryRow({ employeeCode: '총 인원 6명' })).toBe(true)
    expect(isPayrollSummaryRow({ employeeName: '인원: 12' })).toBe(true)
    expect(isPayrollSummaryRow({ employeeName: '계 6명' })).toBe(true)
  })

  it('영문 total/subtotal/average 행을 식별한다', () => {
    for (const label of ['Total', 'Sub Total', 'AVERAGE']) {
      expect(isPayrollSummaryRow({ employeeName: label })).toBe(true)
    }
  })

  it('사원코드/사원명 중 한쪽만 라벨이어도 식별한다', () => {
    expect(isPayrollSummaryRow({ employeeCode: '1', employeeName: '합계' })).toBe(true)
  })

  // 반대 방향 데이터 손실 방지: 라벨 단어를 포함하는 실제 직원명은 지우지 않는다.
  it('라벨 단어를 포함하는 실제 직원명은 집계 행으로 보지 않는다', () => {
    expect(isPayrollSummaryRow({ employeeCode: '1', employeeName: '김인원' })).toBe(false)
    expect(isPayrollSummaryRow({ employeeName: '인원관리' })).toBe(false)
    expect(isPayrollSummaryRow({ employeeName: '계영수' })).toBe(false)
    expect(isPayrollSummaryRow({ employeeName: '권충원' })).toBe(false)
    expect(isPayrollSummaryRow({ employeeName: '김은주' })).toBe(false)
  })

  it('식별 칸이 비어 있으면 집계 행으로 보지 않는다', () => {
    expect(isPayrollSummaryRow({ employeeCode: null, employeeName: null })).toBe(false)
    expect(isPayrollSummaryRow({ employeeCode: '', employeeName: '   ' })).toBe(false)
  })

  it('순수 사원코드 숫자는 집계 행으로 보지 않는다', () => {
    expect(isPayrollSummaryRow({ employeeCode: '6', employeeName: null })).toBe(false)
  })
})

describe('splitPayrollSummaryRows', () => {
  it('직원 행과 집계 행을 분리한다', () => {
    const rows = [
      { employeeCode: '1', employeeName: '권충원' },
      { employeeCode: '2', employeeName: '김은주' },
      { employeeCode: '인원 : 6', employeeName: null },
    ]
    const { employeeRows, summaryRows } = splitPayrollSummaryRows(rows)
    expect(employeeRows.map((r) => r.employeeName)).toEqual(['권충원', '김은주'])
    expect(summaryRows).toHaveLength(1)
    expect(summaryRows[0].employeeCode).toBe('인원 : 6')
  })
})

describe('buildPayrollSummaryRowsWarning', () => {
  it('제외 행이 없으면 null을 반환한다', () => {
    expect(buildPayrollSummaryRowsWarning([])).toBeNull()
  })

  it('제외 행과 라벨을 문구로 만든다', () => {
    const warning = buildPayrollSummaryRowsWarning([{ employeeCode: '인원 : 6' }, { employeeName: '합계' }])
    expect(warning).toContain('2건')
    expect(warning).toContain('인원 : 6')
    expect(warning).toContain('합계')
  })
})

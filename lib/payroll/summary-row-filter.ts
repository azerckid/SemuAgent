export type PayrollIdentityRow = {
  employeeCode?: string | null
  employeeName?: string | null
}

/**
 * 합계/소계/총계/누계/평균/인원/계 같은 집계·요약 행을 식별한다.
 *
 * 원본 급여표 하단의 합계행(예: 사원코드 칸에 "인원 : 6", "합계")이 개별
 * 직원으로 잘못 추출되어 row 수·실지급액 합계·다운로드 엑셀을 오염시키는
 * 것을 막기 위한 결정적 방어선이다.
 *
 * 중요: 부분 문자열이 아니라 "필드 전체가 집계 라벨 형태"일 때만 매칭한다.
 * 급여 데이터에서는 잘못 넣는 것만큼 실제 직원을 지우는 것도 위험하므로,
 * "김인원"처럼 라벨 단어를 포함하는 실제 직원명은 절대 제외하지 않는다.
 * 라벨 뒤의 인원수 표기(": 6", "6명")는 같은 행으로 인정한다.
 * 부서/직급은 검사하지 않고 식별 칸(사원코드·사원명)만 본다.
 */
const SUMMARY_LABEL_PATTERN =
  /^(합계|총계|소계|누계|평균|총인원|인원수|인원|계|subtotal|total|average|headcount)([:：]?\d+명?)?$/i

function isSummaryLabel(value: string | null | undefined): boolean {
  const compact = (value ?? '').replace(/\s+/g, '')
  if (!compact) return false
  return SUMMARY_LABEL_PATTERN.test(compact)
}

export function isPayrollSummaryRow(row: PayrollIdentityRow): boolean {
  return isSummaryLabel(row.employeeCode) || isSummaryLabel(row.employeeName)
}

export function splitPayrollSummaryRows<T extends PayrollIdentityRow>(
  rows: T[],
): { employeeRows: T[]; summaryRows: T[] } {
  const employeeRows: T[] = []
  const summaryRows: T[] = []
  for (const row of rows) {
    if (isPayrollSummaryRow(row)) summaryRows.push(row)
    else employeeRows.push(row)
  }
  return { employeeRows, summaryRows }
}

/**
 * 제외된 집계 행을 담당자에게 알릴 warning 문구를 만든다. 제외 행이 없으면
 * null을 반환한다.
 */
export function buildPayrollSummaryRowsWarning(summaryRows: PayrollIdentityRow[]): string | null {
  if (summaryRows.length === 0) return null
  const labels = summaryRows
    .map((row) => (row.employeeCode ?? row.employeeName ?? '').trim())
    .filter((label) => label.length > 0)
    .slice(0, 8)
  const labelText = labels.length > 0 ? ` (${labels.join(', ')})` : ''
  return `합계·인원 등 집계 행 ${summaryRows.length}건을 직원에서 제외했습니다${labelText}.`
}

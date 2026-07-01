import {
  buildPayrollSummaryRowsWarning,
  splitPayrollSummaryRows,
  type PayrollIdentityRow,
} from './summary-row-filter'

/**
 * 급여 추출 행 정제(sanitization) — 고객사 자료의 합계·이상 행이 직원으로
 * 흘러드는 것을 막는 근본 대책. 방어 계층:
 *
 * - L2 (summary-row-filter): 식별칸이 합계/인원/계 같은 "라벨형 집계행"이면
 *   직원에서 완전히 제외(삭제). 가장 확실한 케이스만 조용히 제거한다.
 * - L3 (이 파일): 라벨이 없어도 구조적으로 의심되는 행은 삭제하지 않고
 *   needs_review(부적합)로 강등한다. 출력(미리보기·다운로드)에서는 빠지되
 *   담당자에게는 사유와 함께 보인다. 실제 직원을 잘못 지우는 반대 방향
 *   데이터 손실을 피하기 위함이다.
 * - L4 (이 파일): 원본에 명시된 인원수("인원 : 6")와 실제 추출 직원 수가
 *   다르면 자료 자체의 모순을 warning으로 표면화한다. 조용히 넘기지 않는다.
 */

export type PayrollSanitizableRow = PayrollIdentityRow & {
  baseSalary?: number | null
}

export type SanitizedPayrollRow<T> = {
  row: T
  // needs_review 강등 사유. null이면 AI 판정을 그대로 사용한다.
  reviewReason: string | null
}

export type PayrollRowSanitization<T> = {
  rows: SanitizedPayrollRow<T>[]
  removedSummaryRows: T[]
  warnings: string[]
}

function hasNoIdentity(row: PayrollIdentityRow): boolean {
  const code = (row.employeeCode ?? '').trim()
  const name = (row.employeeName ?? '').trim()
  return code === '' && name === ''
}

/** 사원코드와 사원명을 둘 다 갖춘 행은 정상 식별 직원으로 본다. */
function hasStrongIdentity(row: PayrollIdentityRow): boolean {
  return (row.employeeCode ?? '').trim() !== '' && (row.employeeName ?? '').trim() !== ''
}

/**
 * 기본급이 다른 직원들(2명 이상)의 합과 정확히 일치하면 합계 행으로 의심한다.
 * 단, 산술 일치만으로 정상 직원을 강등하면 draft 생성이 통째로 막히므로
 * (A 200 + B 200 = C 400인 실제 직원 C), 이 신호는 "식별이 약한 행"에만
 * 적용한다. 호출부에서 hasStrongIdentity로 게이트한다.
 * 보수적으로 needs_review로만 강등하며 삭제하지 않는다.
 */
function isBaseSalarySumRow(row: PayrollSanitizableRow, others: PayrollSanitizableRow[]): boolean {
  if (typeof row.baseSalary !== 'number' || row.baseSalary <= 0) return false
  const contributors = others.filter(
    (other) => typeof other.baseSalary === 'number' && other.baseSalary > 0,
  )
  if (contributors.length < 2) return false
  const sum = contributors.reduce((acc, other) => acc + (other.baseSalary as number), 0)
  return sum === row.baseSalary
}

const HEADCOUNT_PATTERN = /(?:총\s*인원|인원)\s*[:：]?\s*(\d+)|(\d+)\s*명/

/** "인원 : 6", "총 인원 6명", "6명" 등에서 명시 인원수를 파싱한다. */
export function parseStatedHeadcount(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.replace(/\s+/g, ' ').match(HEADCOUNT_PATTERN)
  if (!match) return null
  const count = Number(match[1] ?? match[2])
  return Number.isFinite(count) ? count : null
}

export function sanitizePayrollExtractedRows<T extends PayrollSanitizableRow>(
  extractedRows: T[],
): PayrollRowSanitization<T> {
  // L2: 라벨형 집계행은 직원에서 완전 제외
  const { employeeRows, summaryRows } = splitPayrollSummaryRows(extractedRows)

  // L3: 남은 행 중 구조적 이상행은 needs_review로 강등(삭제 아님)
  const rows: SanitizedPayrollRow<T>[] = employeeRows.map((row, index) => {
    const others = employeeRows.filter((_, otherIndex) => otherIndex !== index)
    let reviewReason: string | null = null
    if (hasNoIdentity(row)) {
      reviewReason = '직원 식별 정보(사원번호·성명)가 없어 합계·요약 행으로 의심됩니다. 원본을 확인하세요.'
    } else if (!hasStrongIdentity(row) && isBaseSalarySumRow(row, others)) {
      // 정상 사원코드+사원명 행은 산술 일치만으로는 강등하지 않는다(오탐 방지).
      reviewReason = '식별 정보가 불완전하고 기본급이 다른 직원들의 합과 일치해 합계 행으로 의심됩니다. 원본을 확인하세요.'
    }
    return { row, reviewReason }
  })

  const warnings: string[] = []
  const summaryWarning = buildPayrollSummaryRowsWarning(summaryRows)
  if (summaryWarning) warnings.push(summaryWarning)

  // L4: 원본 명시 인원수 vs 실제(강등되지 않은) 직원 수 교차검증
  const genuineCount = rows.filter((entry) => entry.reviewReason === null).length
  const statedHeadcount = summaryRows
    .map((row) => parseStatedHeadcount(row.employeeCode) ?? parseStatedHeadcount(row.employeeName))
    .find((count): count is number => count !== null) ?? null
  if (statedHeadcount !== null && statedHeadcount !== genuineCount) {
    warnings.push(
      `원본에는 인원이 ${statedHeadcount}명으로 적혀 있으나 실제 추출된 직원은 ${genuineCount}명입니다. 자료가 누락·왜곡되지 않았는지 확인하세요.`,
    )
  }

  return { rows, removedSummaryRows: summaryRows, warnings }
}

type StoredVerdictInput = {
  aiVerdict?: 'pass' | 'fail' | null
  confidence?: 'high' | 'medium' | 'low' | 'unknown' | null
  aiVerdictReason?: string | null
}

/**
 * 한 행이 DB에 저장될 최종 aiVerdict/사유를 계산한다. 추출 서비스의 저장
 * 경로와 테스트가 동일한 로직을 쓰도록 분리했다. needs_review 강등 사유가
 * 있으면 AI 판정과 무관하게 fail로 덮어쓴다.
 */
export function resolvePayrollStoredVerdict(
  row: StoredVerdictInput,
  reviewReason: string | null,
): { aiVerdict: 'pass' | 'fail'; aiVerdictReason: string | null } {
  if (reviewReason) {
    return { aiVerdict: 'fail', aiVerdictReason: reviewReason }
  }
  const baseVerdict = row.aiVerdict ?? (row.confidence === 'high' ? 'pass' : 'fail')
  return {
    aiVerdict: baseVerdict,
    aiVerdictReason:
      row.aiVerdictReason ??
      (baseVerdict === 'pass' ? null : 'AI 신뢰도가 낮거나 자료 온전성 확인이 필요합니다'),
  }
}

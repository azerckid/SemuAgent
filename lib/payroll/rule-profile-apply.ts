import type { ClientPayrollRuleProfileV1, PayrollRuleItem } from '@/lib/validations/payroll-rule-profile'
import type { PayrollExtractedRow } from '@/lib/validations/payroll'

/**
 * 승인된 고객사 급여기준 프로필 → 월 급여 추출 행에 결정론적으로 적용한다.
 *
 * 목적: 사내규정이 정한 지급 항목(F~T)을 규정대로 채운다. AI 재호출 없이 코드로만
 * 실행한다. v1 적용 범위는 보수적으로 고정한다:
 *
 *  - `fixed_amount`(정액) 규칙만 자동 적용한다. 예) "식대 전원 20만" → 해당 칸에 20만.
 *  - `unit_rate`·`rate`·`hours_multiplier`·`table_lookup` 등 변동 항목은 이번 달 직원별 입력
 *    (근무시간 등)이 있어야 계산되므로 자동으로 채우지 않고 검토 대상으로 남긴다.
 *  - 이미 값이 있는데 규정 정액과 다르면 덮어쓰지 않고 충돌로 표시한다(데이터 보존).
 *  - 프로필이 없으면 이 함수는 호출되지 않으며 기존 동작이 그대로 유지된다.
 *
 * 순수 함수다(DB 접근 없음). 엔진 연결·스냅샷 저장은 호출부의 책임이다.
 */

/** 더존 지급 필드(snake_case) → 추출 행 필드(camelCase) 매핑. gross_pay(U)는 합계라 제외. */
const TARGET_FIELD_TO_ROW_FIELD = {
  base_salary: 'baseSalary',
  bonus: 'bonus',
  meal_allowance: 'mealAllowance',
  transportation_allowance: 'transportationAllowance',
  holiday_work_allowance: 'holidayWorkAllowance',
  domestic_travel_allowance: 'domesticTravelAllowance',
  annual_leave_allowance: 'annualLeaveAllowance',
  rnd_allowance: 'rndAllowance',
  other_allowance: 'otherAllowance',
  performance_incentive: 'performanceIncentive',
  night_work_allowance: 'nightWorkAllowance',
  vehicle_maintenance_allowance: 'vehicleMaintenanceAllowance',
  retroactive_pay: 'retroactivePay',
  overtime_allowance: 'overtimeAllowance',
  childcare_allowance: 'childcareAllowance',
} as const satisfies Record<string, keyof PayrollExtractedRow>

type FillableTargetField = keyof typeof TARGET_FIELD_TO_ROW_FIELD

export type SkippedRuleReason =
  | 'non_fixed_formula' // 변동 항목 — 직원별 입력 필요
  | 'missing_amount' // fixed_amount인데 실행 가능한 금액이 없음
  | 'unsupported_field' // 더존 지급(F~T) 칸으로 매핑 불가
  | 'excluded_status' // conflict/excluded 상태

export type SkippedRule = {
  displayName: string
  targetField: string
  reason: SkippedRuleReason
}

export type RuleApplicationConflict = {
  employeeIndex: number
  targetField: string
  ruleAmount: number
  existingAmount: number
}

export type ApplyRuleProfileResult = {
  rows: PayrollExtractedRow[]
  /** 규정으로 실제 채운 (행, 칸) 수. */
  filledCount: number
  /** 규정 정액과 데이터가 달라 덮어쓰지 않은 충돌. */
  conflicts: RuleApplicationConflict[]
  /** 자동 적용하지 않은 규칙(변동·미매핑 등). 담당자 검토 대상. */
  skippedRules: SkippedRule[]
  /** 실제 채운 지급 필드(중복 제거, snake_case). 스냅샷·표시용. */
  appliedFields: FillableTargetField[]
  /** 이번 실행에 적용된 정액 규칙 근거(직원 원자료 없음). 스냅샷 감사용. */
  appliedRules: Array<{ targetField: FillableTargetField; displayName: string; amount: number }>
  warnings: string[]
}

/** 충돌 행에 붙일 검토 사유 문구. */
export function buildConflictReviewReason(conflict: RuleApplicationConflict): string {
  return `승인된 급여기준과 업로드 금액이 다릅니다(${conflict.targetField}): 규정 ${conflict.ruleAmount}원 / 데이터 ${conflict.existingAmount}원. 확인이 필요합니다.`
}

/**
 * 승인 규칙 금액과 데이터가 충돌한 행에 검토 사유를 단다(in-place). 사유가 달리면
 * 저장 시 aiVerdict가 fail로 강등돼 결과 엑셀 안전 게이트(전 행 pass)가 막는다.
 * 기존 검토 사유가 있으면 보존한다(덮어쓰지 않음).
 */
export function markConflictRowsForReview<T extends { reviewReason: string | null }>(
  sanitizedRows: T[],
  conflicts: RuleApplicationConflict[],
): void {
  for (const conflict of conflicts) {
    const target = sanitizedRows[conflict.employeeIndex]
    if (target && !target.reviewReason) {
      target.reviewReason = buildConflictReviewReason(conflict)
    }
  }
}

/** formulaJson에서 실행 가능한 정액 금액을 방어적으로 읽는다. 없으면 null. */
function readFixedAmount(formulaJson: unknown): number | null {
  if (!formulaJson || typeof formulaJson !== 'object') return null
  const value = (formulaJson as { amount?: unknown }).amount
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

type ExecutableRule = {
  rule: PayrollRuleItem
  targetField: FillableTargetField
  rowField: keyof PayrollExtractedRow
  amount: number
}

/**
 * 승인된 프로필의 지급 규칙을 추출 행에 적용한다. 입력 rows는 변경하지 않고
 * 새 배열을 반환한다(불변).
 */
export function applyClientPayrollRuleProfileToRows(params: {
  profile: ClientPayrollRuleProfileV1
  rows: PayrollExtractedRow[]
}): ApplyRuleProfileResult {
  const { profile, rows } = params

  const executable: ExecutableRule[] = []
  const skippedRules: SkippedRule[] = []

  for (const rule of profile.allowanceRules) {
    if (rule.status === 'conflict' || rule.status === 'excluded') {
      skippedRules.push({ displayName: rule.displayName, targetField: rule.targetField, reason: 'excluded_status' })
      continue
    }
    const rowField = (TARGET_FIELD_TO_ROW_FIELD as Record<string, keyof PayrollExtractedRow>)[rule.targetField]
    if (!rowField) {
      skippedRules.push({ displayName: rule.displayName, targetField: rule.targetField, reason: 'unsupported_field' })
      continue
    }
    if (rule.formulaKind !== 'fixed_amount') {
      // 변동 항목: 직원별 입력이 있어야 계산 가능 → 자동 적용하지 않는다.
      skippedRules.push({ displayName: rule.displayName, targetField: rule.targetField, reason: 'non_fixed_formula' })
      continue
    }
    const amount = readFixedAmount(rule.formulaJson)
    if (amount === null) {
      skippedRules.push({ displayName: rule.displayName, targetField: rule.targetField, reason: 'missing_amount' })
      continue
    }
    executable.push({ rule, targetField: rule.targetField as FillableTargetField, rowField, amount })
  }

  const conflicts: RuleApplicationConflict[] = []
  const appliedFieldSet = new Set<FillableTargetField>()
  let filledCount = 0

  const nextRows = rows.map((row, employeeIndex) => {
    let nextRow = row
    for (const { targetField, rowField, amount } of executable) {
      const existing = row[rowField]
      if (existing === null || existing === undefined) {
        // 빈 칸: 규정 정액으로 채운다.
        if (nextRow === row) nextRow = { ...row }
        ;(nextRow as Record<string, unknown>)[rowField] = amount
        filledCount += 1
        appliedFieldSet.add(targetField)
      } else if (typeof existing === 'number' && existing !== amount) {
        // 데이터에 다른 값이 이미 있음: 덮어쓰지 않고 충돌로 남긴다.
        conflicts.push({ employeeIndex, targetField, ruleAmount: amount, existingAmount: existing })
      }
      // existing === amount: 이미 일치 → 변경 없음.
    }
    return nextRow
  })

  const warnings: string[] = []
  if (conflicts.length > 0) {
    const fields = [...new Set(conflicts.map((c) => c.targetField))].join(', ')
    warnings.push(
      `승인된 급여기준과 업로드 데이터의 금액이 달라 ${conflicts.length}건은 규정으로 덮어쓰지 않았습니다(검토 필요): ${fields}`,
    )
  }
  const nonFixedSkips = skippedRules.filter((s) => s.reason === 'non_fixed_formula')
  if (nonFixedSkips.length > 0) {
    warnings.push(
      `변동 계산 규칙 ${nonFixedSkips.length}건은 직원별 입력이 필요해 자동 적용하지 않았습니다: ${nonFixedSkips
        .map((s) => s.displayName)
        .join(', ')}`,
    )
  }

  return {
    rows: nextRows,
    filledCount,
    conflicts,
    skippedRules,
    appliedFields: [...appliedFieldSet],
    appliedRules: executable.map(({ targetField, rule, amount }) => ({
      targetField,
      displayName: rule.displayName,
      amount,
    })),
    warnings,
  }
}

import {
  clientPayrollRuleProfileV1Schema,
  type ClientPayrollRuleProfileV1,
  type PayrollRuleItem,
} from '@/lib/validations/payroll-rule-profile'

/** yyyy-MM 기간 겹침 여부. effectiveTo가 null이면 무제한. */
export function effectivePeriodsOverlap(
  aFrom: string,
  aTo: string | null | undefined,
  bFrom: string,
  bTo: string | null | undefined,
): boolean {
  const aEnd = aTo ?? '9999-12'
  const bEnd = bTo ?? '9999-12'
  return aFrom <= bEnd && bFrom <= aEnd
}

export function countConflictRows(profile: ClientPayrollRuleProfileV1): number {
  return [...profile.allowanceRules, ...profile.deductionRules].filter(
    (rule) => rule.status === 'conflict',
  ).length
}

/** row conflict + profile.conflictItems(더존 F~T 밖 규칙 등) — 승인 차단 기준. */
export function countApprovalBlockingConflicts(profile: ClientPayrollRuleProfileV1): number {
  return countConflictRows(profile) + profile.conflictItems.length
}

export function countNeedsReviewRows(profile: ClientPayrollRuleProfileV1): number {
  return [...profile.allowanceRules, ...profile.deductionRules].filter(
    (rule) => rule.status === 'needs_review',
  ).length
}

function promoteRuleStatusForApproval(status: PayrollRuleItem['status']): PayrollRuleItem['status'] {
  if (status === 'needs_review') return 'ready'
  return status
}

export type NormalizeForApprovalResult =
  | { ok: true; profile: ClientPayrollRuleProfileV1 }
  | { ok: false; code: 'conflict_rows' | 'invalid_profile'; message: string }

/**
 * 승인 시 profile JSON을 active 기준으로 정규화한다.
 * - conflict row 또는 conflictItems가 있으면 거부
 * - needs_review row는 ready로 승격 (excluded/conflict/ready는 유지)
 * - effective period를 승인 입력값으로 갱신
 */
export function normalizeProfileForApproval(
  profile: ClientPayrollRuleProfileV1,
  effectiveFrom: string,
  effectiveTo?: string | null,
): NormalizeForApprovalResult {
  const conflictCount = countApprovalBlockingConflicts(profile)
  if (conflictCount > 0) {
    return {
      ok: false,
      code: 'conflict_rows',
      message: `미해결 충돌·범위외 항목 ${conflictCount}건이 있어 승인할 수 없습니다`,
    }
  }

  const promote = (rule: PayrollRuleItem): PayrollRuleItem => ({
    ...rule,
    status: promoteRuleStatusForApproval(rule.status),
  })

  const normalized: ClientPayrollRuleProfileV1 = {
    ...profile,
    effectiveFrom,
    effectiveTo: effectiveTo ?? undefined,
    allowanceRules: profile.allowanceRules.map(promote),
    deductionRules: profile.deductionRules.map(promote),
    approvalChecklist: {
      sourcesReviewed: true,
      mappingReviewed: true,
      formulasReviewed: true,
      statutoryReviewed: profile.approvalChecklist.statutoryReviewed,
    },
  }

  const parsed = clientPayrollRuleProfileV1Schema.safeParse(normalized)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid_profile',
      message: '승인된 프로필 형식 검증에 실패했습니다',
    }
  }

  return { ok: true, profile: parsed.data }
}

// 급여대장 4대보험 정합성 교차검증.
//
// 고용형태(jobType)를 단일 기준으로, 급여 라인에 실제로 부과된 4대보험 금액이
// 그 고용형태에서 기대되는 적용 범위와 어긋나는지 확인한다. 직원명부의 4대보험
// 표기도 같은 jobType에서 유래하므로(lib/employee-directory/summary.ts), 이 검증이
// 통과하면 직원명부-급여 두 화면의 4대보험 표시가 서로 어긋나지 않는다.
//
// 기대 범위(근로자 부담 기준):
// - 정규직: 국민연금 + 건강보험 + 장기요양 + 고용보험 전부 적용
// - 일용직: 고용보험(+산재)만 적용, 국민연금·건강보험·장기요양 비적용
// - 프리랜서(사업소득): 근로자 4대보험 비적용(3.3% 원천징수만)
//
// 이 함수는 판정만 하며 DB write나 금액 수정은 하지 않는다(읽기 전용 가드).

export type PayrollConsistencyIssue = {
  employeeLineId: string
  employeeName: string
  jobType: string | null
  message: string
}

type ConsistencyInput = {
  id: string
  displayName: string
  jobType: string | null
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
}

export function detectPayrollInsuranceConsistencyIssues(
  rows: readonly ConsistencyInput[],
): PayrollConsistencyIssue[] {
  const issues: PayrollConsistencyIssue[] = []

  for (const row of rows) {
    const hasNationalPension = row.nationalPensionKrw > 0
    const hasHealth = row.healthInsuranceKrw > 0
    const hasLongTermCare = row.longTermCareKrw > 0
    const hasEmployment = row.employmentInsuranceKrw > 0
    const hasCareerInsurance = hasNationalPension || hasHealth || hasLongTermCare
    const base = { employeeLineId: row.id, employeeName: row.displayName, jobType: row.jobType }

    if (row.jobType === '정규직') {
      if (!hasNationalPension || !hasHealth || !hasEmployment) {
        issues.push({ ...base, message: '정규직인데 4대보험(국민연금·건강보험·고용보험) 일부가 0원입니다.' })
      }
      continue
    }

    if (row.jobType === '일용직') {
      if (hasCareerInsurance) {
        issues.push({ ...base, message: '일용직인데 국민연금·건강보험이 부과되었습니다(고용보험만 대상).' })
      } else if (!hasEmployment) {
        issues.push({ ...base, message: '일용직인데 고용보험이 0원입니다.' })
      }
      continue
    }

    if (row.jobType === '프리랜서') {
      if (hasCareerInsurance || hasEmployment) {
        issues.push({ ...base, message: '프리랜서(사업소득)인데 4대보험이 부과되었습니다.' })
      }
      continue
    }
  }

  return issues
}

import type { SimplifiedStatus } from '@/lib/payment-statements/summary'

export type ValidationRuleId =
  | 'V-01'
  | 'V-02'
  | 'V-03'
  | 'V-04'
  | 'V-05'
  | 'V-06'
  | 'V-07'
  | 'V-08'
  | 'V-09'
  | 'V-10'
  | 'V-11'

export type ValidationSeverity = 'error' | 'warn'

export type ValidationIssue = {
  ruleId: ValidationRuleId
  severity: ValidationSeverity
  message: string
  employeeKey?: string
}

export type SubmitterKind = 'corporation' | 'individual'

/** C레코드 1건 — 1인·1근로기간 */
export type SimplifiedWageEmployeeSegment = {
  employeeKey: string
  employeeName: string
  simplifiedStatus: SimplifiedStatus
  residentId: string | null
  workPeriodStart: string // yyyyMMdd
  workPeriodEnd: string // yyyyMMdd
  grossPayKrw: number
  recognizedBonusKrw: number
  /** V-11: 반기 월별 gross 합과 C14 대조 */
  monthlyGrossPayKrw: Record<string, number>
  phone?: string
  isForeignNational?: boolean
}

export type BuildSimplifiedWageInput = {
  year: number
  half: 1 | 2
  submittedOn: string // yyyyMMdd
  taxOfficeCode: string
  submitterKind: SubmitterKind
  businessRegistrationNumber: string
  businessName: string
  representativeName: string
  /** B8 — 법인등록번호 또는 개인사업자 주민번호 (일회성) */
  obligorRegistrationId: string
  contactDepartment: string
  contactName: string
  contactPhone: string
  hometaxId?: string
  employees: SimplifiedWageEmployeeSegment[]
  /** 반기 중 급여 period_summary 누락 월 (YYYY-MM) */
  missingPayrollMonths?: string[]
}

export type BuildSimplifiedWageSuccess = {
  ok: true
  fileName: string
  records: Buffer[]
}

export type BuildSimplifiedWageFailure = {
  ok: false
  issues: ValidationIssue[]
}

export type BuildSimplifiedWageResult = BuildSimplifiedWageSuccess | BuildSimplifiedWageFailure

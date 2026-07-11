export type WithholdingValidationRuleId =
  | 'W-V-01'
  | 'W-V-02'
  | 'W-V-03'
  | 'W-V-04'
  | 'W-V-05'

export type ValidationSeverity = 'error' | 'warn'

export type ValidationIssue = {
  ruleId: WithholdingValidationRuleId
  severity: ValidationSeverity
  message: string
  employeeKey?: string
}

export type WithholdingPayrollLine = {
  employeeKey: string
  employeeName: string
  grossPayKrw: number
  incomeTaxKrw: number
  status: 'ready' | 'needs_review' | 'closed'
}

export type WithholdingFormA01 = {
  employeeCount: number
  grossPayKrw: number
  incomeTaxKrw: number
}

export type ValidateWithholdingPanelInput = {
  payrollPeriodKey: string
  closeStatus: 'open' | 'blocked' | 'closed'
  periodEmployeeCount: number
  periodGrossPayKrw: number
  confirmedEmployeeCount: number
  confirmedGrossPayKrw: number
  confirmedIncomeTaxKrw: number
  // 참고용(A01 서식 밖) — 원천세 특별징수분 지방소득세. JC-027과 동일 소스.
  localIncomeTaxKrw: number
  guideEmployeeCount: number
  guideGrossPayKrw: number
  guideIncomeTaxKrw: number
  businessRegistrationNumber: string
  businessName: string
  representativeName: string
  lines: WithholdingPayrollLine[]
}

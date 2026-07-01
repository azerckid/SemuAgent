import type { PayrollExtractedRow } from '@/lib/validations/payroll'

export type WageStatementItemStatus = 'calculated' | 'no_data'

export type WageStatementAmountItem = {
  key: string
  label: string
  amount: number | null
  status: WageStatementItemStatus
  formula: string
  sourceField: keyof PayrollExtractedRow | null
}

export type WageStatementBasisItem = {
  key: string
  label: string
  value: string | number | null
  status: WageStatementItemStatus
  description: string
}

export type WageStatementDraft = {
  kind: 'wage_statement_draft'
  status: 'draft'
  companyName: string | null
  payrollPeriod: string
  paymentDate: string | null
  employee: {
    code: string | null
    name: string | null
    department: string | null
    jobTitle: string | null
    jobType: string | null
  }
  summary: {
    grossPay: number | null
    deductionTotal: number | null
    netPay: number | null
  }
  workBasisItems: WageStatementBasisItem[]
  earningItems: WageStatementAmountItem[]
  deductionItems: WageStatementAmountItem[]
  missingItems: string[]
  notes: string[]
}

type WageStatementDraftInput = {
  row: PayrollExtractedRow
  payrollPeriod: string
  companyName?: string | null
  paymentDate?: string | null
}

type AmountFieldDefinition = {
  key: string
  label: string
  sourceField: keyof PayrollExtractedRow
  formula: string
}

const earningFieldDefinitions: AmountFieldDefinition[] = [
  { key: 'baseSalary', label: '기본급', sourceField: 'baseSalary', formula: '급여대장 row 기본급' },
  { key: 'bonus', label: '상여', sourceField: 'bonus', formula: '상여/성과급 지급자료' },
  { key: 'mealAllowance', label: '식대', sourceField: 'mealAllowance', formula: '식대 지급자료 또는 비과세 지급자료' },
  { key: 'transportationAllowance', label: '교통비', sourceField: 'transportationAllowance', formula: '교통비 지급자료 또는 비과세 지급자료' },
  { key: 'holidayWorkAllowance', label: '휴일/주말근무수당', sourceField: 'holidayWorkAllowance', formula: '통상시급 x 휴일/주말근무시간 x 기본 가산율' },
  { key: 'annualLeaveAllowance', label: '연차수당', sourceField: 'annualLeaveAllowance', formula: '1일 통상임금 x 미사용 연차일수' },
  { key: 'nightWorkAllowance', label: '야간근무수당', sourceField: 'nightWorkAllowance', formula: '통상시급 x 야간근무시간 x 0.5' },
  { key: 'domesticTravelAllowance', label: '국내출장수당', sourceField: 'domesticTravelAllowance', formula: '출장/여비 지급자료' },
  { key: 'rndAllowance', label: '연구개발비', sourceField: 'rndAllowance', formula: '연구개발비 지급자료' },
  { key: 'otherAllowance', label: '기타수당', sourceField: 'otherAllowance', formula: '전용 출력 컬럼이 없는 기타 지급항목 합계' },
  { key: 'performanceIncentive', label: '성과인센티브', sourceField: 'performanceIncentive', formula: '성과급/인센티브 지급자료' },
  { key: 'overtimeAllowance', label: '연장근무수당', sourceField: 'overtimeAllowance', formula: '통상시급 x 연장근로시간 x 1.5 또는 고정연장수당' },
  { key: 'vehicleMaintenanceAllowance', label: '차량유지비', sourceField: 'vehicleMaintenanceAllowance', formula: '차량유지비/자가운전보조금 지급자료' },
  { key: 'retroactivePay', label: '급여인상분 소급적용', sourceField: 'retroactivePay', formula: '급여인상 소급분 지급자료' },
  { key: 'childcareAllowance', label: '보육수당', sourceField: 'childcareAllowance', formula: '보육/육아수당 지급자료' },
]

const deductionFieldDefinitions: AmountFieldDefinition[] = [
  { key: 'nationalPension', label: '국민연금', sourceField: 'nationalPension', formula: '기준보수월액 x 국민연금 근로자 요율' },
  { key: 'healthInsurance', label: '건강보험', sourceField: 'healthInsurance', formula: '기준보수월액 x 건강보험 근로자 요율' },
  { key: 'longTermCare', label: '장기요양', sourceField: 'longTermCare', formula: '건강보험료 x 장기요양 요율' },
  { key: 'employmentInsurance', label: '고용보험', sourceField: 'employmentInsurance', formula: '기준보수월액 x 고용보험 근로자 요율' },
  { key: 'incomeTax', label: '소득세', sourceField: 'incomeTax', formula: '직원별 원천징수세액 또는 간이세액 기준자료' },
  { key: 'localIncomeTax', label: '지방소득세', sourceField: 'localIncomeTax', formula: '지방소득세 금액 또는 소득세 x 지방소득세 비율' },
  { key: 'otherDeduction', label: '기타공제', sourceField: 'otherDeduction', formula: '기타 공제 내역' },
  { key: 'deductionAmount', label: '공제합계', sourceField: 'deductionAmount', formula: '계산 가능한 세금/4대보험/공제 합계' },
]

function moneyItem(row: PayrollExtractedRow, definition: AmountFieldDefinition): WageStatementAmountItem {
  const amount = row[definition.sourceField]
  const calculatedAmount = typeof amount === 'number' ? amount : null

  return {
    key: definition.key,
    label: definition.label,
    amount: calculatedAmount,
    status: calculatedAmount == null ? 'no_data' : 'calculated',
    formula: definition.formula,
    sourceField: definition.sourceField,
  }
}

function basisItem(
  key: string,
  label: string,
  value: string | number | null | undefined,
  description: string,
): WageStatementBasisItem {
  const normalizedValue = typeof value === 'string' ? value.trim() : value
  const hasValue = normalizedValue !== '' && normalizedValue != null

  return {
    key,
    label,
    value: hasValue ? normalizedValue : null,
    status: hasValue ? 'calculated' : 'no_data',
    description,
  }
}

function sumCalculated(items: WageStatementAmountItem[]): number | null {
  const calculatedItems = items.filter((item) => item.status === 'calculated')
  if (calculatedItems.length === 0) return null
  return calculatedItems.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

function noDataLabels(items: Array<WageStatementAmountItem | WageStatementBasisItem>): string[] {
  return items
    .filter((item) => item.status === 'no_data')
    .map((item) => item.label)
}

export function buildWageStatementDraft({
  row,
  payrollPeriod,
  companyName = null,
  paymentDate = null,
}: WageStatementDraftInput): WageStatementDraft {
  const workBasisItems = [
    basisItem('employeeName', '근로자 성명', row.employeeName, '급여대장 row 근로자명'),
    basisItem('employeeCode', '사번/직원코드', row.employeeCode, '급여대장 row 직원 식별값'),
    basisItem('department', '부서', row.department, '직원 기본정보'),
    basisItem('jobTitle', '직급', row.jobTitle, '직원 기본정보'),
    basisItem('jobType', '고용형태/직종', row.jobType, '직원 기본정보'),
    basisItem('workingDays', '근로일수', null, '근태 원자료'),
    basisItem('regularHours', '소정근로시간', null, '임금 기준자료'),
    basisItem('overtimeHours', '연장근로시간', null, '근태/변동자료'),
    basisItem('nightHours', '야간근로시간', null, '근태/변동자료'),
    basisItem('holidayHours', '휴일/주말근로시간', null, '근태/변동자료'),
    basisItem('lateEarlyAbsence', '조퇴/지각/결근 시간', null, '근태/변동자료'),
    basisItem('unusedAnnualLeaveDays', '미사용 연차일수', null, '연차 자료'),
  ]
  const earningItems = earningFieldDefinitions.map((definition) => moneyItem(row, definition))
  const deductionItems = deductionFieldDefinitions.map((definition) => moneyItem(row, definition))

  const grossPay = sumCalculated(earningItems)
  const deductionTotal = typeof row.deductionAmount === 'number'
    ? row.deductionAmount
    : sumCalculated(deductionItems.filter((item) => item.key !== 'deductionAmount'))
  const netPay = grossPay != null && deductionTotal != null ? grossPay - deductionTotal : null
  const missingItems = [
    ...noDataLabels(workBasisItems),
    ...noDataLabels(earningItems),
    ...noDataLabels(deductionItems),
  ]

  return {
    kind: 'wage_statement_draft',
    status: 'draft',
    companyName,
    payrollPeriod,
    paymentDate,
    employee: {
      code: row.employeeCode ?? null,
      name: row.employeeName ?? null,
      department: row.department ?? null,
      jobTitle: row.jobTitle ?? null,
      jobType: row.jobType ?? null,
    },
    summary: {
      grossPay,
      deductionTotal,
      netPay,
    },
    workBasisItems,
    earningItems,
    deductionItems,
    missingItems,
    notes: [
      '임금명세서는 급여대장 row를 기반으로 만든 내부 초안입니다.',
      '자료가 없는 항목은 0원으로 확정하지 않고 자료없음으로 표시합니다.',
      '근로자 교부/발송은 별도 확정 단계에서 다룹니다.',
    ],
  }
}

import {
  payrollAdaptiveModelContractSchema,
  type PayrollAdaptiveFieldDataType,
  type PayrollAdaptiveModelContract,
} from './adaptive-structuring-model-contract'
import {
  PAYROLL_ADAPTIVE_IDENTITY_TARGET_FIELDS,
  PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS,
  type PayrollAdaptiveStructuringProposalResponse,
  type PayrollAdaptiveTargetField,
} from './adaptive-structuring-proposal-schema'

const TARGET_FIELD_DATA_TYPE: Record<PayrollAdaptiveTargetField, PayrollAdaptiveFieldDataType> = {
  employeeCode: 'identifier',
  employeeName: 'text',
  department: 'text',
  jobTitle: 'text',
  residentOrInternalKey: 'identifier',
  payrollMonth: 'date',
  periodStart: 'date',
  periodEnd: 'date',
  paymentDate: 'date',
  baseSalary: 'amount',
  fixedAllowance: 'amount',
  monthlyFixedPay: 'amount',
  overtimeHours: 'amount',
  nightHours: 'amount',
  holidayHours: 'amount',
  annualLeaveDays: 'amount',
  bonus: 'amount',
  retroactivePay: 'amount',
  otherAllowance: 'amount',
  incomeTaxBasis: 'amount',
  localIncomeTaxBasis: 'amount',
  nationalPensionBasis: 'amount',
  healthInsuranceBasis: 'amount',
  employmentInsuranceBasis: 'amount',
  otherDeduction: 'amount',
  memo: 'memo',
  policyCandidate: 'memo',
  metadataCandidate: 'memo',
  resultOnlyCandidate: 'memo',
}

// AI 제안(Slice 2)에는 signature matching에 쓸 헤더 행 인덱스나 dataType이 없다.
// 엔진(Slice 3)이 실제로 실행할 수 있는 contract 형태로 결정론적으로 변환한다.
// 이 변환은 DB에 저장하지 않으며, 매 propose 호출마다 새로 만들어지는 일회성 preview용이다.
export function derivePayrollAdaptiveModelContractFromProposal(
  proposal: PayrollAdaptiveStructuringProposalResponse,
): PayrollAdaptiveModelContract | null {
  if (proposal.status !== 'proposal_ready') return null
  if (proposal.candidateSheets.length === 0 || proposal.proposedMappings.length === 0) return null

  const sheetNamePatterns = [...new Set(proposal.candidateSheets.map((sheet) => sheet.sheetName))]

  const identityAndPeriodMappings = proposal.proposedMappings.filter((mapping) => (
    PAYROLL_ADAPTIVE_IDENTITY_TARGET_FIELDS.includes(mapping.targetField) || PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS.includes(mapping.targetField)
  ))
  const requiredHeaderLabels = [...new Set(identityAndPeriodMappings.map((mapping) => mapping.sourceColumn))]
  if (requiredHeaderLabels.length === 0) return null

  const optionalHeaderLabels = [...new Set(
    proposal.proposedMappings
      .filter((mapping) => !identityAndPeriodMappings.includes(mapping))
      .map((mapping) => mapping.sourceColumn),
  )]

  const fieldMappings = proposal.proposedMappings.map((mapping) => ({
    sheetName: mapping.sheetName,
    sourceColumn: mapping.sourceColumn,
    targetField: mapping.targetField,
    required: mapping.required,
    dataType: TARGET_FIELD_DATA_TYPE[mapping.targetField],
  }))

  const hasIdentityMapping = fieldMappings.some((mapping) => PAYROLL_ADAPTIVE_IDENTITY_TARGET_FIELDS.includes(mapping.targetField))
  const hasPeriodMapping = fieldMappings.some((mapping) => PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS.includes(mapping.targetField))

  const validationRules = [
    ...(hasIdentityMapping ? [{
      type: 'at_least_one_of' as const,
      fields: PAYROLL_ADAPTIVE_IDENTITY_TARGET_FIELDS,
      message: '직원 식별자가 없으면 draft row를 생성하지 않습니다.',
    }] : []),
    ...(hasPeriodMapping ? [{
      type: 'at_least_one_of' as const,
      fields: PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS,
      message: '지급 기간 식별 항목이 없으면 draft row를 생성하지 않습니다.',
    }] : []),
  ]

  const contract = {
    targetWorkflow: 'payroll' as const,
    payrollModelType: proposal.candidateSheets[0]?.role ?? 'mixed_workbook',
    workbookSignature: {
      sheetNamePatterns,
      requiredHeaderLabels,
      optionalHeaderLabels,
      headerRowCandidates: [],
      payrollPeriodSignals: [],
    },
    fieldMappings,
    ignoredRegions: proposal.ignoredRegions,
    validationRules,
    outputMode: 'preview_only' as const,
  }

  const parsed = payrollAdaptiveModelContractSchema.safeParse(contract)
  return parsed.success ? parsed.data : null
}

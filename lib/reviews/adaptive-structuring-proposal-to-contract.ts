import {
  reviewAdaptiveModelContractSchema,
  type ReviewAdaptiveFieldDataType,
  type ReviewAdaptiveModelContract,
} from './adaptive-structuring-model-contract'
import {
  REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS,
  REVIEW_ADAPTIVE_DATE_TARGET_FIELDS,
  type ReviewAdaptiveStructuringProposalResponse,
  type ReviewAdaptiveTargetField,
} from './adaptive-structuring-proposal-schema'

const TARGET_FIELD_DATA_TYPE: Record<ReviewAdaptiveTargetField, ReviewAdaptiveFieldDataType> = {
  transactionDate: 'date',
  evidenceDate: 'date',
  counterparty: 'text',
  description: 'text',
  amountKrw: 'amount',
  incomeAmountKrw: 'amount',
  expenseAmountKrw: 'amount',
  memo: 'memo',
  policyCandidate: 'memo',
  metadataCandidate: 'memo',
  resultOnlyCandidate: 'memo',
}

// AI 제안(Slice 2)에는 signature matching에 쓸 헤더 행 인덱스나 dataType이 없다.
// 엔진(Slice 3)이 실제로 실행할 수 있는 contract 형태로 결정론적으로 변환한다.
// 이 변환은 DB에 저장하지 않으며, 매 propose 호출마다 새로 만들어지는 일회성 preview용이다.
export function deriveReviewAdaptiveModelContractFromProposal(
  proposal: ReviewAdaptiveStructuringProposalResponse,
): ReviewAdaptiveModelContract | null {
  if (proposal.status !== 'proposal_ready') return null
  if (proposal.candidateSheets.length === 0 || proposal.proposedMappings.length === 0) return null

  const sheetNamePatterns = [...new Set(proposal.candidateSheets.map((sheet) => sheet.sheetName))]

  const dateAndAmountMappings = proposal.proposedMappings.filter((mapping) => (
    REVIEW_ADAPTIVE_DATE_TARGET_FIELDS.includes(mapping.targetField) || REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS.includes(mapping.targetField)
  ))
  const requiredHeaderLabels = [...new Set(dateAndAmountMappings.map((mapping) => mapping.sourceColumn))]
  if (requiredHeaderLabels.length === 0) return null

  const optionalHeaderLabels = [...new Set(
    proposal.proposedMappings
      .filter((mapping) => !dateAndAmountMappings.includes(mapping))
      .map((mapping) => mapping.sourceColumn),
  )]

  const fieldMappings = proposal.proposedMappings.map((mapping) => ({
    sheetName: mapping.sheetName,
    sourceColumn: mapping.sourceColumn,
    targetField: mapping.targetField,
    required: mapping.required,
    dataType: TARGET_FIELD_DATA_TYPE[mapping.targetField],
  }))

  const hasDateMapping = fieldMappings.some((mapping) => REVIEW_ADAPTIVE_DATE_TARGET_FIELDS.includes(mapping.targetField))
  const hasAmountMapping = fieldMappings.some((mapping) => REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS.includes(mapping.targetField))

  const validationRules = [
    ...(hasDateMapping ? [{
      type: 'at_least_one_of' as const,
      fields: REVIEW_ADAPTIVE_DATE_TARGET_FIELDS,
      message: '거래일/증빙일이 없으면 draft row를 생성하지 않습니다.',
    }] : []),
    ...(hasAmountMapping ? [{
      type: 'at_least_one_of' as const,
      fields: REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS,
      message: '금액이 없으면 draft row를 생성하지 않습니다.',
    }] : []),
  ]

  const contract = {
    targetWorkflow: 'bookkeeping' as const,
    reviewModelType: proposal.candidateSheets[0]?.role ?? 'mixed_workbook',
    workbookSignature: {
      sheetNamePatterns,
      requiredHeaderLabels,
      optionalHeaderLabels,
      headerRowCandidates: [],
    },
    fieldMappings,
    ignoredRegions: proposal.ignoredRegions,
    validationRules,
    outputMode: 'preview_only' as const,
  }

  const parsed = reviewAdaptiveModelContractSchema.safeParse(contract)
  return parsed.success ? parsed.data : null
}

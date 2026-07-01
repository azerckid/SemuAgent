export type ReviewTone = 'default' | 'info' | 'success' | 'warning' | 'destructive'

export type ReviewFile = {
  id: string
  uploadSessionId: string
  originalFilename: string
  fileType: string
  fileSize: number
  status: string
  passwordStatus?: 'none' | 'required' | 'supplied' | 'invalid' | 'consumed' | 'not_needed'
  staffReviewStatus?: 'none' | 'excluded'
  staffReviewNote?: string | null
  staffReviewedAt?: string | null
  uploadedAt: string
}

export type ReviewValidation = {
  id: string
  uploadSessionId: string
  itemName: string
  itemGroup: string | null
  criterionType: 'material' | 'reconciliation' | 'format_check' | 'other' | null
  requiredness: string
  validationStatus: string
  reviewStatus: string
  aiReasoning: string | null
  requestedAction: string | null
  staffNote: string | null
  reviewedAt: string | null
}

export type ReviewValidationFile = {
  id: string
  validationId: string
  uploadFileId: string
  contribution: string | null
}

export type ReviewAnalysisRun = {
  id: string
  uploadFileId: string
  provider: string
  model: string
  confidence: string
  consensusGroup: string | null
  status: string
  parsedOutput: string | null
  errorMessage: string | null
  criteriaSummary: string | null
  createdAt: string
}

export type ReviewWorkType = 'bookkeeping' | 'vat' | 'payroll' | 'unknown'
export type ReviewBookkeepingPeriodType = 'monthly' | 'quarterly' | 'yearly'

export type ReviewMaterialAttributionDecision = 'include' | 'hold' | 'exclude_duplicate' | 'reference_only'

export type ReviewMaterialAttribution = {
  id: string
  uploadSessionId: string
  sourceKind: 'file_summary' | 'transaction_row'
  sourceLabel: string
  evidenceDate: string | null
  attributedPeriod: string | null
  requestedPeriod: string
  closePeriod: string
  periodRelation: 'requested' | 'prior' | 'future' | 'unknown'
  amountKrw: number | null
  counterparty: string | null
  description: string | null
  duplicateStatus: 'none' | 'possible_duplicate'
  duplicateBasis: string | null
  recommendation: ReviewMaterialAttributionDecision
  staffDecision: ReviewMaterialAttributionDecision | null
  staffNote: string | null
}

export type ReviewMaterialAttributionSummary = {
  requestedPeriod: string
  closePeriod: string
  total: number
  include: number
  hold: number
  excludeDuplicate: number
  referenceOnly: number
  prior: number
  future: number
  unknown: number
  possibleDuplicate: number
  requestedInPeriod: number
  inCloseWindow: number
  outOfScope: number
  inCloseWindowPeriods?: string[]
  outOfScopePeriods?: string[]
}

export type ReviewSession = {
  id: string
  clientId: string
  clientName: string
  clientEmail: string
  staffName: string | null
  accountingPeriod: string
  status: string
  hasSessionEvaluation: boolean
  expiresAt: string
  createdAt: string
  requestEmailSubject: string | null
  requestEmailBody: string | null
  source: 'customer_upload' | 'staff_direct'
  latestAnalysisAt: string | null
  workType: ReviewWorkType
  bookkeepingPeriodType: ReviewBookkeepingPeriodType | null
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
  files: ReviewFile[]
  validations: ReviewValidation[]
  validationFiles: ReviewValidationFile[]
  analysisRuns: ReviewAnalysisRun[]
  materialAttributions: ReviewMaterialAttribution[]
  materialAttributionSummary: ReviewMaterialAttributionSummary | null
  acceptedFiles: Array<{
    id: string
    originalFilename: string
    fileType: string
    fileSize: number
    uploadedAt: string
  }>
  counts: {
    satisfied: number
    missing: number
    nonCompliant: number
    partial: number
    uncertain: number
  }
  derivedStatus: {
    label: string
    detail: string
    tone: ReviewTone
  }
  completionKind: 'normal' | 'exception' | null
  // 고객이 업로드 포털에서 자료 항목에 직접 표시한 선언(없음/나중에 제출).
  // checklist_item_id 기준으로 저장되며 항목명은 로더에서 해소해 넣는다.
  // 담당자 확인용 신호이며 완료 판정을 자동으로 바꾸지 않는다.
  itemDeclarations?: ReviewItemDeclaration[]
}

export type ReviewItemDeclaration = {
  checklistItemId: string
  itemName: string
  declaration: 'none' | 'later'
  note: string | null
}

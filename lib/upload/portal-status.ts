import { buildReviewSubmissionPresentation } from '@/lib/reviews/review-submission-status'
import {
  defaultCriteriaForWorkType,
  inferGeneralDefaultCriteriaWorkType,
  type GeneralDefaultCriteriaWorkType,
} from '@/lib/review/default-criteria-data'
import type {
  ReviewAnalysisRun,
  ReviewBookkeepingPeriodType,
  ReviewFile,
  ReviewSession,
  ReviewValidation,
  ReviewValidationFile,
  ReviewWorkType,
} from '@/lib/reviews/review-workspace-types'

export type UploadPortalChecklistStatus = 'completed' | 'analyzing' | 'needs_review' | 'pending'

export interface UploadPortalChecklistItemInput {
  id: string
  name: string
  required: boolean
  canDeclare?: boolean
}

export interface UploadPortalFileInput {
  id: string
  uploadSessionId?: string
  originalFilename: string
  fileType?: string
  fileSize?: number
  status: string
  passwordStatus?: 'none' | 'required' | 'supplied' | 'invalid' | 'consumed' | 'not_needed'
  staffReviewStatus?: 'none' | 'excluded'
  staffReviewNote?: string | null
  staffReviewedAt?: string | null
  uploadedAt?: string
}

export interface UploadPortalMaterialMatchInput {
  uploadFileId: string
  checklistItemId: string
  status: string
}

export interface UploadPortalValidationInput {
  id: string
  uploadSessionId?: string
  itemName: string
  itemGroup?: string | null
  criterionType: string | null
  requiredness?: string
  validationStatus: string
  reviewStatus?: string
  aiReasoning?: string | null
  requestedAction?: string | null
  staffNote?: string | null
  reviewedAt?: string | null
}

export interface UploadPortalValidationFileInput {
  id?: string
  validationId: string
  uploadFileId: string
  contribution: string | null
}

export interface UploadPortalAnalysisRunInput {
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

export interface UploadPortalSessionInput {
  id: string
  clientId?: string
  clientName?: string
  clientEmail?: string
  staffName?: string | null
  accountingPeriod: string
  status: string
  hasSessionEvaluation?: boolean
  expiresAt?: string
  createdAt?: string
  requestEmailSubject?: string | null
  requestEmailBody?: string | null
  source?: 'customer_upload' | 'staff_direct'
  requestKind?: 'general' | 'payroll'
  bookkeepingPeriodType?: ReviewBookkeepingPeriodType | null
  bookkeepingPeriodStart?: string | null
  bookkeepingPeriodEnd?: string | null
}

export interface ResolvedUploadPortalChecklistItem extends UploadPortalChecklistItemInput {
  status: UploadPortalChecklistStatus
  matchedFilename?: string
}

export interface UploadPortalStatusResolution {
  checklistItems: ResolvedUploadPortalChecklistItem[]
  matchedItemNameByFileId: Map<string, string>
  unlinkedFileIds: Set<string>
}

const CONFIRMED_MATCH_STATUSES = new Set(['matched', 'manual_approved'])
const DISPLAY_LINK_CONTRIBUTIONS = new Set(['satisfied', 'partial'])

function formatPortalItemName(itemName: string) {
  return itemName
    .normalize('NFC')
    .trim()
    .split(':')[0]
    ?.trim()
    .replace(/\s*\((필수|선택|조건부|요청 항목|조건부 요청|참고 항목)\)\s*$/g, '')
    .trim() ?? itemName.trim()
}

function itemKey(itemName: string) {
  return formatPortalItemName(itemName).normalize('NFC').replace(/\s+/g, ' ').toLowerCase()
}

function isMaterialValidation(validation: UploadPortalValidationInput) {
  return validation.criterionType === 'material' || validation.criterionType === null
}

function inferPortalWorkType(params: {
  session: UploadPortalSessionInput
  validations: UploadPortalValidationInput[]
}): ReviewWorkType {
  if (params.session.requestKind === 'payroll') return 'payroll'
  if (params.session.bookkeepingPeriodType) return 'bookkeeping'

  const groups = new Set(params.validations.map((validation) => validation.itemGroup).filter(Boolean))
  if (
    groups.has('bank_statement') ||
    groups.has('card_statement') ||
    groups.has('online_sales_pg_settlement') ||
    groups.has('journal_entry_workbook')
  ) {
    return 'bookkeeping'
  }

  return 'unknown'
}

function toReviewFile(file: UploadPortalFileInput, sessionId: string): ReviewFile {
  return {
    id: file.id,
    uploadSessionId: file.uploadSessionId ?? sessionId,
    originalFilename: file.originalFilename,
    fileType: file.fileType ?? 'other',
    fileSize: file.fileSize ?? 0,
    status: file.status,
    passwordStatus: file.passwordStatus,
    staffReviewStatus: file.staffReviewStatus ?? 'none',
    staffReviewNote: file.staffReviewNote ?? null,
    staffReviewedAt: file.staffReviewedAt ?? null,
    uploadedAt: file.uploadedAt ?? '',
  }
}

function toReviewValidation(validation: UploadPortalValidationInput, sessionId: string): ReviewValidation {
  return {
    id: validation.id,
    uploadSessionId: validation.uploadSessionId ?? sessionId,
    itemName: validation.itemName,
    itemGroup: validation.itemGroup ?? null,
    criterionType: validation.criterionType as ReviewValidation['criterionType'],
    requiredness: validation.requiredness ?? 'required',
    validationStatus: validation.validationStatus,
    reviewStatus: validation.reviewStatus ?? 'ai_suggested',
    aiReasoning: validation.aiReasoning ?? null,
    requestedAction: validation.requestedAction ?? null,
    staffNote: validation.staffNote ?? null,
    reviewedAt: validation.reviewedAt ?? null,
  }
}

function toReviewValidationFile(link: UploadPortalValidationFileInput, index: number): ReviewValidationFile {
  return {
    id: link.id ?? `portal-validation-file-${index}`,
    validationId: link.validationId,
    uploadFileId: link.uploadFileId,
    contribution: link.contribution,
  }
}

function toReviewAnalysisRun(run: UploadPortalAnalysisRunInput): ReviewAnalysisRun {
  return {
    id: run.id,
    uploadFileId: run.uploadFileId,
    provider: run.provider,
    model: run.model,
    confidence: run.confidence,
    consensusGroup: run.consensusGroup,
    status: run.status,
    parsedOutput: run.parsedOutput,
    errorMessage: run.errorMessage,
    criteriaSummary: run.criteriaSummary,
    createdAt: run.createdAt,
  }
}

function buildPortalReviewSession(params: {
  session: UploadPortalSessionInput
  uploadedFiles: UploadPortalFileInput[]
  requestItemValidations: UploadPortalValidationInput[]
  requestItemValidationFiles: UploadPortalValidationFileInput[]
  analysisRuns: UploadPortalAnalysisRunInput[]
}): ReviewSession {
  const files = params.uploadedFiles.map((file) => toReviewFile(file, params.session.id))
  const validations = params.requestItemValidations.map((validation) => toReviewValidation(validation, params.session.id))
  const validationFiles = params.requestItemValidationFiles.map(toReviewValidationFile)

  return {
    id: params.session.id,
    clientId: params.session.clientId ?? '',
    clientName: params.session.clientName ?? '',
    clientEmail: params.session.clientEmail ?? '',
    staffName: params.session.staffName ?? null,
    accountingPeriod: params.session.accountingPeriod,
    status: params.session.status,
    hasSessionEvaluation: params.session.hasSessionEvaluation ?? false,
    expiresAt: params.session.expiresAt ?? '',
    createdAt: params.session.createdAt ?? '',
    requestEmailSubject: params.session.requestEmailSubject ?? null,
    requestEmailBody: params.session.requestEmailBody ?? null,
    source: params.session.source ?? 'customer_upload',
    latestAnalysisAt: [...params.analysisRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ?? null,
    workType: inferPortalWorkType({
      session: params.session,
      validations: params.requestItemValidations,
    }),
    bookkeepingPeriodType: params.session.bookkeepingPeriodType ?? null,
    bookkeepingPeriodStart: params.session.bookkeepingPeriodStart ?? null,
    bookkeepingPeriodEnd: params.session.bookkeepingPeriodEnd ?? null,
    files,
    validations,
    validationFiles,
    analysisRuns: params.analysisRuns.map(toReviewAnalysisRun),
    materialAttributions: [],
    materialAttributionSummary: null,
    acceptedFiles: [],
    counts: {
      satisfied: 0,
      missing: 0,
      nonCompliant: 0,
      partial: 0,
      uncertain: 0,
    },
    derivedStatus: {
      label: '제출 확인',
      detail: '',
      tone: 'info',
    },
    completionKind: null,
    itemDeclarations: [],
  }
}

function summarizeFilenames(files: UploadPortalFileInput[]) {
  if (files.length === 0) return undefined
  if (files.length === 1) return files[0]?.originalFilename
  const [first, ...rest] = files
  return `${first.originalFilename} 외 ${rest.length}개`
}

function buildFallbackChecklistItemsFromValidations(
  validations: UploadPortalValidationInput[],
): UploadPortalChecklistItemInput[] {
  const seen = new Set<string>()
  const items: UploadPortalChecklistItemInput[] = []

  for (const validation of validations.filter(isMaterialValidation)) {
    const key = itemKey(validation.itemName)
    if (seen.has(key)) continue
    seen.add(key)
    items.push({
      id: `validation:${validation.id}`,
      name: formatPortalItemName(validation.itemName),
      required: validation.requiredness !== 'optional',
      canDeclare: false,
    })
  }

  return items
}

function inferDefaultCriteriaWorkType(params: {
  session: UploadPortalSessionInput
  validations: UploadPortalValidationInput[]
}): GeneralDefaultCriteriaWorkType | null {
  if (params.session.requestKind === 'payroll') return null

  const inferredWorkType = inferPortalWorkType(params)
  if (inferredWorkType === 'bookkeeping' || inferredWorkType === 'vat') {
    return inferredWorkType
  }

  return inferGeneralDefaultCriteriaWorkType({
    requestEmailSubject: params.session.requestEmailSubject,
    requestEmailBody: params.session.requestEmailBody,
  })
}

function buildFallbackChecklistItemsFromDefaultCriteria(
  workType: GeneralDefaultCriteriaWorkType | null,
): UploadPortalChecklistItemInput[] {
  if (!workType) return []

  return defaultCriteriaForWorkType(workType).map((criterion) => ({
    id: `default:${criterion.itemGroup}`,
    name: criterion.itemName,
    required: criterion.requiredness === 'required',
    canDeclare: false,
  }))
}

function resolvePortalChecklistItems(params: {
  session: UploadPortalSessionInput
  checklistItems: UploadPortalChecklistItemInput[]
  requestItemValidations: UploadPortalValidationInput[]
}): UploadPortalChecklistItemInput[] {
  if (params.checklistItems.length > 0) return params.checklistItems

  const validationItems = buildFallbackChecklistItemsFromValidations(params.requestItemValidations)
  if (validationItems.length > 0) return validationItems

  return buildFallbackChecklistItemsFromDefaultCriteria(
    inferDefaultCriteriaWorkType({
      session: params.session,
      validations: params.requestItemValidations,
    }),
  )
}

export function resolveUploadPortalStatus(params: {
  session: UploadPortalSessionInput
  checklistItems: UploadPortalChecklistItemInput[]
  uploadedFiles: UploadPortalFileInput[]
  materialMatches: UploadPortalMaterialMatchInput[]
  requestItemValidations: UploadPortalValidationInput[]
  requestItemValidationFiles: UploadPortalValidationFileInput[]
  analysisRuns: UploadPortalAnalysisRunInput[]
}): UploadPortalStatusResolution {
  const fileById = new Map(params.uploadedFiles.map((file) => [file.id, file]))
  const itemNameById = new Map(params.checklistItems.map((item) => [item.id, item.name]))
  const matchedItemNameByFileId = new Map<string, string>()
  const sourceChecklistItems = resolvePortalChecklistItems(params)
  const presentation = buildReviewSubmissionPresentation(buildPortalReviewSession(params))
  const unlinkedFileIds = new Set(
    presentation.unlinkedFiles
      .filter(({ file }) => file.staffReviewStatus !== 'excluded')
      .map(({ file }) => file.id),
  )
  const presentationRowsByItemKey = new Map(
    presentation.presentedRows.map((row) => [itemKey(row.validation.itemName), row]),
  )

  const confirmedMatchesByItemId = new Map<string, UploadPortalMaterialMatchInput[]>()
  for (const match of params.materialMatches) {
    if (CONFIRMED_MATCH_STATUSES.has(match.status)) {
      const matches = confirmedMatchesByItemId.get(match.checklistItemId) ?? []
      matches.push(match)
      confirmedMatchesByItemId.set(match.checklistItemId, matches)
      const itemName = itemNameById.get(match.checklistItemId)
      if (itemName && !matchedItemNameByFileId.has(match.uploadFileId)) {
        matchedItemNameByFileId.set(match.uploadFileId, itemName)
      }
    }
  }

  const validationLinksByValidationId = new Map<string, UploadPortalValidationFileInput[]>()
  for (const link of params.requestItemValidationFiles) {
    if (!DISPLAY_LINK_CONTRIBUTIONS.has(link.contribution ?? '')) continue
    const links = validationLinksByValidationId.get(link.validationId) ?? []
    links.push(link)
    validationLinksByValidationId.set(link.validationId, links)
  }

  const validationsByItemKey = new Map<string, UploadPortalValidationInput[]>()
  for (const validation of params.requestItemValidations.filter(isMaterialValidation)) {
    const key = itemKey(validation.itemName)
    const validations = validationsByItemKey.get(key) ?? []
    validations.push(validation)
    validationsByItemKey.set(key, validations)

    if (validation.validationStatus === 'satisfied') {
      const displayName = formatPortalItemName(validation.itemName)
      for (const link of validationLinksByValidationId.get(validation.id) ?? []) {
        if (!matchedItemNameByFileId.has(link.uploadFileId)) {
          matchedItemNameByFileId.set(link.uploadFileId, displayName)
        }
      }
    }
  }

  for (const row of presentation.presentedRows) {
    if (row.submissionStatusKey !== 'submitted') continue
    const displayName = formatPortalItemName(row.validation.itemName)
    for (const file of row.displayMatchedFiles) {
      if (!matchedItemNameByFileId.has(file.id)) {
        matchedItemNameByFileId.set(file.id, displayName)
      }
    }
  }

  const hasAnalyzingFile = params.uploadedFiles.some((file) => file.status === 'analyzing')
  const checklistItems = sourceChecklistItems.map((item) => {
    const confirmedMatches = confirmedMatchesByItemId.get(item.id) ?? []
    if (confirmedMatches.length > 0) {
      const matchedFiles = confirmedMatches
        .map((match) => fileById.get(match.uploadFileId))
        .filter((file): file is UploadPortalFileInput => Boolean(file))
      return {
        ...item,
        status: 'completed' as const,
        matchedFilename: summarizeFilenames(matchedFiles),
      }
    }

    const presentationRow = presentationRowsByItemKey.get(itemKey(item.name))
    if (presentationRow && presentationRow.displayMatchedFiles.length > 0) {
      return {
        ...item,
        status: presentationRow.submissionStatusKey === 'submitted' ? 'completed' as const : 'needs_review' as const,
        matchedFilename: summarizeFilenames(presentationRow.displayMatchedFiles),
      }
    }

    const validations = validationsByItemKey.get(itemKey(item.name)) ?? []
    const validationWithFiles = validations.find((validation) => (
      (validationLinksByValidationId.get(validation.id) ?? []).length > 0
    ))
    if (validationWithFiles) {
      const matchedFiles = (validationLinksByValidationId.get(validationWithFiles.id) ?? [])
        .map((link) => fileById.get(link.uploadFileId))
        .filter((file): file is UploadPortalFileInput => Boolean(file))
      return {
        ...item,
        status: validationWithFiles.validationStatus === 'satisfied' ? 'completed' as const : 'needs_review' as const,
        matchedFilename: summarizeFilenames(matchedFiles),
      }
    }

    return {
      ...item,
      status: hasAnalyzingFile ? 'analyzing' as const : 'pending' as const,
    }
  })

  return {
    checklistItems,
    matchedItemNameByFileId,
    unlinkedFileIds,
  }
}

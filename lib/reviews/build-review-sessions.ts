import { defaultCriteriaForWorkType } from '@/lib/review/default-criteria'
import { deriveAcceptedFileSummaries } from '@/lib/sessions/accepted-files'
import { computeCompletionEligibility } from '@/lib/sessions/completion-eligibility'
import { buildAttributionSummary } from './build-material-attribution-summary'
import { deriveSessionStatus } from './review-submission-status'
import type {
  ReviewAnalysisRun,
  ReviewFile,
  ReviewItemDeclaration,
  ReviewMaterialAttribution,
  ReviewSession,
  ReviewValidation,
  ReviewValidationFile,
} from './review-workspace-types'
import { uploadSession } from '@/lib/db/schema'

const BOOKKEEPING_GROUPS = new Set(defaultCriteriaForWorkType('bookkeeping').map((criterion) => criterion.itemGroup))
const VAT_GROUPS = new Set(defaultCriteriaForWorkType('vat').map((criterion) => criterion.itemGroup))

export type SessionListRow = {
  session: typeof uploadSession.$inferSelect
  clientId: string
  clientName: string
  clientEmail: string
  staffName: string | null
}

function isMaterialValidation(validation: ReviewValidation) {
  return validation.criterionType === 'material' || validation.criterionType === null
}

function buildCounts(validations: ReviewValidation[]) {
  const materialRows = validations.filter(isMaterialValidation)
  const rows = materialRows.length > 0 ? materialRows : validations

  return {
    satisfied: rows.filter((row) => row.validationStatus === 'satisfied').length,
    missing: rows.filter((row) => row.validationStatus === 'missing').length,
    nonCompliant: rows.filter((row) => row.validationStatus === 'non_compliant').length,
    partial: rows.filter((row) => row.validationStatus === 'partially_satisfied').length,
    uncertain: rows.filter((row) => row.validationStatus === 'uncertain').length,
  }
}

function isResolvedAttribution(row: ReviewMaterialAttribution) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(row.attributedPeriod ?? '') && row.periodRelation !== 'unknown'
}

function inferWorkTypeFromValidationGroups(groups: Array<string | null>) {
  const known = groups.filter((group): group is string => Boolean(group))
  const bookkeepingCount = known.filter((group) => BOOKKEEPING_GROUPS.has(group)).length
  const vatCount = known.filter((group) => VAT_GROUPS.has(group)).length

  if (bookkeepingCount > 0 && bookkeepingCount > vatCount) return 'bookkeeping' as const
  if (vatCount > 0 && vatCount > bookkeepingCount) return 'vat' as const
  return 'unknown' as const
}

function inferWorkTypeFromEmail(params: {
  subject: string | null
  body: string | null
}) {
  const source = `${params.subject ?? ''}\n${params.body ?? ''}`.toLowerCase()
  const hasVat = source.includes('부가세') || source.includes('vat')
  const hasBookkeeping = source.includes('기장') || source.includes('장부') || source.includes('거래내역')
  if (hasVat && !hasBookkeeping) return 'vat' as const
  if (hasBookkeeping && !hasVat) return 'bookkeeping' as const
  return 'unknown' as const
}

function getLatestAnalysisAt(runs: ReviewAnalysisRun[]) {
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ?? null
}

/**
 * Builds the same ReviewSession[] (including derivedStatus via
 * deriveSessionStatus) used by /dashboard/reviews. Shared so any other
 * screen that needs to show a review session's status — e.g. the client
 * detail page's "최근 요청" table — shows exactly the same judgment, not a
 * separately re-derived approximation.
 */
export function buildReviewSessions({
  rows,
  files,
  validations,
  validationFiles,
  analysisRuns,
  materialAttributions,
  itemDeclarations = [],
}: {
  rows: SessionListRow[]
  files: ReviewFile[]
  validations: ReviewValidation[]
  validationFiles: ReviewValidationFile[]
  analysisRuns: ReviewAnalysisRun[]
  materialAttributions: ReviewMaterialAttribution[]
  itemDeclarations?: Array<ReviewItemDeclaration & { uploadSessionId: string }>
}): ReviewSession[] {
  const itemDeclarationsBySessionId = new Map<string, ReviewItemDeclaration[]>()
  for (const declaration of itemDeclarations) {
    const list = itemDeclarationsBySessionId.get(declaration.uploadSessionId) ?? []
    list.push({
      checklistItemId: declaration.checklistItemId,
      itemName: declaration.itemName,
      declaration: declaration.declaration,
      note: declaration.note,
    })
    itemDeclarationsBySessionId.set(declaration.uploadSessionId, list)
  }

  const filesBySessionId = new Map<string, ReviewFile[]>()
  for (const file of files) {
    const list = filesBySessionId.get(file.uploadSessionId) ?? []
    list.push(file)
    filesBySessionId.set(file.uploadSessionId, list)
  }

  const validationsBySessionId = new Map<string, ReviewValidation[]>()
  for (const validation of validations) {
    const list = validationsBySessionId.get(validation.uploadSessionId) ?? []
    list.push(validation)
    validationsBySessionId.set(validation.uploadSessionId, list)
  }

  const analysisRunsByFileId = new Map<string, ReviewAnalysisRun[]>()
  for (const run of analysisRuns) {
    const list = analysisRunsByFileId.get(run.uploadFileId) ?? []
    list.push(run)
    analysisRunsByFileId.set(run.uploadFileId, list)
  }

  const materialAttributionsBySessionId = new Map<string, ReviewMaterialAttribution[]>()
  for (const attribution of materialAttributions) {
    const list = materialAttributionsBySessionId.get(attribution.uploadSessionId) ?? []
    list.push(attribution)
    materialAttributionsBySessionId.set(attribution.uploadSessionId, list)
  }

  return rows.map((row): ReviewSession => {
    const clientName = row.session.staffDirectLabel ?? row.clientName
    const sessionFiles = filesBySessionId.get(row.session.id) ?? []
    const sessionValidations = validationsBySessionId.get(row.session.id) ?? []
    const sessionValidationIds = new Set(sessionValidations.map((validation) => validation.id))
    const sessionValidationFiles = validationFiles.filter((link) => sessionValidationIds.has(link.validationId))
    const sessionAnalysisRuns = sessionFiles.flatMap((file) => analysisRunsByFileId.get(file.id) ?? [])
    const sessionMaterialAttributions = (materialAttributionsBySessionId.get(row.session.id) ?? []).filter(isResolvedAttribution)
    const latestAnalysisAt = getLatestAnalysisAt(sessionAnalysisRuns)
    const workType = inferWorkTypeFromValidationGroups(sessionValidations.map((validation) => validation.itemGroup))
    const fallbackWorkType = workType === 'unknown'
      ? inferWorkTypeFromEmail({
        subject: row.session.requestEmailSubject,
        body: row.session.requestEmailBody,
      })
      : workType
    const sessionWorkType = row.session.requestKind === 'payroll'
      ? 'payroll'
      : row.session.bookkeepingPeriodType
        ? 'bookkeeping'
        : fallbackWorkType
    const derivedStatusPlaceholder: ReviewSession['derivedStatus'] = {
      label: '제출 확인',
      detail: '',
      tone: 'info',
    }
    const sessionWithoutDerivedStatus: ReviewSession = {
      id: row.session.id,
      clientId: row.clientId,
      clientName,
      clientEmail: row.clientEmail,
      staffName: row.staffName,
      accountingPeriod: row.session.accountingPeriod,
      status: row.session.status,
      hasSessionEvaluation: Boolean(row.session.sessionEvaluation),
      expiresAt: row.session.expiresAt,
      createdAt: row.session.createdAt,
      requestEmailSubject: row.session.requestEmailSubject,
      requestEmailBody: row.session.requestEmailBody,
      source: row.session.source,
      latestAnalysisAt,
      workType: sessionWorkType,
      bookkeepingPeriodType: row.session.bookkeepingPeriodType,
      bookkeepingPeriodStart: row.session.bookkeepingPeriodStart,
      bookkeepingPeriodEnd: row.session.bookkeepingPeriodEnd,
      files: sessionFiles,
      validations: sessionValidations,
      validationFiles: sessionValidationFiles,
      analysisRuns: sessionAnalysisRuns,
      materialAttributions: sessionMaterialAttributions,
      materialAttributionSummary: buildAttributionSummary(sessionMaterialAttributions),
      acceptedFiles: deriveAcceptedFileSummaries({
        files: sessionFiles,
        validations: sessionValidations,
        validationFiles: sessionValidationFiles,
      }).files,
      counts: buildCounts(sessionValidations),
      derivedStatus: derivedStatusPlaceholder,
      completionKind: null,
      itemDeclarations: itemDeclarationsBySessionId.get(row.session.id) ?? [],
    }
    const completionEligibility = computeCompletionEligibility(sessionValidations)
    const derivedStatus = deriveSessionStatus({
      sessionStatus: row.session.status,
      session: sessionWithoutDerivedStatus,
      latestAnalysisAt,
    })

    return {
      ...sessionWithoutDerivedStatus,
      derivedStatus,
      completionKind: completionEligibility.eligible ? completionEligibility.completionKind : null,
    }
  })
}

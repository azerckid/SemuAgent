import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  analysisRun,
  bookkeepingMaterialAttribution,
  requestItemValidation,
  requestItemValidationFile,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { buildReviewSessions, type SessionListRow } from './build-review-sessions'
import type { ReviewSession } from './review-workspace-types'

/**
 * Tenant-detail scoped query (filters by tenantId + explicit sessionIds) —
 * loads the same judgment /dashboard/reviews shows (deriveSessionStatus via
 * buildReviewSessions) for a known, bounded set of sessions. Used by the
 * client detail page so its "최근 요청" table never disagrees with the
 * review screen about the same session's status.
 *
 * clientId/clientName/clientEmail/staffName are not read by the status
 * derivation path itself (deriveSessionStatus only looks at files,
 * validations, validationFiles, hasSessionEvaluation, workType,
 * accountingPeriod) — they exist only because ReviewSession carries them for
 * the reviews workspace UI. Callers outside that UI can pass through
 * whatever values they already have on hand.
 */
export async function loadReviewDerivedStatusBySessionId(params: {
  tenantId: string
  sessionIds: string[]
  clientId: string
  clientName: string
  clientEmail: string
  staffName: string | null
}): Promise<Map<string, ReviewSession['derivedStatus']>> {
  const { tenantId, sessionIds, clientId, clientName, clientEmail, staffName } = params
  if (sessionIds.length === 0) return new Map()

  const sessionRowsRaw = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.tenantId, tenantId), inArray(uploadSession.id, sessionIds)))

  if (sessionRowsRaw.length === 0) return new Map()

  const rows: SessionListRow[] = sessionRowsRaw.map((session) => ({
    session,
    clientId,
    clientName,
    clientEmail,
    staffName,
  }))

  const [fileRows, validationRows, materialAttributionRows] = await Promise.all([
    db
      .select({
        id: uploadFile.id,
        uploadSessionId: uploadFile.uploadSessionId,
        originalFilename: uploadFile.originalFilename,
        fileType: uploadFile.fileType,
        fileSize: uploadFile.fileSize,
        status: uploadFile.status,
        passwordStatus: uploadFile.passwordStatus,
        uploadedAt: uploadFile.uploadedAt,
      })
      .from(uploadFile)
      .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.uploadSessionId, sessionIds)))
      .orderBy(uploadFile.uploadedAt),
    db
      .select({
        id: requestItemValidation.id,
        uploadSessionId: requestItemValidation.uploadSessionId,
        itemName: requestItemValidation.itemName,
        itemGroup: requestItemValidation.itemGroup,
        criterionType: requestItemValidation.criterionType,
        requiredness: requestItemValidation.requiredness,
        validationStatus: requestItemValidation.validationStatus,
        reviewStatus: requestItemValidation.reviewStatus,
        aiReasoning: requestItemValidation.aiReasoning,
        requestedAction: requestItemValidation.requestedAction,
        staffNote: requestItemValidation.staffNote,
        reviewedAt: requestItemValidation.reviewedAt,
      })
      .from(requestItemValidation)
      .where(and(eq(requestItemValidation.tenantId, tenantId), inArray(requestItemValidation.uploadSessionId, sessionIds)))
      .orderBy(requestItemValidation.createdAt),
    db
      .select({
        id: bookkeepingMaterialAttribution.id,
        uploadSessionId: bookkeepingMaterialAttribution.uploadSessionId,
        sourceKind: bookkeepingMaterialAttribution.sourceKind,
        sourceLabel: bookkeepingMaterialAttribution.sourceLabel,
        evidenceDate: bookkeepingMaterialAttribution.evidenceDate,
        attributedPeriod: bookkeepingMaterialAttribution.attributedPeriod,
        requestedPeriod: bookkeepingMaterialAttribution.requestedPeriod,
        closePeriod: bookkeepingMaterialAttribution.closePeriod,
        periodRelation: bookkeepingMaterialAttribution.periodRelation,
        amountKrw: bookkeepingMaterialAttribution.amountKrw,
        counterparty: bookkeepingMaterialAttribution.counterparty,
        description: bookkeepingMaterialAttribution.description,
        duplicateStatus: bookkeepingMaterialAttribution.duplicateStatus,
        duplicateBasis: bookkeepingMaterialAttribution.duplicateBasis,
        recommendation: bookkeepingMaterialAttribution.recommendation,
        staffDecision: bookkeepingMaterialAttribution.staffDecision,
        staffNote: bookkeepingMaterialAttribution.staffNote,
      })
      .from(bookkeepingMaterialAttribution)
      .where(and(
        eq(bookkeepingMaterialAttribution.tenantId, tenantId),
        eq(bookkeepingMaterialAttribution.status, 'active'),
        inArray(bookkeepingMaterialAttribution.uploadSessionId, sessionIds),
      ))
      .orderBy(bookkeepingMaterialAttribution.attributedPeriod, bookkeepingMaterialAttribution.evidenceDate),
  ])

  const validationIds = validationRows.map((validation) => validation.id)
  const fileIds = fileRows.map((file) => file.id)

  const [validationFileRows, analysisRows] = await Promise.all([
    validationIds.length > 0
      ? db
        .select({
          id: requestItemValidationFile.id,
          validationId: requestItemValidationFile.validationId,
          uploadFileId: requestItemValidationFile.uploadFileId,
          contribution: requestItemValidationFile.contribution,
        })
        .from(requestItemValidationFile)
        .where(and(eq(requestItemValidationFile.tenantId, tenantId), inArray(requestItemValidationFile.validationId, validationIds)))
      : Promise.resolve([]),
    fileIds.length > 0
      ? db
        .select({
          id: analysisRun.id,
          uploadFileId: analysisRun.uploadFileId,
          provider: analysisRun.provider,
          model: analysisRun.model,
          confidence: analysisRun.confidence,
          consensusGroup: analysisRun.consensusGroup,
          status: analysisRun.status,
          parsedOutput: analysisRun.parsedOutput,
          errorMessage: analysisRun.errorMessage,
          criteriaSummary: analysisRun.criteriaSummary,
          createdAt: analysisRun.createdAt,
        })
        .from(analysisRun)
        .where(and(eq(analysisRun.tenantId, tenantId), inArray(analysisRun.uploadFileId, fileIds)))
      : Promise.resolve([]),
  ])

  const reviewSessions = buildReviewSessions({
    rows,
    files: fileRows,
    validations: validationRows,
    validationFiles: validationFileRows,
    analysisRuns: analysisRows,
    materialAttributions: materialAttributionRows,
  })

  return new Map(reviewSessions.map((session) => [session.id, session.derivedStatus]))
}

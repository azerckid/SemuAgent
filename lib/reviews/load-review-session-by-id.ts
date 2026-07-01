import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  analysisRun,
  bookkeepingMaterialAttribution,
  checklistItem,
  client,
  requestItemValidation,
  requestItemValidationFile,
  staff,
  uploadFile,
  uploadItemDeclaration,
  uploadSession,
} from '@/lib/db/schema'
import { buildReviewSessions } from './build-review-sessions'
import { sortReviewSessions } from './review-session-order'
import type { ReviewSession } from './review-workspace-types'

export async function loadSessionDependents(tenantId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return { files: [], validations: [], materialAttributions: [], validationFiles: [], analysisRuns: [], itemDeclarations: [] }
  }

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
        staffReviewStatus: uploadFile.staffReviewStatus,
        staffReviewNote: uploadFile.staffReviewNote,
        staffReviewedAt: uploadFile.staffReviewedAt,
        uploadedAt: uploadFile.uploadedAt,
      })
      .from(uploadFile)
      .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.uploadSessionId, sessionIds)))
      .orderBy(desc(uploadFile.uploadedAt)),
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
      .where(
        and(
          eq(bookkeepingMaterialAttribution.tenantId, tenantId),
          eq(bookkeepingMaterialAttribution.status, 'active'),
          inArray(bookkeepingMaterialAttribution.uploadSessionId, sessionIds),
        ),
      )
      .orderBy(bookkeepingMaterialAttribution.attributedPeriod, bookkeepingMaterialAttribution.evidenceDate),
  ])

  // 고객이 포털에서 표시한 자료 항목 선언(없음/나중에). checklist_item을 조인해
  // checklist_item_id → 항목명을 같은 쿼리에서 해소한다(테넌트 격리).
  const declarationRows = await db
    .select({
      uploadSessionId: uploadItemDeclaration.uploadSessionId,
      checklistItemId: uploadItemDeclaration.checklistItemId,
      itemName: checklistItem.name,
      declaration: uploadItemDeclaration.declaration,
      note: uploadItemDeclaration.note,
    })
    .from(uploadItemDeclaration)
    .innerJoin(
      checklistItem,
      and(
        eq(uploadItemDeclaration.checklistItemId, checklistItem.id),
        eq(checklistItem.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(uploadItemDeclaration.tenantId, tenantId),
        inArray(uploadItemDeclaration.uploadSessionId, sessionIds),
      ),
    )
    .orderBy(checklistItem.sortOrder, checklistItem.name)

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
      : [],
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
          .orderBy(desc(analysisRun.createdAt))
      : [],
  ])

  return {
    files: fileRows,
    validations: validationRows,
    materialAttributions: materialAttributionRows,
    validationFiles: validationFileRows,
    analysisRuns: analysisRows,
    itemDeclarations: declarationRows,
  }
}

/**
 * Tenant-scoped lookup for exactly one general-material session by id,
 * regardless of whether it's in any already-loaded recency-bounded page.
 * Used by /dashboard/reviews so a stale or shared ?sessionId= link never
 * silently falls back to a different client's session — it either resolves
 * to the exact requested session or returns null for an explicit not-found
 * state. Excludes payroll sessions and soft-deleted sessions, matching the
 * session-list query this page uses elsewhere.
 */
export async function loadReviewSessionById(tenantId: string, sessionId: string): Promise<ReviewSession | null> {
  const rows = await db
    .select({
      session: uploadSession,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      staffName: staff.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(uploadSession.createdByStaffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(
      and(
        eq(uploadSession.id, sessionId),
        eq(uploadSession.tenantId, tenantId),
        eq(uploadSession.requestKind, 'general'),
        isNull(uploadSession.deletedAt),
      ),
    )
    .limit(1)

  if (rows.length === 0) return null

  const dependents = await loadSessionDependents(tenantId, rows.map((row) => row.session.id))
  const built = sortReviewSessions(buildReviewSessions({ rows, ...dependents }))
  return built[0] ?? null
}

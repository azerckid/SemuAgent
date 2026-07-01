import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { analysisRun, uploadFile, uploadSession } from '@/lib/db/schema'
import { deriveReviewAdaptiveStructuringEligibility, type ReviewAdaptiveStructuringEligibility } from './adaptive-structuring-eligibility'
import type { ReviewFile, ReviewSession } from '@/lib/reviews/review-workspace-types'

export type ReviewAdaptiveStructuringEligibilityContext = {
  session: typeof uploadSession.$inferSelect
  sourceFiles: Array<typeof uploadFile.$inferSelect>
  eligibility: ReviewAdaptiveStructuringEligibility
}

// Slice 1의 eligibility 입력(파일 분석 상태)을 클라이언트가 아니라 서버가 세션 id만으로
// 직접 다시 계산한다. 클라이언트가 보낸 eligibility/fileId는 신뢰하지 않는다(payroll의
// loadPayrollAdaptiveStructuringEligibilityContext와 동일 원칙).
export async function loadReviewAdaptiveStructuringEligibilityContext(params: {
  sessionId: string
  tenantId: string
}): Promise<ReviewAdaptiveStructuringEligibilityContext | null> {
  const { sessionId, tenantId } = params

  const sessionRows = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = sessionRows[0]
  if (!session) return null

  const sourceFiles = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  const analysisRuns = sourceFiles.length > 0
    ? await db
      .select()
      .from(analysisRun)
      .where(and(
        inArray(analysisRun.uploadFileId, sourceFiles.map((file) => file.id)),
        eq(analysisRun.tenantId, tenantId),
      ))
    : []

  // workType은 review-file-classification의 기간 불일치 검사(unsuitablePeriodMismatch)가
  // bookkeeping 세션에서만 적용되도록 구분하는 용도로만 쓰인다. 전체 ReviewSession 목록
  // 화면(app/(dashboard)/dashboard/reviews/page.tsx)의 validation-group/이메일 기반
  // fallback 추론은 이 단일 세션 컨텍스트에서는 재현하지 않는다 — requestKind/
  // bookkeepingPeriodType만으로 충분히 정확하고, 추가 쿼리(requestItemValidation) 없이
  // eligibility 재계산을 가볍게 유지한다.
  const workType: ReviewSession['workType'] = session.requestKind === 'payroll'
    ? 'payroll'
    : session.bookkeepingPeriodType
      ? 'bookkeeping'
      : 'unknown'

  const files: ReviewFile[] = sourceFiles.map((file) => ({
    id: file.id,
    uploadSessionId: file.uploadSessionId,
    originalFilename: file.originalFilename,
    fileType: file.fileType,
    fileSize: file.fileSize,
    status: file.status,
    passwordStatus: file.passwordStatus,
    uploadedAt: file.uploadedAt,
  }))

  const reviewSession: ReviewSession = {
    id: session.id,
    clientId: session.clientId,
    clientName: '',
    clientEmail: '',
    staffName: null,
    accountingPeriod: session.accountingPeriod,
    status: session.status,
    hasSessionEvaluation: Boolean(session.sessionEvaluation),
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    requestEmailSubject: session.requestEmailSubject,
    requestEmailBody: session.requestEmailBody,
    source: session.source,
    latestAnalysisAt: null,
    workType,
    bookkeepingPeriodType: session.bookkeepingPeriodType,
    bookkeepingPeriodStart: session.bookkeepingPeriodStart,
    bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
    files,
    validations: [],
    validationFiles: [],
    analysisRuns,
    materialAttributions: [],
    materialAttributionSummary: null,
    acceptedFiles: [],
    counts: { satisfied: 0, missing: 0, nonCompliant: 0, partial: 0, uncertain: 0 },
    derivedStatus: { label: '', detail: '', tone: 'default' },
    completionKind: null,
  }

  const eligibility = deriveReviewAdaptiveStructuringEligibility(reviewSession)

  return { session, sourceFiles, eligibility }
}

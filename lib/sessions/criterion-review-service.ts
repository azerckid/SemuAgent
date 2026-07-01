import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  outboundEmail,
  requestItemValidation,
  staff,
  uploadSession,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type { CriterionReviewPatchInput } from '@/lib/validations/criterion-review'
import {
  computeCompletionEligibility,
  isMaterialCriterion,
  resolveSessionStatusAfterReview,
} from './completion-eligibility'

const REVIEWABLE_SESSION_STATUSES = ['needs_resubmission', 'ready_for_accountant'] as const
const TERMINAL_SESSION_STATUSES = ['completed', 'expired', 'revoked'] as const

type StaffRecord = {
  id: string
  role: string
}

export type CriterionReviewResult =
  | { ok: true; validation: typeof requestItemValidation.$inferSelect; completionEligibility: ReturnType<typeof computeCompletionEligibility>; sessionStatus: string }
  | { ok: false; error: string; status: number }

async function rejectStaleMissingRequestDrafts(params: {
  sessionId: string
  tenantId: string
}) {
  await db
    .update(outboundEmail)
    .set({ status: 'rejected' })
    .where(
      and(
        eq(outboundEmail.uploadSessionId, params.sessionId),
        eq(outboundEmail.tenantId, params.tenantId),
        eq(outboundEmail.type, 'missing_request'),
        eq(outboundEmail.status, 'draft'),
      ),
    )
}

async function loadSessionValidations(params: {
  sessionId: string
  tenantId: string
}) {
  return db
    .select()
    .from(requestItemValidation)
    .where(
      and(
        eq(requestItemValidation.uploadSessionId, params.sessionId),
        eq(requestItemValidation.tenantId, params.tenantId),
      ),
    )
}

export async function reviewSessionCriterion(params: {
  sessionId: string
  criterionId: string
  tenantId: string
  staffRecord: StaffRecord
  input: CriterionReviewPatchInput
}): Promise<CriterionReviewResult> {
  const { sessionId, criterionId, tenantId, staffRecord, input } = params

  const [session] = await db
    .select({
      id: uploadSession.id,
      status: uploadSession.status,
      requestKind: uploadSession.requestKind,
      createdByStaffId: uploadSession.createdByStaffId,
    })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!session) {
    return { ok: false, error: '세션을 찾을 수 없습니다.', status: 404 }
  }
  if (session.requestKind !== 'general') {
    return { ok: false, error: '일반 자료 세션에서만 사용할 수 있습니다.', status: 409 }
  }
  if ((TERMINAL_SESSION_STATUSES as readonly string[]).includes(session.status)) {
    return { ok: false, error: '완료·만료·철회된 세션은 검토할 수 없습니다.', status: 409 }
  }
  if (!(REVIEWABLE_SESSION_STATUSES as readonly string[]).includes(session.status)) {
    return { ok: false, error: 'AI 평가 이후 검토 가능한 상태에서만 사용할 수 있습니다.', status: 409 }
  }
  if (staffRecord.role === 'STAFF' && session.createdByStaffId !== staffRecord.id) {
    return { ok: false, error: '자신이 생성한 세션만 검토할 수 있습니다.', status: 403 }
  }

  const [criterion] = await db
    .select()
    .from(requestItemValidation)
    .where(
      and(
        eq(requestItemValidation.id, criterionId),
        eq(requestItemValidation.uploadSessionId, sessionId),
        eq(requestItemValidation.tenantId, tenantId),
      ),
    )
    .limit(1)

  if (!criterion) {
    return { ok: false, error: '요청자료 기준을 찾을 수 없습니다.', status: 404 }
  }
  if (!isMaterialCriterion(criterion)) {
    return { ok: false, error: 'material 기준 항목만 담당자 예외 검토할 수 있습니다.', status: 409 }
  }

  const timestamp = toDBString(now())
  const staffNote = input.staffNote?.trim() || null

  await db
    .update(requestItemValidation)
    .set({
      reviewStatus: input.reviewStatus,
      staffNote,
      reviewedByStaffId: staffRecord.id,
      reviewedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(requestItemValidation.id, criterionId), eq(requestItemValidation.tenantId, tenantId)))

  const validations = await loadSessionValidations({ sessionId, tenantId })
  const completionEligibility = computeCompletionEligibility(validations)
  const nextSessionStatus = resolveSessionStatusAfterReview({
    currentStatus: session.status,
    eligibility: completionEligibility,
  })

  if (nextSessionStatus) {
    await db
      .update(uploadSession)
      .set({ status: nextSessionStatus })
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
  }

  await rejectStaleMissingRequestDrafts({ sessionId, tenantId })

  const [updatedValidation] = await db
    .select()
    .from(requestItemValidation)
    .where(and(eq(requestItemValidation.id, criterionId), eq(requestItemValidation.tenantId, tenantId)))
    .limit(1)

  return {
    ok: true,
    validation: updatedValidation,
    completionEligibility,
    sessionStatus: nextSessionStatus ?? session.status,
  }
}

export async function getActiveStaffForCriterionReview(params: {
  userId: string
  tenantId: string
}) {
  const [staffRecord] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, params.userId), eq(staff.tenantId, params.tenantId), eq(staff.active, true)))
    .limit(1)

  return staffRecord ?? null
}

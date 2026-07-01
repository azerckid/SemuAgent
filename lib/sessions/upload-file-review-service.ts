import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import { buildReviewSubmissionPresentation } from '@/lib/reviews/review-submission-status'
import {
  canStaffExcludeUnlinkedFile,
  DEFAULT_UNLINKED_FILE_EXCLUDE_NOTE,
} from '@/lib/reviews/unlinked-file-review'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'
import { now, toDBString } from '@/lib/time'
import type { UploadFileReviewPatchInput } from '@/lib/validations/upload-file-review'

const FILE_REVIEW_BLOCKED_SESSION_STATUSES = ['draft', 'completed', 'expired', 'revoked'] as const

const TERMINAL_SESSION_STATUSES = ['completed', 'expired', 'revoked'] as const

type StaffRecord = {
  id: string
  role: string
}

export type UploadFileReviewResult =
  | {
      ok: true
      file: typeof uploadFile.$inferSelect
    }
  | { ok: false; error: string; status: number }

function findUnlinkedPresentationEntry(session: ReviewSession, fileId: string) {
  const presentation = buildReviewSubmissionPresentation(session)
  return presentation.unlinkedFiles.find((entry) => entry.file.id === fileId) ?? null
}

export async function reviewUploadFile(params: {
  sessionId: string
  fileId: string
  tenantId: string
  staffRecord: StaffRecord
  session: ReviewSession
  input: UploadFileReviewPatchInput
}): Promise<UploadFileReviewResult> {
  const { sessionId, fileId, tenantId, staffRecord, session, input } = params

  const [uploadSessionRow] = await db
    .select({
      id: uploadSession.id,
      status: uploadSession.status,
      requestKind: uploadSession.requestKind,
      createdByStaffId: uploadSession.createdByStaffId,
    })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!uploadSessionRow) {
    return { ok: false, error: '세션을 찾을 수 없습니다.', status: 404 }
  }
  if (uploadSessionRow.requestKind !== 'general') {
    return { ok: false, error: '일반 자료 세션에서만 사용할 수 있습니다.', status: 409 }
  }
  if ((TERMINAL_SESSION_STATUSES as readonly string[]).includes(uploadSessionRow.status)) {
    return { ok: false, error: '완료·만료·철회된 세션은 검토할 수 없습니다.', status: 409 }
  }
  if ((FILE_REVIEW_BLOCKED_SESSION_STATUSES as readonly string[]).includes(uploadSessionRow.status)) {
    return { ok: false, error: '현재 세션 상태에서는 파일 검토 제외를 변경할 수 없습니다.', status: 409 }
  }
  if (staffRecord.role === 'STAFF' && uploadSessionRow.createdByStaffId !== staffRecord.id) {
    return { ok: false, error: '자신이 생성한 세션만 검토할 수 있습니다.', status: 403 }
  }

  const [fileRow] = await db
    .select()
    .from(uploadFile)
    .where(
      and(
        eq(uploadFile.id, fileId),
        eq(uploadFile.uploadSessionId, sessionId),
        eq(uploadFile.tenantId, tenantId),
      ),
    )
    .limit(1)

  if (!fileRow) {
    return { ok: false, error: '파일을 찾을 수 없습니다.', status: 404 }
  }

  const unlinkedEntry = findUnlinkedPresentationEntry(session, fileId)
  if (!unlinkedEntry) {
    return { ok: false, error: '미연결 파일만 검토 제외할 수 있습니다.', status: 409 }
  }

  if (input.staffReviewStatus === 'excluded' && !canStaffExcludeUnlinkedFile(unlinkedEntry.file, unlinkedEntry.classification)) {
    return {
      ok: false,
      error: '분석 중이거나 비밀번호 확인이 필요한 파일은 먼저 처리한 뒤 제외할 수 있습니다.',
      status: 409,
    }
  }

  const timestamp = toDBString(now())
  const staffReviewNote = input.staffReviewStatus === 'excluded'
    ? (input.staffReviewNote?.trim() || DEFAULT_UNLINKED_FILE_EXCLUDE_NOTE)
    : null

  await db
    .update(uploadFile)
    .set({
      staffReviewStatus: input.staffReviewStatus,
      staffReviewNote,
      staffReviewedByStaffId: input.staffReviewStatus === 'excluded' ? staffRecord.id : null,
      staffReviewedAt: input.staffReviewStatus === 'excluded' ? timestamp : null,
    })
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))

  const [updatedFile] = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    .limit(1)

  if (!updatedFile) {
    return { ok: false, error: '파일을 찾을 수 없습니다.', status: 404 }
  }

  return { ok: true, file: updatedFile }
}

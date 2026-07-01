import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import { tryDecryptExcel } from '@/lib/ai/excel-decrypt'
import { isMutableUploadSessionStatus } from '@/lib/upload-session-revision'
import { now, toDBString } from '@/lib/time'

/**
 * 비밀번호 보호 파일 처리 서비스 (Slice 3-B).
 *
 * 보안 원칙 (불변):
 * - 비밀번호 값은 이 함수 인자 밖으로 절대 나가지 않는다. DB·로그·에러 메시지·AI payload·proof 어디에도 저장하지 않는다.
 * - 복호화 평문은 Blob에 다시 쓰지 않는다(암호화본 유지). 분석에는 메모리 버퍼(overrideBuffer)만 전달한다.
 * - 성공 시 passwordStatus='consumed'(입력받아 복호화·분석에 사용 후 폐기), 실패 시 'invalid'.
 *
 * 인증/스코프 결정은 호출하는 라우트가 책임진다. 이 서비스는 tenant + (선택)session 스코프만 강제한다.
 */

const CONTROLLED_BLOB_HOST_SUFFIX = '.blob.vercel-storage.com'

// 비밀번호 입력을 받아들일 수 있는 상태: 최초 'required' 또는 직전 오답 후 'invalid' 재시도.
const ACCEPTABLE_PASSWORD_STATUSES = new Set(['required', 'invalid'])

export type SubmitFilePasswordResult =
  | { ok: true; status: 'consumed'; overrideBuffer: ArrayBuffer }
  | { ok: false; status: 'invalid'; reason: 'password_invalid'; attemptCount: number }
  | {
      ok: false
      status: 'rejected'
      reason: 'file_not_found' | 'not_password_protected' | 'session_locked'
    }

export interface SubmitFilePasswordParams {
  fileId: string
  tenantId: string
  password: string
  /** 클라이언트 포털 경로: 파일이 이 세션에 속해야 함. 담당자 경로에서는 생략. */
  expectedSessionId?: string
  /** 클라이언트 포털 경로: 세션이 수정 가능한 상태여야 함. 담당자 경로에서는 false. */
  requireMutableSession?: boolean
}

async function readControlledBlob(url: string): Promise<ArrayBuffer | null> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith(CONTROLLED_BLOB_HOST_SUFFIX)) {
      return null
    }
  } catch {
    return null
  }

  const blobRes = await get(url, { access: 'private', useCache: false })
  if (!blobRes || blobRes.statusCode !== 200) return null
  return new Response(blobRes.stream).arrayBuffer()
}

export async function submitFilePassword(
  params: SubmitFilePasswordParams,
): Promise<SubmitFilePasswordResult> {
  const { fileId, tenantId, password, expectedSessionId, requireMutableSession } = params

  const fileRows = await db
    .select({
      id: uploadFile.id,
      uploadSessionId: uploadFile.uploadSessionId,
      storageKey: uploadFile.storageKey,
      passwordStatus: uploadFile.passwordStatus,
      passwordAttemptCount: uploadFile.passwordAttemptCount,
    })
    .from(uploadFile)
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    .limit(1)

  const file = fileRows[0]
  // 세션 불일치도 존재 여부를 노출하지 않도록 file_not_found로 통일한다.
  if (!file || (expectedSessionId && file.uploadSessionId !== expectedSessionId)) {
    return { ok: false, status: 'rejected', reason: 'file_not_found' }
  }

  if (!ACCEPTABLE_PASSWORD_STATUSES.has(file.passwordStatus)) {
    return { ok: false, status: 'rejected', reason: 'not_password_protected' }
  }

  if (requireMutableSession) {
    const sessionRows = await db
      .select({ status: uploadSession.status })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, file.uploadSessionId), eq(uploadSession.tenantId, tenantId)))
      .limit(1)
    const session = sessionRows[0]
    if (!session || !isMutableUploadSessionStatus(session.status)) {
      return { ok: false, status: 'rejected', reason: 'session_locked' }
    }
  }

  const encryptedBuffer = await readControlledBlob(file.storageKey)
  if (!encryptedBuffer) {
    // Blob 재읽기 실패는 처리 불가 → 오답과 구분 없이 invalid로 두지 않고 명확히 거부한다.
    return { ok: false, status: 'rejected', reason: 'file_not_found' }
  }

  const decryptResult = await tryDecryptExcel(encryptedBuffer, password)
  const submittedAt = toDBString(now())
  const nextAttemptCount = (file.passwordAttemptCount ?? 0) + 1

  if (!decryptResult.ok) {
    await db
      .update(uploadFile)
      .set({
        passwordStatus: 'invalid',
        passwordLastSubmittedAt: submittedAt,
        passwordAttemptCount: nextAttemptCount,
      })
      .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    return { ok: false, status: 'invalid', reason: 'password_invalid', attemptCount: nextAttemptCount }
  }

  // 성공: 분석을 다시 돌릴 수 있도록 status='uploaded'로 되돌리고, passwordStatus='consumed'로 확정.
  await db
    .update(uploadFile)
    .set({
      status: 'uploaded',
      passwordStatus: 'consumed',
      passwordLastSubmittedAt: submittedAt,
      passwordAttemptCount: nextAttemptCount,
    })
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))

  const decrypted = decryptResult.buffer
  const overrideBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength,
  ) as ArrayBuffer

  return { ok: true, status: 'consumed', overrideBuffer }
}

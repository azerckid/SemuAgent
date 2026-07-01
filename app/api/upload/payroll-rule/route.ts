import { createHash, randomUUID } from 'crypto'
import { get } from '@vercel/blob'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { clientDocument } from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'
import { now, toDBString } from '@/lib/time'
import { isMutableUploadSessionStatus } from '@/lib/upload-session-revision'
import {
  PAYROLL_RULE_CLIENT_DOCUMENT_TYPE,
  PAYROLL_RULE_CLIENT_SUBMIT_MEMO,
  PAYROLL_RULE_DOCUMENT_CONTENT_TYPES,
} from '@/lib/payroll/payroll-rule-document-types'

export const maxDuration = 60

/**
 * 클라이언트 업로드 포털에서 사내 급여규정 파일을 받는 콜백 route.
 *
 * 일반 급여정산 자료(/api/upload → upload_file)와 달리, 규정 파일은 월별 추출
 * 대상이 아니라 고객사별 급여기준 프로필의 source가 되므로 `client_document`로
 * 저장한다. 담당자가 급여기준 프로필 화면에서 이 자료로 초안을 만들고 승인한다
 * (클라이언트는 초안·승인·프로필을 보지 못한다).
 *
 * 인증: 세션 토큰(token_hash + 만료 + 상태)만으로 접근하며, requestKind가
 * 'payroll'인 세션에서만 허용한다. 직원 세션 없이 동작하므로 client_document의
 * uploadedByStaffId는 요청을 만든 담당자(session.createdByStaffId)로 귀속한다.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const clientPayloadSchema = z.object({
  rawToken: z.string().min(1),
  originalFilename: z.string().min(1),
})

const tokenPayloadSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  uploadedByStaffId: z.string().min(1),
  originalFilename: z.string().min(1),
})

const blobResultSchema = z.object({
  url: z.string().url(),
  pathname: z.string().min(1),
  contentType: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw new Error('세션 토큰이 누락되었습니다')

        const parsed = clientPayloadSchema.safeParse(JSON.parse(clientPayload))
        if (!parsed.success) throw new Error('요청 형식이 올바르지 않습니다')

        const session = await verifyToken(parsed.data.rawToken)
        if (!session) throw new Error('유효하지 않거나 만료된 세션입니다')
        if (session.requestKind !== 'payroll') {
          throw new Error('급여정산 요청에서만 사내 규정을 올릴 수 있습니다')
        }
        if (!isMutableUploadSessionStatus(session.status)) {
          throw new Error('이미 완료된 요청은 자료를 추가할 수 없습니다')
        }

        return {
          allowedContentTypes: [...PAYROLL_RULE_DOCUMENT_CONTENT_TYPES],
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            tenantId: session.tenantId,
            clientId: session.clientId,
            uploadedByStaffId: session.createdByStaffId,
            originalFilename: parsed.data.originalFilename,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const blobParsed = blobResultSchema.safeParse(blob)
        if (!blobParsed.success) {
          throw new Error(`Blob 응답 형식이 올바르지 않습니다: ${blobParsed.error.message}`)
        }

        const payloadParsed = tokenPayloadSchema.safeParse(JSON.parse(tokenPayload ?? '{}'))
        if (!payloadParsed.success) {
          throw new Error('tokenPayload 형식이 올바르지 않습니다')
        }
        const { tenantId, clientId, uploadedByStaffId, originalFilename } = payloadParsed.data
        const { url, contentType } = blobParsed.data

        const blobContent = await get(url, { access: 'private' })
        if (!blobContent || blobContent.statusCode !== 200) {
          throw new Error('업로드 파일을 Blob에서 다시 읽을 수 없습니다')
        }

        const buffer = await new Response(blobContent.stream).arrayBuffer()
        const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

        await db.insert(clientDocument).values({
          id: randomUUID(),
          tenantId,
          clientId,
          documentType: PAYROLL_RULE_CLIENT_DOCUMENT_TYPE,
          originalFilename,
          storageKey: url,
          contentType,
          fileSize: buffer.byteLength,
          contentHash,
          uploadedByStaffId,
          memo: PAYROLL_RULE_CLIENT_SUBMIT_MEMO,
          createdAt: toDBString(now()),
        })
      },
    })

    return Response.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : '업로드 처리 중 알 수 없는 오류가 발생했습니다'
    console.warn('[POST /api/upload/payroll-rule] token/upload callback failed:', message)
    return new Response(message, { status: 400 })
  }
}

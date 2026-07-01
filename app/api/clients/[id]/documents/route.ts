import { createHash, randomUUID } from 'crypto'
import { get } from '@vercel/blob'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientDocument, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  clientDocumentBlobResultSchema,
  clientDocumentUploadMetaSchema,
} from '@/lib/validations/client-document'
import { PAYROLL_RULE_DOCUMENT_CONTENT_TYPES } from '@/lib/payroll/payroll-rule-document-types'

export const maxDuration = 60

const ALLOWED_CONTENT_TYPES = [
  ...PAYROLL_RULE_DOCUMENT_CONTENT_TYPES,
  'image/jpeg',
  'image/png',
  'image/webp',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const tokenPayloadSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  documentId: z.string().uuid().optional(),
  documentType: z.string().min(1),
  originalFilename: z.string().min(1),
  memo: z.string().optional(),
  uploadedByStaffId: z.string().min(1),
})

/**
 * 고객사 보관 문서 업로드. 클라이언트 업로드 포털과 무관한 직원 직접 업로드라
 * /api/upload(세션 토큰 기반)와는 별도 callback route를 둔다.
 * 업로드/삭제 권한: 배정 담당자(client.staffId) 또는 TENANT_ADMIN만.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { user, tenantId } = await requireTenantSession()

        if (!clientPayload) throw new Error('요청 정보가 누락되었습니다')
        const metaParsed = clientDocumentUploadMetaSchema.safeParse(JSON.parse(clientPayload))
        if (!metaParsed.success) {
          throw new Error(`요청 형식이 올바르지 않습니다: ${metaParsed.error.message}`)
        }

        const [meRows, clientRows] = await Promise.all([
          db
            .select({ id: staff.id, role: staff.role })
            .from(staff)
            .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
            .limit(1),
          db
            .select({ id: client.id, staffId: client.staffId })
            .from(client)
            .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
            .limit(1),
        ])

        const me = meRows[0]
        if (!me) throw new Error('Unauthorized')
        const clientRow = clientRows[0]
        if (!clientRow) throw new Error('고객사를 찾을 수 없습니다')
        if (me.role !== 'TENANT_ADMIN' && clientRow.staffId !== me.id) {
          throw new Error('이 고객사의 담당자 또는 관리자만 문서를 업로드할 수 있습니다')
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            tenantId,
            clientId,
            documentId: metaParsed.data.documentId,
            documentType: metaParsed.data.documentType,
            originalFilename: metaParsed.data.originalFilename,
            memo: metaParsed.data.memo,
            uploadedByStaffId: me.id,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const blobParsed = clientDocumentBlobResultSchema.safeParse(blob)
        if (!blobParsed.success) {
          throw new Error(`Blob 응답 형식이 올바르지 않습니다: ${blobParsed.error.message}`)
        }

        const payloadParsed = tokenPayloadSchema.safeParse(JSON.parse(tokenPayload ?? '{}'))
        if (!payloadParsed.success) {
          throw new Error('tokenPayload 형식이 올바르지 않습니다')
        }
        const { tenantId, clientId, documentId, documentType, originalFilename, memo, uploadedByStaffId } = payloadParsed.data
        const { url, contentType } = blobParsed.data

        const blobContent = await get(url, { access: 'private' })
        if (!blobContent || blobContent.statusCode !== 200) {
          throw new Error('업로드 파일을 Blob에서 다시 읽을 수 없습니다')
        }

        const buffer = await new Response(blobContent.stream).arrayBuffer()
        const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

        await db.insert(clientDocument).values({
          id: documentId ?? randomUUID(),
          tenantId,
          clientId,
          documentType,
          originalFilename,
          storageKey: url,
          contentType,
          fileSize: buffer.byteLength,
          contentHash,
          uploadedByStaffId,
          memo: memo || null,
          createdAt: toDBString(now()),
        })
      },
    })

    return Response.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : '업로드 처리 중 알 수 없는 오류가 발생했습니다'
    console.warn('[POST /api/clients/[id]/documents] token/upload callback failed:', message)
    return new Response(message, { status: 400 })
  }
}

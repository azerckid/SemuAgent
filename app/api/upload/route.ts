import { get } from '@vercel/blob'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { createHash } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'
import { now, toDBString } from '@/lib/time'
import { isMutableUploadSessionStatus, markSessionFilesRevised } from '@/lib/upload-session-revision'

export const maxDuration = 60

const tokenPayloadSchema = z.object({
  sessionId: z.string().min(1),
  tenantId: z.string().min(1),
  originalFilename: z.string().min(1).optional(),
})

const blobResultSchema = z.object({
  url: z.string().url(),
  pathname: z.string().min(1),
  contentType: z.string().min(1),
})

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function getFileType(contentType: string): 'pdf' | 'excel' | 'image' | 'other' {
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.includes('excel') || contentType.includes('spreadsheetml')) return 'excel'
  if (contentType.startsWith('image/')) return 'image'
  return 'other'
}

function parseClientPayload(clientPayload: string): {
  rawToken: string
  originalFilename?: string
} {
  try {
    const parsed = z
      .object({
        rawToken: z.string().min(1),
        originalFilename: z.string().min(1).optional(),
      })
      .safeParse(JSON.parse(clientPayload))

    if (parsed.success) return parsed.data
  } catch {
    // Older clients sent the raw token directly.
  }

  return { rawToken: clientPayload }
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw new Error('세션 토큰이 누락되었습니다')

        const payload = parseClientPayload(clientPayload)
        const session = await verifyToken(payload.rawToken)
        if (!session) throw new Error('유효하지 않거나 만료된 세션입니다')
        if (!isMutableUploadSessionStatus(session.status)) {
          throw new Error('이미 완료된 요청은 파일을 추가할 수 없습니다')
        }

        if (payload.originalFilename) {
          const existingRows = await db
            .select({ id: uploadFile.id })
            .from(uploadFile)
            .where(
              and(
                eq(uploadFile.uploadSessionId, session.id),
                eq(uploadFile.tenantId, session.tenantId),
                eq(uploadFile.originalFilename, payload.originalFilename),
              ),
            )
            .limit(1)

          if (existingRows.length > 0) {
            throw new Error('이미 업로드한 파일입니다. 아래 업로드한 파일 목록을 확인해 주세요.')
          }
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            sessionId: session.id,
            tenantId: session.tenantId,
            originalFilename: payload.originalFilename,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const blobParsed = blobResultSchema.safeParse(blob)
        if (!blobParsed.success) {
          throw new Error(`Blob 응답 형식이 올바르지 않습니다: ${blobParsed.error.message}`)
        }

        const payloadParsed = tokenPayloadSchema.safeParse(
          JSON.parse(tokenPayload ?? '{}'),
        )
        if (!payloadParsed.success) {
          throw new Error('tokenPayload 형식이 올바르지 않습니다')
        }
        const { sessionId, tenantId, originalFilename } = payloadParsed.data
        const { url, pathname, contentType } = blobParsed.data

        const blobContent = await get(url, { access: 'private' })
        if (!blobContent || blobContent.statusCode !== 200) {
          throw new Error('업로드 파일을 Blob에서 다시 읽을 수 없습니다')
        }

        const buffer = await new Response(blobContent.stream).arrayBuffer()
        const contentHash = createHash('sha256').update(Buffer.from(buffer)).digest('hex')

        const fileId = crypto.randomUUID()

        await db.insert(uploadFile).values({
          id: fileId,
          uploadSessionId: sessionId,
          tenantId,
          originalFilename: originalFilename ?? pathname.split('/').pop() ?? pathname,
          storageKey: url,
          fileType: getFileType(contentType),
          fileSize: buffer.byteLength,
          contentHash,
          status: 'uploaded',
          uploadedAt: toDBString(now()),
        })

        await markSessionFilesRevised({
          sessionId,
          tenantId,
          hasFiles: true,
        })

        after(async () => {
          // payroll 세션은 일반 AI 파일 분석 건너뜀 — 결과 엑셀표 작성이 핵심 흐름
          const sessionRow = await db
            .select({ requestKind: uploadSession.requestKind })
            .from(uploadSession)
            .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
            .limit(1)

          if (sessionRow[0]?.requestKind !== 'payroll') {
            try {
              const { analyzeFileAndMaybeFinalize } = await import('@/lib/ai/process')
              await analyzeFileAndMaybeFinalize(fileId, tenantId)
            } catch (err) {
              console.error(`[upload] 분석 실패 (${fileId}):`, err)
            }
          }

          // Giwa Chain proof — dynamic import으로 업로드 토큰 발급 경로 보호 (API 경계 원칙)
          try {
            const { submitFileReceivedProof } = await import('@/lib/services/proof-service')
            await submitFileReceivedProof({
              uploadFileId: fileId,
              uploadSessionId: sessionId,
              tenantId,
              contentHash,
              receivedAt: Math.floor(now().toSeconds()),
            })
          } catch (err) {
            console.error(`[upload] Giwa proof 실패 (non-fatal, fileId=${fileId}):`, err)
          }
        })
      },
    })

    return Response.json(jsonResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : '업로드 토큰 처리 중 알 수 없는 오류가 발생했습니다'
    console.warn('[POST /api/upload] token/upload callback failed:', message)
    return new Response(message, { status: 400 })
  }
}

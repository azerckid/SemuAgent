import { del } from '@vercel/blob'
import { and, eq, inArray } from 'drizzle-orm'
import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  analysisRun,
  auditProof,
  materialMatch,
  requestItemValidation,
  requestItemValidationFile,
  uploadFile,
} from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'
import { isMutableUploadSessionStatus, markSessionFilesRevised } from '@/lib/upload-session-revision'

const deleteUploadFileSchema = z.object({
  rawToken: z.string().min(1),
})

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const body = await req.json().catch(() => null)
  const parsed = deleteUploadFileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const session = await verifyToken(parsed.data.rawToken)
  if (!session) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 세션입니다' }, { status: 401 })
  }
  if (!isMutableUploadSessionStatus(session.status)) {
    return NextResponse.json({ error: '이미 완료된 요청은 파일을 삭제할 수 없습니다' }, { status: 409 })
  }

  const { fileId } = await params
  const fileRows = await db
    .select({
      id: uploadFile.id,
      storageKey: uploadFile.storageKey,
    })
    .from(uploadFile)
    .where(
      and(
        eq(uploadFile.id, fileId),
        eq(uploadFile.uploadSessionId, session.id),
        eq(uploadFile.tenantId, session.tenantId),
      ),
    )
    .limit(1)

  const file = fileRows[0]
  if (!file) {
    return NextResponse.json({ error: '삭제할 파일을 찾을 수 없습니다' }, { status: 404 })
  }

  const validationRows = await db
    .select({ id: requestItemValidation.id })
    .from(requestItemValidation)
    .where(
      and(
        eq(requestItemValidation.uploadSessionId, session.id),
        eq(requestItemValidation.tenantId, session.tenantId),
      ),
    )
  const validationIds = validationRows.map((row) => row.id)

  await db.transaction(async (tx) => {
    if (validationIds.length > 0) {
      await tx
        .delete(requestItemValidationFile)
        .where(
          and(
            eq(requestItemValidationFile.tenantId, session.tenantId),
            inArray(requestItemValidationFile.validationId, validationIds),
          ),
        )
      await tx
        .delete(requestItemValidation)
        .where(
          and(
            eq(requestItemValidation.tenantId, session.tenantId),
            eq(requestItemValidation.uploadSessionId, session.id),
          ),
        )
    }

    await tx
      .delete(materialMatch)
      .where(and(eq(materialMatch.uploadFileId, file.id), eq(materialMatch.tenantId, session.tenantId)))
    await tx
      .delete(analysisRun)
      .where(and(eq(analysisRun.uploadFileId, file.id), eq(analysisRun.tenantId, session.tenantId)))
    await tx
      .delete(auditProof)
      .where(and(eq(auditProof.uploadFileId, file.id), eq(auditProof.tenantId, session.tenantId)))
    await tx
      .delete(uploadFile)
      .where(and(eq(uploadFile.id, file.id), eq(uploadFile.tenantId, session.tenantId)))
  })

  try {
    await del(file.storageKey)
  } catch (err) {
    console.error(`[upload-delete] Blob 삭제 실패 (non-fatal, fileId=${file.id}):`, err)
  }

  const remainingRows = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, session.id), eq(uploadFile.tenantId, session.tenantId)))

  const nextStatus = await markSessionFilesRevised({
    sessionId: session.id,
    tenantId: session.tenantId,
    hasFiles: remainingRows.length > 0,
  })

  if (session.requestKind === 'general' && remainingRows.length > 0 && nextStatus === 'submitted') {
    after(async () => {
      try {
        const { analyzePendingSessionFiles } = await import('@/lib/ai/process')
        await analyzePendingSessionFiles(session.id, session.tenantId)
      } catch (err) {
        console.error(`[upload-delete] 삭제 후 재분석 트리거 실패 (${session.id}):`, err)
      }
    })
  }

  return NextResponse.json({
    success: true,
    remainingFiles: remainingRows.length,
    status: nextStatus ?? session.status,
  })
}

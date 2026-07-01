import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { analysisRun, materialMatch, uploadFile, uploadSession } from '@/lib/db/schema'
import { analyzeFile } from './analyze'

export async function cancelRunningSessionAnalysis(
  sessionId: string,
  tenantId: string,
): Promise<{ cancelledFiles: number; status: string | null }> {
  const sessions = await db
    .select({ status: uploadSession.status })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = sessions[0]
  if (!session) return { cancelledFiles: 0, status: null }

  const pendingFiles = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(
      and(
        eq(uploadFile.uploadSessionId, sessionId),
        eq(uploadFile.tenantId, tenantId),
        inArray(uploadFile.status, ['uploaded', 'analyzing']),
      ),
    )

  await db.transaction(async (tx) => {
    if (pendingFiles.length > 0) {
      await tx
        .update(uploadFile)
        .set({ status: 'failed' })
        .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.id, pendingFiles.map((file) => file.id))))
    }

    if (session.status === 'ai_checking') {
      await tx
        .update(uploadSession)
        .set({ status: 'submitted' })
        .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    }
  })

  return {
    cancelledFiles: pendingFiles.length,
    status: session.status === 'ai_checking' ? 'submitted' : session.status,
  }
}

export async function analyzeFileAndMaybeFinalize(
  fileId: string,
  tenantId: string,
  opts?: { overrideBuffer?: ArrayBuffer },
): Promise<void> {
  await analyzeFile(fileId, tenantId, opts)
  await finalizeSubmittedSessionIfReady(fileId, tenantId)
}

export async function analyzePendingSessionFiles(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  const files = await db
    .select({ id: uploadFile.id, status: uploadFile.status })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  for (const file of files) {
    if (file.status !== 'uploaded') continue

    try {
      await analyzeFileAndMaybeFinalize(file.id, tenantId)
    } catch (err) {
      console.error(`[analysis-process] 파일 분석 실패 (${file.id}):`, err)
    }
  }

  await finalizeSessionIfReady(sessionId, tenantId)
}

export async function reanalyzeSessionFiles(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  const files = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  if (files.length === 0) return
  const fileIds = files.map((file) => file.id)

  await db.transaction(async (tx) => {
    await tx
      .delete(materialMatch)
      .where(and(eq(materialMatch.tenantId, tenantId), inArray(materialMatch.uploadFileId, fileIds)))
    await tx
      .delete(analysisRun)
      .where(and(eq(analysisRun.tenantId, tenantId), inArray(analysisRun.uploadFileId, fileIds)))
    await tx
      .update(uploadFile)
      .set({ status: 'uploaded' })
      .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.id, fileIds)))
  })

  for (const file of files) {
    try {
      await analyzeFile(file.id, tenantId)
    } catch (err) {
      console.error(`[analysis-process] 파일 재분석 실패 (${file.id}):`, err)
    }
  }
}

async function finalizeSubmittedSessionIfReady(
  fileId: string,
  tenantId: string,
): Promise<void> {
  const fileRows = await db
    .select({
      uploadSessionId: uploadFile.uploadSessionId,
      sessionStatus: uploadSession.status,
    })
    .from(uploadFile)
    .innerJoin(uploadSession, eq(uploadFile.uploadSessionId, uploadSession.id))
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    .limit(1)

  const row = fileRows[0]
  if (!row || row.sessionStatus !== 'submitted') return

  await finalizeSessionIfReady(row.uploadSessionId, tenantId)
}

async function finalizeSessionIfReady(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  const pendingRows = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(
      and(
        eq(uploadFile.uploadSessionId, sessionId),
        eq(uploadFile.tenantId, tenantId),
        inArray(uploadFile.status, ['uploaded', 'analyzing']),
      ),
    )
    .limit(1)

  if (pendingRows.length > 0) return

  const sessionRows = await db
    .select({
      status: uploadSession.status,
      requestKind: uploadSession.requestKind,
      createdByStaffId: uploadSession.createdByStaffId,
    })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = sessionRows[0]
  if (session?.status !== 'submitted') return

  try {
    const { runSessionEvaluationPipeline } = await import('@/lib/ai/run-session-evaluation')
    const outcome = await runSessionEvaluationPipeline(sessionId, tenantId)
    if (!outcome.ok) {
      console.error(`[process] 세션 평가 실패 (${sessionId}):`, outcome)
      return
    }
    if (session.requestKind === 'general') {
      const { runBookkeepingDraftPipelineAfterEvaluation } = await import('@/lib/bookkeeping/automatic-review-progression')
      await runBookkeepingDraftPipelineAfterEvaluation({
        sessionId,
        tenantId,
        staffId: session.createdByStaffId,
        logSource: 'analysis-process',
      })
    }
  } catch (err) {
    console.error(`[process] 평가 또는 보충 요청 초안 생성 실패 (${sessionId}):`, err)
  }
}

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollExtractionBatch, payrollExtractionRow, uploadFile, uploadSession } from '@/lib/db/schema'
import { getPayrollAdaptiveStructuringEligibility } from './adaptive-structuring-eligibility'

export type PayrollAdaptiveStructuringEligibilityContext = {
  session: typeof uploadSession.$inferSelect
  sourceFiles: Array<typeof uploadFile.$inferSelect>
  eligibility: ReturnType<typeof getPayrollAdaptiveStructuringEligibility>
}

// Slice 1의 eligibility 입력(batch status, pass/fail row 수, 비밀번호 상태)을 클라이언트가
// 아니라 서버가 세션 id만으로 직접 다시 계산한다. 클라이언트가 보낸 eligibility/fileId를
// 신뢰하지 않는다.
export async function loadPayrollAdaptiveStructuringEligibilityContext(params: {
  sessionId: string
  tenantId: string
}): Promise<PayrollAdaptiveStructuringEligibilityContext | null> {
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

  const latestBatchRows = await db
    .select()
    .from(payrollExtractionBatch)
    .where(and(
      eq(payrollExtractionBatch.uploadSessionId, sessionId),
      eq(payrollExtractionBatch.tenantId, tenantId),
    ))
    .orderBy(desc(payrollExtractionBatch.createdAt))
    .limit(1)

  const batch = latestBatchRows[0] ?? null

  const rows = batch
    ? await db
      .select({ aiVerdict: payrollExtractionRow.aiVerdict })
      .from(payrollExtractionRow)
      .where(and(
        eq(payrollExtractionRow.batchId, batch.id),
        eq(payrollExtractionRow.tenantId, tenantId),
      ))
    : []

  const eligibility = getPayrollAdaptiveStructuringEligibility({
    hasFiles: sourceFiles.length > 0,
    hasPasswordBlockedFile: sourceFiles.some(
      (file) => file.passwordStatus === 'required' || file.passwordStatus === 'invalid',
    ),
    batchStatus: batch?.status ?? null,
    batchErrorMessage: batch?.errorMessage ?? null,
    passCount: rows.filter((row) => row.aiVerdict === 'pass').length,
    failCount: rows.filter((row) => row.aiVerdict === 'fail').length,
  })

  return { session, sourceFiles, eligibility }
}

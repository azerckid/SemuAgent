import { del } from '@vercel/blob'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollExcelDraft, uploadFile } from '@/lib/db/schema'

type DeleteSessionBlobObjectsParams = {
  tenantId: string
  sessionIds: string[]
}

export async function deleteSessionBlobObjects({
  tenantId,
  sessionIds,
}: DeleteSessionBlobObjectsParams) {
  if (sessionIds.length === 0) return { deletedBlobCount: 0 }

  const [files, payrollDrafts] = await Promise.all([
    db
      .select({ storageKey: uploadFile.storageKey })
      .from(uploadFile)
      .where(and(
        eq(uploadFile.tenantId, tenantId),
        inArray(uploadFile.uploadSessionId, sessionIds),
      )),
    db
      .select({ storageKey: payrollExcelDraft.storageKey })
      .from(payrollExcelDraft)
      .where(and(
        eq(payrollExcelDraft.tenantId, tenantId),
        inArray(payrollExcelDraft.uploadSessionId, sessionIds),
      )),
  ])

  const blobUrls = Array.from(new Set([
    ...files.map((file) => file.storageKey),
    ...payrollDrafts.map((draft) => draft.storageKey),
  ].filter((url): url is string => Boolean(url))))

  if (blobUrls.length === 0) return { deletedBlobCount: 0 }

  await del(blobUrls)

  return { deletedBlobCount: blobUrls.length }
}

type DeleteSupersededPayrollDraftBlobsParams = {
  tenantId: string
  uploadSessionId: string
  keepDraftId: string
}

export async function deleteSupersededPayrollDraftBlobs({
  tenantId,
  uploadSessionId,
  keepDraftId,
}: DeleteSupersededPayrollDraftBlobsParams) {
  const supersededDrafts = await db
    .select({
      id: payrollExcelDraft.id,
      storageKey: payrollExcelDraft.storageKey,
    })
    .from(payrollExcelDraft)
    .where(and(
      eq(payrollExcelDraft.tenantId, tenantId),
      eq(payrollExcelDraft.uploadSessionId, uploadSessionId),
      ne(payrollExcelDraft.id, keepDraftId),
    ))

  const blobUrls = Array.from(new Set(
    supersededDrafts
      .map((draft) => draft.storageKey)
      .filter((url): url is string => Boolean(url)),
  ))

  if (blobUrls.length === 0) {
    return { deletedBlobCount: 0, clearedDraftCount: 0 }
  }

  await del(blobUrls)

  await db
    .update(payrollExcelDraft)
    .set({
      storageKey: null,
      errorMessage: '새 결과 엑셀 초안 생성으로 이전 Blob 파일을 정리했습니다.',
    })
    .where(and(
      eq(payrollExcelDraft.tenantId, tenantId),
      eq(payrollExcelDraft.uploadSessionId, uploadSessionId),
      ne(payrollExcelDraft.id, keepDraftId),
    ))

  return {
    deletedBlobCount: blobUrls.length,
    clearedDraftCount: supersededDrafts.length,
  }
}

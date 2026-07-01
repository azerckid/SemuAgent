import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadItemDeclaration } from '@/lib/db/schema'

export type UploadItemDeclarationKind = 'none' | 'later'

export type SessionItemDeclaration = {
  checklistItemId: string
  declaration: UploadItemDeclarationKind
  note: string | null
}

/**
 * 한 세션의 자료 항목 선언(없음/나중에)을 조회한다.
 * 고객 포털(올린 항목 상태)과 자료검토 담당자 화면이 같은 소스를 쓴다.
 */
export async function listSessionItemDeclarations(params: {
  tenantId: string
  uploadSessionId: string
}): Promise<SessionItemDeclaration[]> {
  const rows = await db
    .select({
      checklistItemId: uploadItemDeclaration.checklistItemId,
      declaration: uploadItemDeclaration.declaration,
      note: uploadItemDeclaration.note,
    })
    .from(uploadItemDeclaration)
    .where(
      and(
        eq(uploadItemDeclaration.tenantId, params.tenantId),
        eq(uploadItemDeclaration.uploadSessionId, params.uploadSessionId),
      ),
    )

  return rows.map((row) => ({
    checklistItemId: row.checklistItemId,
    declaration: row.declaration,
    note: row.note,
  }))
}

/**
 * 항목에 파일이 매칭(접수)되면 그 항목의 없음/나중에 선언을 자동 해제한다.
 * "없음이라 했는데 파일이 있는" 모순 상태가 남지 않게 한다.
 */
export async function clearUploadItemDeclaration(params: {
  tenantId: string
  uploadSessionId: string
  checklistItemId: string
}): Promise<void> {
  await db
    .delete(uploadItemDeclaration)
    .where(
      and(
        eq(uploadItemDeclaration.tenantId, params.tenantId),
        eq(uploadItemDeclaration.uploadSessionId, params.uploadSessionId),
        eq(uploadItemDeclaration.checklistItemId, params.checklistItemId),
      ),
    )
}

import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  uploadSession,
  uploadFile,
  materialMatch,
  clientChecklist,
  checklistTemplate,
  checklistItem,
} from '@/lib/db/schema'


type SatisfiedStatus = 'matched' | 'manual_approved'
const SATISFIED_STATUSES: SatisfiedStatus[] = ['matched', 'manual_approved']

export async function checkAndCompleteSession(
  sessionId: string,
  tenantId: string,
): Promise<boolean> {
  const sessionRows = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = sessionRows[0]
  if (!session || session.status === 'completed') return false

  // 필수 체크리스트 항목 조회
  const requiredItemRows = await db
    .select({ item: checklistItem })
    .from(clientChecklist)
    .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
    .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
    .where(
      and(
        eq(clientChecklist.clientId, session.clientId),
        eq(clientChecklist.tenantId, tenantId),
        eq(checklistItem.required, true),
      ),
    )

  if (requiredItemRows.length === 0) return false

  // 이 세션의 파일 ID 목록
  const files = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  if (files.length === 0) return false

  // 충족된 매칭 조회
  const satisfiedMatches = await db
    .select()
    .from(materialMatch)
    .where(
      and(
        inArray(
          materialMatch.uploadFileId,
          files.map((f) => f.id),
        ),
        eq(materialMatch.tenantId, tenantId),
        inArray(materialMatch.status, [...SATISFIED_STATUSES]),
      ),
    )

  const satisfiedItemIds = new Set(satisfiedMatches.map((m) => m.checklistItemId))
  const requiredItemIds = requiredItemRows.map((r) => r.item.id)
  const allSatisfied = requiredItemIds.every((id) => satisfiedItemIds.has(id))

  if (!allSatisfied) return false

  await db
    .update(uploadSession)
    .set({ status: 'ready_for_accountant' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

  console.info(`[completion] Session ${sessionId} marked as ready_for_accountant`)

  return true
}

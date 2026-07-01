import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  checklistItem,
  checklistTemplate,
  clientChecklist,
  uploadItemDeclaration,
} from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'
import { now, toDBString } from '@/lib/time'

const declarationSchema = z.object({
  rawToken: z.string().min(1),
  checklistItemId: z.string().min(1),
  // null = 선언 취소(삭제)
  declaration: z.enum(['none', 'later']).nullable(),
  note: z.string().trim().max(200).optional(),
})

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  const parsed = declarationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }
  const { rawToken, checklistItemId, declaration, note } = parsed.data

  // verifyToken은 만료/취소/기한 경과 세션을 null로 거른다. 추가로 완료 세션만 막는다.
  const session = await verifyToken(rawToken)
  if (!session) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 세션입니다' }, { status: 401 })
  }
  if (session.status === 'completed') {
    return NextResponse.json({ error: '완료된 요청은 변경할 수 없습니다' }, { status: 409 })
  }

  // 이 체크리스트 항목이 세션 고객사의 체크리스트에 속하는지 확인(테넌트/고객 격리).
  const itemRows = await db
    .select({ id: checklistItem.id })
    .from(checklistItem)
    .innerJoin(checklistTemplate, eq(checklistItem.templateId, checklistTemplate.id))
    .innerJoin(
      clientChecklist,
      and(
        eq(clientChecklist.templateId, checklistTemplate.id),
        eq(clientChecklist.clientId, session.clientId),
        eq(clientChecklist.tenantId, session.tenantId),
      ),
    )
    .where(and(eq(checklistItem.id, checklistItemId), eq(checklistItem.tenantId, session.tenantId)))
    .limit(1)

  if (itemRows.length === 0) {
    return NextResponse.json({ error: '요청한 자료 항목을 찾을 수 없습니다' }, { status: 404 })
  }

  const existing = await db
    .select()
    .from(uploadItemDeclaration)
    .where(
      and(
        eq(uploadItemDeclaration.tenantId, session.tenantId),
        eq(uploadItemDeclaration.uploadSessionId, session.id),
        eq(uploadItemDeclaration.checklistItemId, checklistItemId),
      ),
    )
    .limit(1)

  // 선언 취소
  if (declaration === null) {
    if (existing.length > 0) {
      await db
        .delete(uploadItemDeclaration)
        .where(and(eq(uploadItemDeclaration.id, existing[0].id), eq(uploadItemDeclaration.tenantId, session.tenantId)))
    }
    return NextResponse.json({ declaration: null })
  }

  const timestamp = toDBString(now())
  const trimmedNote = note?.trim() || null

  if (existing.length > 0) {
    await db
      .update(uploadItemDeclaration)
      .set({ declaration, note: trimmedNote, updatedAt: timestamp })
      .where(and(eq(uploadItemDeclaration.id, existing[0].id), eq(uploadItemDeclaration.tenantId, session.tenantId)))
  } else {
    await db.insert(uploadItemDeclaration).values({
      id: randomUUID(),
      tenantId: session.tenantId,
      uploadSessionId: session.id,
      checklistItemId,
      declaration,
      note: trimmedNote,
      declaredAt: timestamp,
      updatedAt: timestamp,
    })
  }

  return NextResponse.json({ declaration: { checklistItemId, declaration, note: trimmedNote } })
}

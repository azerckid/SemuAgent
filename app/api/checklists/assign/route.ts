import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientChecklist, client, checklistTemplate } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { assignTemplateSchema } from '@/lib/validations/checklist'
import { now, toDBString } from '@/lib/time'

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = assignTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { clientId, templateId } = parsed.data

    const [clientRow, templateRow] = await Promise.all([
      db.select({ id: client.id }).from(client)
        .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId))).limit(1),
      db.select({ id: checklistTemplate.id }).from(checklistTemplate)
        .where(and(eq(checklistTemplate.id, templateId), eq(checklistTemplate.tenantId, tenantId))).limit(1),
    ])

    if (!clientRow[0]) return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다' }, { status: 404 })
    if (!templateRow[0]) return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })

    // 기존 배정 삭제 후 재배정
    await db.delete(clientChecklist).where(
      and(eq(clientChecklist.clientId, clientId), eq(clientChecklist.tenantId, tenantId)),
    )

    await db.insert(clientChecklist).values({
      id: crypto.randomUUID(),
      tenantId,
      clientId,
      templateId,
      createdAt: toDBString(now()),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/checklists/assign]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

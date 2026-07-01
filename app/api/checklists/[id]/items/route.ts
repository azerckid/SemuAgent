import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { checklistTemplate, checklistItem } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { createItemSchema } from '@/lib/validations/checklist'
import { now, toDBString } from '@/lib/time'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: templateId } = await params

    const templateRows = await db
      .select({ id: checklistTemplate.id })
      .from(checklistTemplate)
      .where(and(eq(checklistTemplate.id, templateId), eq(checklistTemplate.tenantId, tenantId)))
      .limit(1)

    if (!templateRows[0]) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = createItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const itemId = crypto.randomUUID()
    await db.insert(checklistItem).values({
      id: itemId,
      tenantId,
      templateId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      required: parsed.data.required,
      sortOrder: parsed.data.sortOrder,
      createdAt: toDBString(now()),
    })

    return NextResponse.json({ id: itemId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/checklists/[id]/items]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

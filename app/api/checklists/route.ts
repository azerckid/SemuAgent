import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { checklistTemplate, checklistItem, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { createTemplateSchema } from '@/lib/validations/checklist'
import { now, toDBString } from '@/lib/time'

async function requireTenantAdmin(userId: string, tenantId: string) {
  const rows = await db
    .select({ role: staff.role, id: staff.id })
    .from(staff)
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId)))
    .limit(1)
  const record = rows[0]
  if (!record || record.role !== 'TENANT_ADMIN') return null
  return record
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const templates = await db
      .select()
      .from(checklistTemplate)
      .where(eq(checklistTemplate.tenantId, tenantId))

    const items = await db
      .select()
      .from(checklistItem)
      .where(eq(checklistItem.tenantId, tenantId))

    const result = templates.map((t) => ({
      ...t,
      items: items.filter((i) => i.templateId === t.id).sort((a, b) => a.sortOrder - b.sortOrder),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/checklists]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    if (!await requireTenantAdmin(user.id, tenantId)) {
      return NextResponse.json({ error: '자료관리기준 생성은 관리자만 가능합니다' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const id = crypto.randomUUID()
    await db.insert(checklistTemplate).values({
      id,
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      createdAt: toDBString(now()),
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/checklists]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

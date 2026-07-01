import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { checklistItem, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { itemId } = await params

    const staffRows = await db
      .select({ role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (staffRows[0]?.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: '자료관리기준 항목 삭제는 관리자만 가능합니다' }, { status: 403 })
    }

    await db
      .delete(checklistItem)
      .where(and(eq(checklistItem.id, itemId), eq(checklistItem.tenantId, tenantId)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/checklists/[id]/items/[itemId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

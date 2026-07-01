import { del } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientDocument, staff } from '@/lib/db/schema'

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

/**
 * 고객사 문서 삭제. 배정 담당자(client.staffId) 또는 TENANT_ADMIN만 가능.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: clientId, documentId } = await params

    const [me] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [row] = await db
      .select({ documentId: clientDocument.id, storageKey: clientDocument.storageKey, staffId: client.staffId })
      .from(clientDocument)
      .innerJoin(client, and(eq(clientDocument.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(
        and(
          eq(clientDocument.id, documentId),
          eq(clientDocument.clientId, clientId),
          eq(clientDocument.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (!row) {
      return Response.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 })
    }
    if (me.role !== 'TENANT_ADMIN' && row.staffId !== me.id) {
      return Response.json({ error: '이 고객사의 담당자 또는 관리자만 삭제할 수 있습니다' }, { status: 403 })
    }

    await db
      .delete(clientDocument)
      .where(and(eq(clientDocument.id, documentId), eq(clientDocument.tenantId, tenantId)))

    try {
      await del(row.storageKey)
    } catch (err) {
      console.error('[DELETE /api/clients/[id]/documents/[documentId]] blob delete failed (non-fatal):', err)
    }

    return Response.json({ success: true })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[DELETE /api/clients/[id]/documents/[documentId]]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

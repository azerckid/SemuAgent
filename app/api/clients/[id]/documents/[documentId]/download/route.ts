import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientDocument, staff } from '@/lib/db/schema'

function contentDisposition(filename: string) {
  const fallback = filename
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 120) || 'client-document'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

/**
 * 고객사 문서 다운로드. 조회/다운로드는 같은 테넌트 직원 누구나 가능
 * (업로드/삭제만 배정 담당자 또는 TENANT_ADMIN으로 제한).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: clientId, documentId } = await params

    const [me] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [row] = await db
      .select({ document: clientDocument })
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
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const blob = await get(row.document.storageKey, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return Response.json({ error: '문서를 가져올 수 없습니다' }, { status: 502 })
    }

    const buffer = await new Response(blob.stream).arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': blob.blob.contentType ?? row.document.contentType ?? 'application/octet-stream',
        'Content-Disposition': contentDisposition(row.document.originalFilename),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[GET /api/clients/[id]/documents/[documentId]/download]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

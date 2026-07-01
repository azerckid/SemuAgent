import { eq, and } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { uploadSession } from '@/lib/db/schema'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let tenantId: string
  try {
    ;({ tenantId } = await requireTenantSession())
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
  const { id: sessionId } = await params

  const rows = await db
    .select({ status: uploadSession.status })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  if (!rows[0]) return new Response('Not found', { status: 404 })

  // ai_checking 상태일 때만 submitted로 복구
  if (rows[0].status !== 'ai_checking') {
    return Response.json({ status: rows[0].status })
  }

  await db
    .update(uploadSession)
    .set({ status: 'submitted' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

  return Response.json({ ok: true, status: 'submitted' })
}

import { requireTenantSession } from '@/lib/auth-helpers'
import { cancelRunningSessionAnalysis } from '@/lib/ai/process'

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
  const result = await cancelRunningSessionAnalysis(sessionId, tenantId)

  if (result.status === null) {
    return new Response('Not found', { status: 404 })
  }

  return Response.json({
    ok: true,
    status: result.status,
    cancelledFiles: result.cancelledFiles,
  })
}

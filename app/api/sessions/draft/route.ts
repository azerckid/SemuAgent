import { z } from 'zod'

export const maxDuration = 60

const bodySchema = z.object({
  sessionId: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (!internalSecret || req.headers.get('authorization') !== `Bearer ${internalSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response('Invalid request body', { status: 400 })
  }

  const { sessionId, tenantId } = parsed.data

  try {
    const { generateMissingRequestDraft } = await import('@/lib/email/missing-request')
    await generateMissingRequestDraft(sessionId, tenantId)
  } catch (err) {
    console.error('[POST /api/sessions/draft]', err)
    return new Response('Draft generation failed', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

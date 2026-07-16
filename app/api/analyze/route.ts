import { z } from 'zod'
import { analyzeFileAndMaybeFinalize } from '@/lib/ai/process'
import { safeSecretEqual } from '@/lib/security/constant-time'

export const maxDuration = 60

const bodySchema = z.object({
  fileId: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  // 내부 API 인증 — secret 미설정 시에도 차단 (선택적 인증은 인증이 아님)
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (!internalSecret || !safeSecretEqual(req.headers.get('authorization'), `Bearer ${internalSecret}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response('Invalid request body', { status: 400 })
  }

  const { fileId, tenantId } = parsed.data

  try {
    await analyzeFileAndMaybeFinalize(fileId, tenantId)
  } catch (err) {
    console.error('[POST /api/analyze]', err)
    return new Response('Analysis failed', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

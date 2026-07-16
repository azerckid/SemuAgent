import { requireTenantSession } from '@/lib/auth-helpers'
import {
  handleSebiseoChat,
  SebiseoRateLimitError,
} from '@/lib/sebiseo/chat/handle-chat'
import { SEBISEO_CHAT_RATE_LIMIT_ANSWER } from '@/lib/sebiseo/chat/refusal'
import {
  sebiseoChatRequestSchema,
  sebiseoChatResponseSchema,
} from '@/lib/sebiseo/chat/schemas'

export async function POST(req: Request) {
  try {
    const { tenantId, user } = await requireTenantSession()
    const body = await req.json()
    const parsed = sebiseoChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const response = await handleSebiseoChat(parsed.data, {
      tenantId,
      userId: user.id,
    })
    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Error
      && (error.message === 'Unauthorized' || error.message.startsWith('No active tenant'))
    ) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof SebiseoRateLimitError) {
      return Response.json(
        sebiseoChatResponseSchema.parse({
          status: 'error',
          answer: SEBISEO_CHAT_RATE_LIMIT_ANSWER,
          suggestedActions: [],
        }),
        { status: 429 },
      )
    }

    console.info('[POST /api/sebiseo/chat]', JSON.stringify({
      event: 'route_error',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
    return Response.json({ error: 'Sebiseo chat request failed' }, { status: 500 })
  }
}

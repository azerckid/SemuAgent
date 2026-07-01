import { requireTenantSession } from '@/lib/auth-helpers'
import {
  handleUsageHelpChat,
  UsageHelpRateLimitError,
} from '@/lib/usage-help/handle-usage-chat'
import { sanitizeUsageHelpRoutePath } from '@/lib/usage-help/route-hint'
import { resolveRouteSuggestedQuestions } from '@/lib/usage-help/route-context'
import { USAGE_HELP_RATE_LIMIT_ANSWER } from '@/lib/usage-help/refusal-templates'
import {
  usageHelpChatRequestSchema,
  type UsageHelpChatRequest,
} from '@/lib/usage-help/schemas'

export async function POST(req: Request) {
  let request: UsageHelpChatRequest | null = null

  try {
    const { tenantId, user } = await requireTenantSession()

    const body = await req.json()
    const parsed = usageHelpChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    request = parsed.data
    const response = await handleUsageHelpChat(request, {
      tenantId,
      userId: user.id,
    })
    return Response.json(response)
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (
      err instanceof Error
      && err.message.startsWith('No active tenant')
    ) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof UsageHelpRateLimitError) {
      const routePath = sanitizeUsageHelpRoutePath(request?.routePath)
      const suggestedQuestions = resolveRouteSuggestedQuestions(routePath ?? '/dashboard').slice(0, 3)

      return Response.json(
        {
          error: 'rate_limited',
          answer: USAGE_HELP_RATE_LIMIT_ANSWER,
          suggestedQuestions,
        },
        { status: 429 },
      )
    }

    console.info('[POST /api/help/usage-chat]', JSON.stringify({
      event: 'usage_help_route_error',
      errorName: err instanceof Error ? err.name : 'UnknownError',
    }))
    return Response.json({ error: 'Usage help request failed' }, { status: 500 })
  }
}

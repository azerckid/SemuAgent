import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import {
  handleTossWebhook,
  verifyTossWebhookEndpointSecret,
} from '@/lib/billing/webhook'
import { TossPaymentsError } from '@/lib/billing/toss'
import { getTossWebhookSecretOrNull } from '@/lib/env'

export const runtime = 'nodejs'

function errorResponse(err: unknown) {
  if (err instanceof SyntaxError || err instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid Toss webhook payload' }, { status: 400 })
  }

  if (err instanceof TossPaymentsError) {
    console.error('[POST /api/billing/toss/webhook] Toss verification failed', {
      code: err.code ?? null,
      status: err.status,
      message: err.message,
    })
    return NextResponse.json(
      { error: 'Toss payment verification failed', code: err.code ?? null },
      { status: 502 },
    )
  }

  console.error('[POST /api/billing/toss/webhook]', err)
  return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
}

export async function POST(req: NextRequest) {
  const expectedSecret = getTossWebhookSecretOrNull()
  if (!verifyTossWebhookEndpointSecret({
    requestUrl: req.url,
    headers: req.headers,
    expectedSecret,
  })) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
  }

  try {
    const rawBody = await req.text()
    const result = await handleTossWebhook({
      rawBody,
      headers: req.headers,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { getResendInboundWebhookSecretOrNull } from '@/lib/env'
import {
  handleResendInboundWebhook,
  ResendInboundVerificationError,
} from '@/lib/email/inbound/resend-inbound'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Fail closed: 서명 검증 시크릿이 없으면 처리하지 않는다.
  const webhookSecret = getResendInboundWebhookSecretOrNull()
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Inbound webhook not configured' }, { status: 401 })
  }

  // Svix 서명 검증은 raw body 기준이므로 절대 JSON으로 파싱하지 않는다.
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await handleResendInboundWebhook({
      rawBody,
      headers: req.headers,
      webhookSecret,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ResendInboundVerificationError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    console.error(
      '[POST /api/email-inbound/resend]',
      JSON.stringify({ errorName: err instanceof Error ? err.name : 'UnknownError' }),
    )
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

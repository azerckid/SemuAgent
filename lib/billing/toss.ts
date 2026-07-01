import { z } from 'zod'
import { requireTossBillingEnv } from '@/lib/env'

const TOSS_API_BASE_URL = 'https://api.tosspayments.com'

const tossCardSchema = z.object({
  issuerCode: z.string().nullable().optional(),
  acquirerCode: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  cardType: z.string().nullable().optional(),
  ownerType: z.string().nullable().optional(),
}).passthrough()

export const tossBillingKeyResponseSchema = z.object({
  mId: z.string().optional(),
  customerKey: z.string(),
  authenticatedAt: z.string().optional(),
  method: z.string().optional(),
  billingKey: z.string(),
  card: tossCardSchema.nullable().optional(),
}).passthrough()

export const tossBillingChargeResponseSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  orderName: z.string().optional(),
  status: z.string(),
  method: z.string().optional(),
  totalAmount: z.number(),
  balanceAmount: z.number().optional(),
  requestedAt: z.string().optional(),
  approvedAt: z.string().nullable().optional(),
  card: tossCardSchema.nullable().optional(),
}).passthrough()

const tossCancelSchema = z.object({
  cancelAmount: z.number().optional(),
  cancelReason: z.string().optional(),
  canceledAt: z.string().optional(),
  transactionKey: z.string().optional(),
}).passthrough()

export const tossPaymentResponseSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  orderName: z.string().optional(),
  status: z.string(),
  method: z.string().nullable().optional(),
  totalAmount: z.number(),
  balanceAmount: z.number().optional(),
  requestedAt: z.string().optional(),
  approvedAt: z.string().nullable().optional(),
  card: tossCardSchema.nullable().optional(),
  cancels: z.array(tossCancelSchema).nullable().optional(),
}).passthrough()

const tossErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
}).passthrough()

export type TossBillingKeyResponse = z.infer<typeof tossBillingKeyResponseSchema>
export type TossBillingChargeResponse = z.infer<typeof tossBillingChargeResponseSchema>
export type TossPaymentResponse = z.infer<typeof tossPaymentResponseSchema>

export class TossPaymentsError extends Error {
  status: number
  code?: string
  payload: unknown

  constructor(params: {
    message: string
    status: number
    code?: string
    payload: unknown
  }) {
    super(params.message)
    this.name = 'TossPaymentsError'
    this.status = params.status
    this.code = params.code
    this.payload = params.payload
  }
}

function tossHeaders(idempotencyKey?: string) {
  const tossEnv = requireTossBillingEnv()
  const encodedSecret = Buffer.from(`${tossEnv.TOSS_SECRET_KEY}:`).toString('base64')
  return {
    Authorization: `Basic ${encodedSecret}`,
    'Content-Type': 'application/json',
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

async function parseTossResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  const payload = await readJson(response)
  if (!response.ok) {
    const parsedError = tossErrorSchema.safeParse(payload)
    const code = parsedError.success ? parsedError.data.code : undefined
    const message = parsedError.success && parsedError.data.message
      ? parsedError.data.message
      : `Toss Payments request failed (${response.status})`
    throw new TossPaymentsError({
      status: response.status,
      code,
      message,
      payload,
    })
  }

  return schema.parse(payload)
}

export async function issueTossBillingKey(params: {
  authKey: string
  customerKey: string
}): Promise<TossBillingKeyResponse> {
  const response = await fetch(`${TOSS_API_BASE_URL}/v1/billing/authorizations/issue`, {
    method: 'POST',
    headers: tossHeaders(),
    body: JSON.stringify({
      authKey: params.authKey,
      customerKey: params.customerKey,
    }),
  })

  return parseTossResponse(response, tossBillingKeyResponseSchema)
}

export async function chargeTossBillingKey(params: {
  billingKey: string
  customerKey: string
  amount: number
  orderId: string
  orderName: string
  customerEmail?: string | null
  customerName?: string | null
  idempotencyKey: string
}): Promise<TossBillingChargeResponse> {
  const response = await fetch(`${TOSS_API_BASE_URL}/v1/billing/${params.billingKey}`, {
    method: 'POST',
    headers: tossHeaders(params.idempotencyKey),
    body: JSON.stringify({
      customerKey: params.customerKey,
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
      ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
      ...(params.customerName ? { customerName: params.customerName } : {}),
    }),
  })

  return parseTossResponse(response, tossBillingChargeResponseSchema)
}

export async function retrieveTossPayment(paymentKey: string): Promise<TossPaymentResponse> {
  const response = await fetch(`${TOSS_API_BASE_URL}/v1/payments/${paymentKey}`, {
    method: 'GET',
    headers: tossHeaders(),
  })

  return parseTossResponse(response, tossPaymentResponseSchema)
}

export function tossCardSnapshot(
  response: Pick<TossBillingKeyResponse | TossBillingChargeResponse, 'method' | 'card'>,
): string {
  return JSON.stringify({
    method: response.method ?? '카드',
    card: response.card
      ? {
          issuerCode: response.card.issuerCode ?? null,
          acquirerCode: response.card.acquirerCode ?? null,
          number: response.card.number ?? null,
          cardType: response.card.cardType ?? null,
          ownerType: response.card.ownerType ?? null,
        }
      : null,
  })
}

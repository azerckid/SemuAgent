import { createHash, timingSafeEqual } from 'crypto'
import { and, desc, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  billingCustomer,
  billingInvoiceEvent,
  billingWebhookEvent,
  tenantSubscription,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type { TossPaymentResponse } from './toss'
import type { BillingInvoiceEventType, TenantSubscriptionStatus } from './subscription'

type HeaderSource = Headers | Record<string, string | string[] | undefined>

const tossWebhookBaseSchema = z.object({
  eventType: z.string().min(1),
  createdAt: z.string().optional(),
  eventId: z.string().optional(),
}).passthrough()

export const tossPaymentStatusWebhookSchema = tossWebhookBaseSchema.extend({
  eventType: z.literal('PAYMENT_STATUS_CHANGED'),
  data: z.object({
    paymentKey: z.string().min(1),
    orderId: z.string().optional(),
    status: z.string().optional(),
    totalAmount: z.number().optional(),
  }).passthrough(),
})

export const tossCancelStatusWebhookSchema = tossWebhookBaseSchema.extend({
  eventType: z.literal('CANCEL_STATUS_CHANGED'),
  data: z.object({
    paymentKey: z.string().optional(),
    orderId: z.string().optional(),
    cancelStatus: z.string().optional(),
    transactionKey: z.string().optional(),
  }).passthrough(),
})

export const tossBillingDeletedWebhookSchema = tossWebhookBaseSchema.extend({
  eventType: z.literal('BILLING_DELETED'),
  billingKey: z.string().min(1),
  reason: z.string().nullable().optional(),
})

export type TossPaymentStatusWebhook = z.infer<typeof tossPaymentStatusWebhookSchema>
export type TossCancelStatusWebhook = z.infer<typeof tossCancelStatusWebhookSchema>
export type TossBillingDeletedWebhook = z.infer<typeof tossBillingDeletedWebhookSchema>
export type TossKnownWebhook =
  | TossPaymentStatusWebhook
  | TossCancelStatusWebhook
  | TossBillingDeletedWebhook

export type TossParsedWebhook = TossKnownWebhook | z.infer<typeof tossWebhookBaseSchema>

export type TossWebhookResult = {
  ok: true
  duplicate: boolean
  eventType: string
  status: 'processed' | 'skipped'
  idempotencyKey: string
}

function eventTimestamp(): string {
  return toDBString(now())
}

function getHeader(headers: HeaderSource, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name)
  const lowerName = name.toLowerCase()
  const exactValue = headers[name] ?? headers[lowerName]
  if (Array.isArray(exactValue)) return exactValue[0] ?? null
  return exactValue ?? null
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}

export function verifyTossWebhookEndpointSecret(params: {
  requestUrl: string
  headers: HeaderSource
  expectedSecret: string | null
}): boolean {
  if (!params.expectedSecret) return true

  const urlSecret = new URL(params.requestUrl).searchParams.get('secret')
  const headerSecret = getHeader(params.headers, 'x-jaryo-toss-webhook-secret')

  return [urlSecret, headerSecret].some((candidate) => (
    typeof candidate === 'string' && safeEqual(candidate, params.expectedSecret!)
  ))
}

export function parseTossWebhookPayload(rawBody: string): TossParsedWebhook {
  const json = JSON.parse(rawBody) as unknown
  const base = tossWebhookBaseSchema.parse(json)

  if (base.eventType === 'PAYMENT_STATUS_CHANGED') {
    return tossPaymentStatusWebhookSchema.parse(json)
  }
  if (base.eventType === 'CANCEL_STATUS_CHANGED') {
    return tossCancelStatusWebhookSchema.parse(json)
  }
  if (base.eventType === 'BILLING_DELETED') {
    return tossBillingDeletedWebhookSchema.parse(json)
  }

  return base
}

export function tossWebhookIdempotencyKey(params: {
  rawBody: string
  headers: HeaderSource
  payload: TossParsedWebhook
}): string {
  const transmissionId = getHeader(params.headers, 'tosspayments-webhook-transmission-id')
  if (transmissionId) return `toss:${transmissionId}`

  if ('eventId' in params.payload && params.payload.eventId) {
    return `toss:${params.payload.eventId}`
  }

  return `toss:sha256:${createHash('sha256').update(params.rawBody).digest('hex')}`
}

function isUniqueConstraintError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const code = 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT') return true
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT')) {
    return true
  }
  if ('cause' in err && err.cause) return isUniqueConstraintError(err.cause)
  return false
}

function minimizedWebhookPayload(payload: TossParsedWebhook): string {
  if (payload.eventType === 'PAYMENT_STATUS_CHANGED') {
    const parsed = tossPaymentStatusWebhookSchema.safeParse(payload)
    if (parsed.success) {
      return JSON.stringify({
        eventType: parsed.data.eventType,
        createdAt: parsed.data.createdAt ?? null,
        paymentKey: parsed.data.data.paymentKey,
        orderId: parsed.data.data.orderId ?? null,
        status: parsed.data.data.status ?? null,
        totalAmount: parsed.data.data.totalAmount ?? null,
      })
    }
  }

  if (payload.eventType === 'CANCEL_STATUS_CHANGED') {
    const parsed = tossCancelStatusWebhookSchema.safeParse(payload)
    if (parsed.success) {
      return JSON.stringify({
        eventType: parsed.data.eventType,
        createdAt: parsed.data.createdAt ?? null,
        paymentKey: parsed.data.data.paymentKey ?? null,
        orderId: parsed.data.data.orderId ?? null,
        cancelStatus: parsed.data.data.cancelStatus ?? null,
        transactionKey: parsed.data.data.transactionKey ?? null,
      })
    }
  }

  if (payload.eventType === 'BILLING_DELETED') {
    const parsed = tossBillingDeletedWebhookSchema.safeParse(payload)
    if (parsed.success) {
      return JSON.stringify({
        eventType: parsed.data.eventType,
        createdAt: parsed.data.createdAt ?? null,
        reason: parsed.data.reason ?? null,
      })
    }
  }

  return JSON.stringify({
    eventType: payload.eventType,
    createdAt: payload.createdAt ?? null,
  })
}

function paymentEventPayload(payment: TossPaymentResponse): string {
  return JSON.stringify({
    paymentKey: payment.paymentKey,
    orderId: payment.orderId,
    status: payment.status,
    method: payment.method ?? null,
    totalAmount: payment.totalAmount,
    balanceAmount: payment.balanceAmount ?? null,
    requestedAt: payment.requestedAt ?? null,
    approvedAt: payment.approvedAt ?? null,
    cancels: payment.cancels?.map((cancel) => ({
      cancelAmount: cancel.cancelAmount ?? null,
      cancelReason: cancel.cancelReason ?? null,
      canceledAt: cancel.canceledAt ?? null,
      transactionKey: cancel.transactionKey ?? null,
    })) ?? null,
  })
}

function mapPaymentStatus(status: string): {
  eventType: BillingInvoiceEventType
  eventStatus: 'pending' | 'succeeded' | 'failed' | 'skipped'
  subscriptionStatus?: TenantSubscriptionStatus
} {
  if (status === 'DONE') {
    return { eventType: 'payment_status_changed', eventStatus: 'succeeded' }
  }
  if (status === 'CANCELED') {
    return { eventType: 'payment_canceled', eventStatus: 'succeeded' }
  }
  if (status === 'PARTIAL_CANCELED') {
    return { eventType: 'payment_partially_canceled', eventStatus: 'succeeded' }
  }
  if (status === 'ABORTED' || status === 'EXPIRED') {
    return { eventType: 'charge_failed', eventStatus: 'failed', subscriptionStatus: 'past_due' }
  }
  return { eventType: 'payment_status_changed', eventStatus: 'pending' }
}

function providerEventIdForPayload(payload: TossParsedWebhook, headers: HeaderSource): string | null {
  return (
    getHeader(headers, 'tosspayments-webhook-transmission-id') ??
    ('eventId' in payload ? payload.eventId ?? null : null)
  )
}

function parseRetriedCount(headers: HeaderSource): number | null {
  const value = getHeader(headers, 'tosspayments-webhook-transmission-retried-count')
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export async function handleTossWebhook(params: {
  rawBody: string
  headers: HeaderSource
}): Promise<TossWebhookResult> {
  const payload = parseTossWebhookPayload(params.rawBody)
  const idempotencyKey = tossWebhookIdempotencyKey({
    rawBody: params.rawBody,
    headers: params.headers,
    payload,
  })
  const timestamp = eventTimestamp()
  const webhookId = crypto.randomUUID()
  const { db } = await import('@/lib/db')

  try {
    await db.insert(billingWebhookEvent).values({
      id: webhookId,
      provider: 'toss_payments',
      idempotencyKey,
      eventType: payload.eventType,
      status: 'received',
      providerEventId: providerEventIdForPayload(payload, params.headers),
      transmissionId: getHeader(params.headers, 'tosspayments-webhook-transmission-id'),
      transmissionTime: getHeader(params.headers, 'tosspayments-webhook-transmission-time'),
      retriedCount: parseRetriedCount(params.headers),
      providerPayload: minimizedWebhookPayload(payload),
      receivedAt: timestamp,
      createdAt: timestamp,
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return {
        ok: true,
        duplicate: true,
        eventType: payload.eventType,
        status: 'skipped',
        idempotencyKey,
      }
    }
    throw err
  }

  try {
    const paymentStatusPayload = tossPaymentStatusWebhookSchema.safeParse(payload)
    const cancelStatusPayload = tossCancelStatusWebhookSchema.safeParse(payload)
    const billingDeletedPayload = tossBillingDeletedWebhookSchema.safeParse(payload)

    if (paymentStatusPayload.success) {
      await processPaymentStatusWebhook(webhookId, paymentStatusPayload.data, idempotencyKey)
    } else if (cancelStatusPayload.success) {
      await processCancelStatusWebhook(webhookId, cancelStatusPayload.data, idempotencyKey)
    } else if (billingDeletedPayload.success) {
      await processBillingDeletedWebhook(webhookId, billingDeletedPayload.data, idempotencyKey)
    } else {
      await markWebhookSkipped(webhookId, 'Unsupported Toss webhook event type')
      return {
        ok: true,
        duplicate: false,
        eventType: payload.eventType,
        status: 'skipped',
        idempotencyKey,
      }
    }
  } catch (err) {
    const failedAt = eventTimestamp()
    await db
      .update(billingWebhookEvent)
      .set({
        status: 'failed',
        providerMessage: err instanceof Error ? err.message : 'Unknown webhook processing error',
        processedAt: failedAt,
      })
      .where(eq(billingWebhookEvent.id, webhookId))
    throw err
  }

  return {
    ok: true,
    duplicate: false,
    eventType: payload.eventType,
    status: 'processed',
    idempotencyKey,
  }
}

async function processPaymentStatusWebhook(
  webhookId: string,
  payload: TossPaymentStatusWebhook,
  idempotencyKey: string,
) {
  const { retrieveTossPayment } = await import('./toss')
  const payment = await retrieveTossPayment(payload.data.paymentKey)
  await recordPaymentWebhookResult(webhookId, payment, idempotencyKey)
}

async function processCancelStatusWebhook(
  webhookId: string,
  payload: TossCancelStatusWebhook,
  idempotencyKey: string,
) {
  if (!payload.data.paymentKey) {
    await markWebhookSkipped(webhookId, 'Cancel webhook did not include paymentKey')
    return
  }

  const { retrieveTossPayment } = await import('./toss')
  const payment = await retrieveTossPayment(payload.data.paymentKey)
  await recordPaymentWebhookResult(webhookId, payment, idempotencyKey)
}

async function recordPaymentWebhookResult(
  webhookId: string,
  payment: TossPaymentResponse,
  idempotencyKey: string,
) {
  const { db } = await import('@/lib/db')
  const { insertBillingEvent } = await import('./subscription')
  const contextRows = await db
    .select({
      invoiceEvent: billingInvoiceEvent,
      subscription: tenantSubscription,
      customer: billingCustomer,
    })
    .from(billingInvoiceEvent)
    .leftJoin(tenantSubscription, eq(billingInvoiceEvent.subscriptionId, tenantSubscription.id))
    .leftJoin(billingCustomer, eq(billingInvoiceEvent.billingCustomerId, billingCustomer.id))
    .where(and(
      eq(billingInvoiceEvent.provider, 'toss_payments'),
      or(
        eq(billingInvoiceEvent.paymentKey, payment.paymentKey),
        eq(billingInvoiceEvent.orderId, payment.orderId),
      ),
    ))
    .orderBy(desc(billingInvoiceEvent.occurredAt))
    .limit(1)

  const context = contextRows[0]
  if (!context) {
    await markWebhookSkipped(webhookId, 'No matching billing invoice event for payment')
    return
  }

  const tenantId = context.invoiceEvent.tenantId
  const subscriptionId = context.invoiceEvent.subscriptionId ?? context.subscription?.id ?? null
  const customerId = context.invoiceEvent.billingCustomerId ?? context.customer?.id ?? null
  const statusMapping = mapPaymentStatus(payment.status)

  if (subscriptionId && statusMapping.subscriptionStatus) {
    await db
      .update(tenantSubscription)
      .set({
        status: statusMapping.subscriptionStatus,
        updatedAt: eventTimestamp(),
      })
      .where(and(
        eq(tenantSubscription.id, subscriptionId),
        eq(tenantSubscription.tenantId, tenantId),
      ))
  }

  await insertBillingEvent({
    tenantId,
    subscriptionId,
    billingCustomerId: customerId,
    eventType: statusMapping.eventType,
    status: statusMapping.eventStatus,
    orderId: payment.orderId,
    amountKrw: payment.totalAmount,
    paymentKey: payment.paymentKey,
    providerEventId: payment.paymentKey,
    providerMessage: `Toss payment status changed to ${payment.status}`,
    providerPayload: paymentEventPayload(payment),
    idempotencyKey,
  })

  await db
    .update(billingWebhookEvent)
    .set({
      status: 'processed',
      tenantId,
      subscriptionId,
      billingCustomerId: customerId,
      providerEventId: payment.paymentKey,
      providerMessage: `Processed payment status ${payment.status}`,
      providerPayload: paymentEventPayload(payment),
      processedAt: eventTimestamp(),
    })
    .where(eq(billingWebhookEvent.id, webhookId))
}

async function processBillingDeletedWebhook(
  webhookId: string,
  payload: TossBillingDeletedWebhook,
  idempotencyKey: string,
) {
  const { db } = await import('@/lib/db')
  const { insertBillingEvent } = await import('./subscription')
  const rows = await db
    .select({
      customer: billingCustomer,
      subscription: tenantSubscription,
    })
    .from(billingCustomer)
    .leftJoin(
      tenantSubscription,
      and(
        eq(tenantSubscription.billingCustomerId, billingCustomer.id),
        eq(tenantSubscription.tenantId, billingCustomer.tenantId),
      ),
    )
    .where(and(
      eq(billingCustomer.provider, 'toss_payments'),
      eq(billingCustomer.providerBillingKey, payload.billingKey),
    ))
    .limit(1)

  const context = rows[0]
  if (!context) {
    await markWebhookSkipped(webhookId, 'No matching billing customer for deleted billing key')
    return
  }

  const timestamp = eventTimestamp()
  await db
    .update(billingCustomer)
    .set({
      providerBillingKey: null,
      paymentMethodSnapshot: null,
      billingKeyIssuedAt: null,
      updatedAt: timestamp,
    })
    .where(and(
      eq(billingCustomer.id, context.customer.id),
      eq(billingCustomer.tenantId, context.customer.tenantId),
    ))

  if (context.subscription && context.subscription.status !== 'canceled') {
    await db
      .update(tenantSubscription)
      .set({
        status: 'pending_payment',
        updatedAt: timestamp,
      })
      .where(and(
        eq(tenantSubscription.id, context.subscription.id),
        eq(tenantSubscription.tenantId, context.customer.tenantId),
      ))
  }

  await insertBillingEvent({
    tenantId: context.customer.tenantId,
    subscriptionId: context.subscription?.id ?? null,
    billingCustomerId: context.customer.id,
    eventType: 'billing_key_deleted',
    status: 'succeeded',
    providerEventId: null,
    providerMessage: payload.reason ?? 'Billing key deleted by Toss Payments',
    providerPayload: JSON.stringify({
      eventType: payload.eventType,
      createdAt: payload.createdAt ?? null,
      reason: payload.reason ?? null,
    }),
    idempotencyKey,
  })

  await db
    .update(billingWebhookEvent)
    .set({
      status: 'processed',
      tenantId: context.customer.tenantId,
      subscriptionId: context.subscription?.id ?? null,
      billingCustomerId: context.customer.id,
      providerMessage: 'Processed deleted billing key',
      providerPayload: JSON.stringify({
        eventType: payload.eventType,
        createdAt: payload.createdAt ?? null,
        reason: payload.reason ?? null,
      }),
      processedAt: eventTimestamp(),
    })
    .where(eq(billingWebhookEvent.id, webhookId))
}

async function markWebhookSkipped(webhookId: string, message: string) {
  const { db } = await import('@/lib/db')
  await db
    .update(billingWebhookEvent)
    .set({
      status: 'skipped',
      providerMessage: message,
      processedAt: eventTimestamp(),
    })
    .where(eq(billingWebhookEvent.id, webhookId))
}

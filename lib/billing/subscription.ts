import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  billingCustomer,
  billingInvoiceEvent,
  tenant,
  tenantSubscription,
} from '@/lib/db/schema'
import { getTossBillingEnvOrNull } from '@/lib/env'
import { now, toDBString } from '@/lib/time'
import {
  billingPlanCodeSchema,
  getBillingPlan,
  type BillingPlanCode,
} from './plans'
import { requireBillingAdmin } from './admin'
import {
  chargeTossBillingKey,
  issueTossBillingKey,
  tossCardSnapshot,
  TossPaymentsError,
  type TossBillingChargeResponse,
  type TossBillingKeyResponse,
} from './toss'

type BillingUser = {
  id: string
  email?: string | null
  name?: string | null
}

export type TenantSubscriptionStatus =
  | 'manual_pilot'
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'canceled'

export type BillingSetupResult = {
  clientKey: string
  customerKey: string
  successUrl: string
  failUrl: string
  customerName: string
  customerEmail?: string
}

export type BillingAuthCompletionResult = {
  subscriptionStatus: TenantSubscriptionStatus
  autoChargeEnabled: boolean
  charged: boolean
  paymentKey?: string
  nextBillingAt?: string | null
}

export type BillingInvoiceEventType =
  | 'setup_started'
  | 'billing_key_issued'
  | 'charge_scheduled'
  | 'charge_succeeded'
  | 'charge_failed'
  | 'subscription_updated'
  | 'setup_failed'
  | 'payment_status_changed'
  | 'payment_canceled'
  | 'payment_partially_canceled'
  | 'billing_key_deleted'

function randomCustomerKey(): string {
  return `cus_${crypto.randomUUID()}`
}

function eventTimestamp(): string {
  return toDBString(now())
}

function providerErrorPayload(err: unknown): {
  code?: string
  message: string
  payload?: string
} {
  if (err instanceof TossPaymentsError) {
    return {
      code: err.code,
      message: err.message,
      payload: JSON.stringify({
        code: err.code ?? null,
        message: err.message,
        status: err.status,
      }),
    }
  }

  return {
    message: err instanceof Error ? err.message : 'Unknown billing error',
  }
}

function billingKeyEventPayload(response: TossBillingKeyResponse): string {
  return JSON.stringify({
    customerKey: response.customerKey,
    method: response.method ?? null,
    authenticatedAt: response.authenticatedAt ?? null,
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

function chargeEventPayload(response: TossBillingChargeResponse): string {
  return JSON.stringify({
    paymentKey: response.paymentKey,
    orderId: response.orderId,
    status: response.status,
    method: response.method ?? null,
    totalAmount: response.totalAmount,
    approvedAt: response.approvedAt ?? null,
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

async function ensureBillingCustomer(params: {
  tenantId: string
  staffId: string
  billingEmail?: string | null
  billingName: string
}) {
  const existingRows = await db
    .select()
    .from(billingCustomer)
    .where(and(
      eq(billingCustomer.tenantId, params.tenantId),
      eq(billingCustomer.provider, 'toss_payments'),
    ))
    .limit(1)

  const timestamp = eventTimestamp()
  const existing = existingRows[0]
  if (existing) {
    await db
      .update(billingCustomer)
      .set({
        billingEmail: params.billingEmail ?? existing.billingEmail,
        billingName: params.billingName,
        updatedAt: timestamp,
      })
      .where(and(
        eq(billingCustomer.id, existing.id),
        eq(billingCustomer.tenantId, params.tenantId),
      ))
    return {
      ...existing,
      billingEmail: params.billingEmail ?? existing.billingEmail,
      billingName: params.billingName,
      updatedAt: timestamp,
    }
  }

  const created = {
    id: crypto.randomUUID(),
    tenantId: params.tenantId,
    provider: 'toss_payments' as const,
    providerCustomerKey: randomCustomerKey(),
    providerBillingKey: null,
    billingEmail: params.billingEmail ?? null,
    billingName: params.billingName,
    methodType: 'card' as const,
    paymentMethodSnapshot: null,
    billingKeyIssuedAt: null,
    createdByStaffId: params.staffId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.insert(billingCustomer).values(created)
  return created
}

async function upsertTenantSubscription(params: {
  tenantId: string
  staffId: string
  billingCustomerId: string
  planCode: BillingPlanCode
}) {
  const existingRows = await db
    .select()
    .from(tenantSubscription)
    .where(eq(tenantSubscription.tenantId, params.tenantId))
    .limit(1)

  const timestamp = eventTimestamp()
  const existing = existingRows[0]
  if (existing) {
    await db
      .update(tenantSubscription)
      .set({
        planCode: params.planCode,
        status: 'pending_payment',
        contractType: 'provider_auto_billing',
        provider: 'toss_payments',
        billingCustomerId: params.billingCustomerId,
        billingOwnerStaffId: params.staffId,
        updatedAt: timestamp,
      })
      .where(and(
        eq(tenantSubscription.id, existing.id),
        eq(tenantSubscription.tenantId, params.tenantId),
      ))
    return {
      ...existing,
      planCode: params.planCode,
      status: 'pending_payment' as const,
      contractType: 'provider_auto_billing' as const,
      provider: 'toss_payments' as const,
      billingCustomerId: params.billingCustomerId,
      billingOwnerStaffId: params.staffId,
      updatedAt: timestamp,
    }
  }

  const created = {
    id: crypto.randomUUID(),
    tenantId: params.tenantId,
    planCode: params.planCode,
    status: 'pending_payment' as const,
    contractType: 'provider_auto_billing' as const,
    provider: 'toss_payments' as const,
    billingCustomerId: params.billingCustomerId,
    billingOwnerStaffId: params.staffId,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextBillingAt: null,
    cancelAt: null,
    canceledAt: null,
    providerSubscriptionId: null,
    providerPaymentMethodId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.insert(tenantSubscription).values(created)
  return created
}

export async function insertBillingEvent(params: {
  tenantId: string
  subscriptionId?: string | null
  billingCustomerId?: string | null
  eventType: BillingInvoiceEventType
  status: 'pending' | 'succeeded' | 'failed' | 'skipped'
  orderId?: string | null
  amountKrw?: number | null
  paymentKey?: string | null
  providerEventId?: string | null
  providerCode?: string | null
  providerMessage?: string | null
  providerPayload?: string | null
  idempotencyKey?: string | null
}) {
  const timestamp = eventTimestamp()
  await db.insert(billingInvoiceEvent).values({
    id: crypto.randomUUID(),
    tenantId: params.tenantId,
    subscriptionId: params.subscriptionId ?? null,
    billingCustomerId: params.billingCustomerId ?? null,
    provider: 'toss_payments',
    eventType: params.eventType,
    status: params.status,
    orderId: params.orderId ?? null,
    amountKrw: params.amountKrw ?? null,
    paymentKey: params.paymentKey ?? null,
    providerEventId: params.providerEventId ?? null,
    providerCode: params.providerCode ?? null,
    providerMessage: params.providerMessage ?? null,
    providerPayload: params.providerPayload ?? null,
    idempotencyKey: params.idempotencyKey ?? null,
    occurredAt: timestamp,
    createdAt: timestamp,
  })
}

export async function startTossBillingSetup(params: {
  tenantId: string
  user: BillingUser
  planCode: BillingPlanCode
  origin: string
}): Promise<BillingSetupResult> {
  const tossEnv = getTossBillingEnvOrNull()
  if (!tossEnv) throw new Error('TossBillingUnavailable')

  const planCode = billingPlanCodeSchema.parse(params.planCode)
  const staffRecord = await requireBillingAdmin(params.tenantId, params.user.id)
  const tenantRows = await db
    .select({ name: tenant.name })
    .from(tenant)
    .where(eq(tenant.id, params.tenantId))
    .limit(1)

  const tenantName = tenantRows[0]?.name ?? staffRecord.name
  const customer = await ensureBillingCustomer({
    tenantId: params.tenantId,
    staffId: staffRecord.id,
    billingEmail: params.user.email ?? staffRecord.email,
    billingName: tenantName,
  })
  const subscription = await upsertTenantSubscription({
    tenantId: params.tenantId,
    staffId: staffRecord.id,
    billingCustomerId: customer.id,
    planCode,
  })

  await insertBillingEvent({
    tenantId: params.tenantId,
    subscriptionId: subscription.id,
    billingCustomerId: customer.id,
    eventType: 'setup_started',
    status: 'succeeded',
    providerPayload: JSON.stringify({
      planCode,
      autoChargeEnabled: tossEnv.TOSS_BILLING_AUTO_CHARGE_ENABLED,
    }),
  })

  return {
    clientKey: tossEnv.TOSS_CLIENT_KEY,
    customerKey: customer.providerCustomerKey,
    successUrl: `${params.origin}/dashboard/billing/toss/success`,
    failUrl: `${params.origin}/dashboard/billing/toss/fail`,
    customerName: tenantName,
    customerEmail: params.user.email ?? staffRecord.email,
  }
}

export async function completeTossBillingAuth(params: {
  tenantId: string
  user: BillingUser
  authKey: string
  customerKey: string
}): Promise<BillingAuthCompletionResult> {
  const tossEnv = getTossBillingEnvOrNull()
  if (!tossEnv) throw new Error('TossBillingUnavailable')
  await requireBillingAdmin(params.tenantId, params.user.id)

  const customerRows = await db
    .select()
    .from(billingCustomer)
    .where(and(
      eq(billingCustomer.tenantId, params.tenantId),
      eq(billingCustomer.provider, 'toss_payments'),
      eq(billingCustomer.providerCustomerKey, params.customerKey),
    ))
    .limit(1)
  const customer = customerRows[0]
  if (!customer) throw new Error('BillingCustomerNotFound')

  const subscriptionRows = await db
    .select()
    .from(tenantSubscription)
    .where(and(
      eq(tenantSubscription.tenantId, params.tenantId),
      eq(tenantSubscription.billingCustomerId, customer.id),
      eq(tenantSubscription.provider, 'toss_payments'),
    ))
    .limit(1)
  const subscription = subscriptionRows[0]
  if (!subscription) throw new Error('SubscriptionNotFound')

  let billingKeyResponse: TossBillingKeyResponse
  try {
    billingKeyResponse = await issueTossBillingKey({
      authKey: params.authKey,
      customerKey: params.customerKey,
    })
  } catch (err) {
    const providerError = providerErrorPayload(err)
    await insertBillingEvent({
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      billingCustomerId: customer.id,
      eventType: 'setup_failed',
      status: 'failed',
      providerCode: providerError.code,
      providerMessage: providerError.message,
      providerPayload: providerError.payload,
    })
    throw err
  }

  const issuedAt = eventTimestamp()
  await db
    .update(billingCustomer)
    .set({
      providerBillingKey: billingKeyResponse.billingKey,
      paymentMethodSnapshot: tossCardSnapshot(billingKeyResponse),
      billingKeyIssuedAt: issuedAt,
      updatedAt: issuedAt,
    })
    .where(and(eq(billingCustomer.id, customer.id), eq(billingCustomer.tenantId, params.tenantId)))

  await insertBillingEvent({
    tenantId: params.tenantId,
    subscriptionId: subscription.id,
    billingCustomerId: customer.id,
    eventType: 'billing_key_issued',
    status: 'succeeded',
    providerPayload: billingKeyEventPayload(billingKeyResponse),
  })

  if (!tossEnv.TOSS_BILLING_AUTO_CHARGE_ENABLED) {
    await db
      .update(tenantSubscription)
      .set({
        status: 'pending_payment',
        providerPaymentMethodId: customer.providerCustomerKey,
        updatedAt: eventTimestamp(),
      })
      .where(and(
        eq(tenantSubscription.id, subscription.id),
        eq(tenantSubscription.tenantId, params.tenantId),
      ))

    return {
      subscriptionStatus: 'pending_payment',
      autoChargeEnabled: false,
      charged: false,
      nextBillingAt: subscription.nextBillingAt,
    }
  }

  const parsedPlanCode = billingPlanCodeSchema.safeParse(subscription.planCode)
  if (!parsedPlanCode.success) {
    throw new Error('UnsupportedSubscriptionPlan')
  }

  const plan = getBillingPlan(parsedPlanCode.data)
  if (plan.monthlyPriceKrw === null) {
    await insertBillingEvent({
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      billingCustomerId: customer.id,
      eventType: 'charge_scheduled',
      status: 'skipped',
      providerMessage: 'Enterprise plan requires manual amount confirmation.',
    })
    return {
      subscriptionStatus: 'pending_payment',
      autoChargeEnabled: true,
      charged: false,
      nextBillingAt: subscription.nextBillingAt,
    }
  }

  const chargeResult = await chargeInitialPeriod({
    tenantId: params.tenantId,
    subscriptionId: subscription.id,
    billingCustomerId: customer.id,
    billingKey: billingKeyResponse.billingKey,
    customerKey: customer.providerCustomerKey,
    amount: plan.monthlyPriceKrw,
    orderName: `JARYO ${plan.name} 월 구독`,
    customerEmail: customer.billingEmail,
    customerName: customer.billingName,
  })

  return {
    subscriptionStatus: chargeResult.status,
    autoChargeEnabled: true,
    charged: chargeResult.charged,
    paymentKey: chargeResult.paymentKey,
    nextBillingAt: chargeResult.nextBillingAt,
  }
}

async function chargeInitialPeriod(params: {
  tenantId: string
  subscriptionId: string
  billingCustomerId: string
  billingKey: string
  customerKey: string
  amount: number
  orderName: string
  customerEmail?: string | null
  customerName?: string | null
}) {
  const orderId = `jaryo-${crypto.randomUUID()}`
  const idempotencyKey = `billing-initial-${params.subscriptionId}`

  try {
    const payment = await chargeTossBillingKey({
      billingKey: params.billingKey,
      customerKey: params.customerKey,
      amount: params.amount,
      orderId,
      orderName: params.orderName,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      idempotencyKey,
    })

    const periodStart = now()
    const periodEnd = periodStart.plus({ months: 1 })
    const nextBillingAt = toDBString(periodEnd)
    await db
      .update(tenantSubscription)
      .set({
        status: 'active',
        currentPeriodStart: toDBString(periodStart),
        currentPeriodEnd: nextBillingAt,
        nextBillingAt,
        providerPaymentMethodId: params.customerKey,
        updatedAt: eventTimestamp(),
      })
      .where(and(
        eq(tenantSubscription.id, params.subscriptionId),
        eq(tenantSubscription.tenantId, params.tenantId),
      ))

    await insertBillingEvent({
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      billingCustomerId: params.billingCustomerId,
      eventType: 'charge_succeeded',
      status: 'succeeded',
      orderId: payment.orderId,
      amountKrw: payment.totalAmount,
      paymentKey: payment.paymentKey,
      providerEventId: payment.paymentKey,
      providerPayload: chargeEventPayload(payment),
      idempotencyKey,
    })

    return {
      status: 'active' as const,
      charged: true,
      paymentKey: payment.paymentKey,
      nextBillingAt,
    }
  } catch (err) {
    const providerError = providerErrorPayload(err)
    await db
      .update(tenantSubscription)
      .set({ status: 'past_due', updatedAt: eventTimestamp() })
      .where(and(
        eq(tenantSubscription.id, params.subscriptionId),
        eq(tenantSubscription.tenantId, params.tenantId),
      ))

    await insertBillingEvent({
      tenantId: params.tenantId,
      subscriptionId: params.subscriptionId,
      billingCustomerId: params.billingCustomerId,
      eventType: 'charge_failed',
      status: 'failed',
      orderId,
      amountKrw: params.amount,
      providerCode: providerError.code,
      providerMessage: providerError.message,
      providerPayload: providerError.payload,
      idempotencyKey,
    })
    throw err
  }
}

export async function latestBillingEvent(tenantId: string) {
  const rows = await db
    .select()
    .from(billingInvoiceEvent)
    .where(eq(billingInvoiceEvent.tenantId, tenantId))
    .orderBy(desc(billingInvoiceEvent.occurredAt))
    .limit(1)

  return rows[0] ?? null
}

export async function runDueTossRenewals() {
  const tossEnv = getTossBillingEnvOrNull()
  if (!tossEnv || !tossEnv.TOSS_BILLING_AUTO_CHARGE_ENABLED) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0, reason: 'auto_charge_disabled' }
  }

  const dueAt = eventTimestamp()
  const rows = await db
    .select({
      subscription: tenantSubscription,
      customer: billingCustomer,
    })
    .from(tenantSubscription)
    .innerJoin(billingCustomer, eq(tenantSubscription.billingCustomerId, billingCustomer.id))
    .where(and(
      eq(tenantSubscription.provider, 'toss_payments'),
      eq(tenantSubscription.status, 'active'),
      lte(tenantSubscription.nextBillingAt, dueAt),
    ))

  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    const subscription = row.subscription
    const customer = row.customer
    const parsedPlanCode = billingPlanCodeSchema.safeParse(subscription.planCode)
    if (!parsedPlanCode.success || !customer.providerBillingKey) {
      skipped += 1
      await insertBillingEvent({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        billingCustomerId: customer.id,
        eventType: 'charge_scheduled',
        status: 'skipped',
        providerMessage: !parsedPlanCode.success ? 'Unsupported plan code' : 'Missing billing key',
      })
      continue
    }

    const plan = getBillingPlan(parsedPlanCode.data)
    if (plan.monthlyPriceKrw === null) {
      skipped += 1
      await insertBillingEvent({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        billingCustomerId: customer.id,
        eventType: 'charge_scheduled',
        status: 'skipped',
        providerMessage: 'Enterprise plan requires manual amount confirmation.',
      })
      continue
    }

    const orderId = `jaryo-${crypto.randomUUID()}`
    const idempotencyKey = `billing-renewal-${subscription.id}-${subscription.nextBillingAt}`
    try {
      const payment = await chargeTossBillingKey({
        billingKey: customer.providerBillingKey,
        customerKey: customer.providerCustomerKey,
        amount: plan.monthlyPriceKrw,
        orderId,
        orderName: `JARYO ${plan.name} 월 구독`,
        customerEmail: customer.billingEmail,
        customerName: customer.billingName,
        idempotencyKey,
      })

      const periodStart = now()
      const periodEnd = periodStart.plus({ months: 1 })
      await db
        .update(tenantSubscription)
        .set({
          currentPeriodStart: toDBString(periodStart),
          currentPeriodEnd: toDBString(periodEnd),
          nextBillingAt: toDBString(periodEnd),
          updatedAt: eventTimestamp(),
        })
        .where(and(
          eq(tenantSubscription.id, subscription.id),
          eq(tenantSubscription.tenantId, subscription.tenantId),
        ))

      await insertBillingEvent({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        billingCustomerId: customer.id,
        eventType: 'charge_succeeded',
        status: 'succeeded',
        orderId: payment.orderId,
        amountKrw: payment.totalAmount,
        paymentKey: payment.paymentKey,
        providerEventId: payment.paymentKey,
        providerPayload: chargeEventPayload(payment),
        idempotencyKey,
      })
      succeeded += 1
    } catch (err) {
      const providerError = providerErrorPayload(err)
      await db
        .update(tenantSubscription)
        .set({ status: 'past_due', updatedAt: eventTimestamp() })
        .where(and(
          eq(tenantSubscription.id, subscription.id),
          eq(tenantSubscription.tenantId, subscription.tenantId),
        ))

      await insertBillingEvent({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        billingCustomerId: customer.id,
        eventType: 'charge_failed',
        status: 'failed',
        orderId,
        amountKrw: plan.monthlyPriceKrw,
        providerCode: providerError.code,
        providerMessage: providerError.message,
        providerPayload: providerError.payload,
        idempotencyKey,
      })
      failed += 1
    }
  }

  return { processed: rows.length, succeeded, failed, skipped }
}

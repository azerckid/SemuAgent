import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE tenant (
      id text PRIMARY KEY,
      name text NOT NULL,
      subdomain text NOT NULL UNIQUE,
      plan text NOT NULL DEFAULT 'free',
      timezone text NOT NULL DEFAULT 'Asia/Seoul',
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE tenant_subscription (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      plan_code text NOT NULL,
      status text NOT NULL DEFAULT 'pending_payment',
      contract_type text NOT NULL,
      provider text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE billing_invoice_event (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      subscription_id text,
      billing_customer_id text,
      provider text NOT NULL,
      event_type text NOT NULL,
      status text NOT NULL,
      order_id text,
      amount_krw integer,
      currency text NOT NULL DEFAULT 'KRW',
      payment_key text,
      provider_event_id text,
      provider_code text,
      provider_message text,
      provider_payload text,
      idempotency_key text,
      occurred_at text NOT NULL,
      created_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM tenant')
  await client.execute('DELETE FROM tenant_subscription')
  await client.execute('DELETE FROM billing_invoice_event')
})

async function seedTenant(params: { id: string; name: string }) {
  await client.execute({
    sql: 'INSERT INTO tenant (id, name, subdomain, created_at) VALUES (?, ?, ?, ?)',
    args: [params.id, params.name, params.id, '2026-01-01T00:00:00+09:00'],
  })
}

async function seedSubscription(params: { id: string; tenantId: string; planCode: string; contractType: string }) {
  await client.execute({
    sql: 'INSERT INTO tenant_subscription (id, tenant_id, plan_code, contract_type, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [params.id, params.tenantId, params.planCode, params.contractType, 'manual', '2026-01-01T00:00:00+09:00', '2026-01-01T00:00:00+09:00'],
  })
}

async function seedInvoiceEvent(params: {
  id: string
  tenantId: string
  subscriptionId?: string
  eventType: string
  status: string
  amountKrw?: number | null
  occurredAt: string
}) {
  await client.execute({
    sql: 'INSERT INTO billing_invoice_event (id, tenant_id, subscription_id, provider, event_type, status, amount_krw, occurred_at, created_at, provider_payload, payment_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      params.id,
      params.tenantId,
      params.subscriptionId ?? null,
      'toss_payments',
      params.eventType,
      params.status,
      params.amountKrw ?? null,
      params.occurredAt,
      params.occurredAt,
      JSON.stringify({ secret: 'should-never-leak' }),
      `pk-${params.id}`,
    ],
  })
}

describe('getJaryoAdminDailyRevenue', () => {
  it('sums paid and failed amounts per day, treating null amounts as zero', async () => {
    const { getJaryoAdminDailyRevenue } = await import('./revenue-queries')
    await seedTenant({ id: 't-1', name: '테넌트1' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T10:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-2', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 5000, occurredAt: '2026-06-01T15:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-3', tenantId: 't-1', eventType: 'charge_failed', status: 'failed', amountKrw: null, occurredAt: '2026-06-01T16:00:00+09:00' })

    const result = await getJaryoAdminDailyRevenue({ from: '2026-06-01', to: '2026-06-30' })

    expect(result).toEqual([{ date: '2026-06-01', paidAmountKrw: 15000, failedAmountKrw: 0 }])
  })

  it('excludes cancel/refund events from paid and failed sums', async () => {
    const { getJaryoAdminDailyRevenue } = await import('./revenue-queries')
    await seedTenant({ id: 't-1', name: '테넌트1' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T10:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-2', tenantId: 't-1', eventType: 'payment_partially_canceled', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T11:00:00+09:00' })

    const result = await getJaryoAdminDailyRevenue({ from: '2026-06-01', to: '2026-06-30' })

    expect(result).toEqual([{ date: '2026-06-01', paidAmountKrw: 10000, failedAmountKrw: 0 }])
  })

  it('does not produce a 0-amount bucket for a day whose only event is a cancellation', async () => {
    const { getJaryoAdminDailyRevenue } = await import('./revenue-queries')
    await seedTenant({ id: 't-1', name: '테넌트1' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T10:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-2', tenantId: 't-1', eventType: 'payment_canceled', status: 'succeeded', amountKrw: 5000, occurredAt: '2026-06-15T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-3', tenantId: 't-1', eventType: 'setup_started', status: 'pending', amountKrw: null, occurredAt: '2026-06-20T00:00:00+09:00' })

    const result = await getJaryoAdminDailyRevenue({ from: '2026-06-01', to: '2026-06-30' })

    expect(result).toEqual([{ date: '2026-06-01', paidAmountKrw: 10000, failedAmountKrw: 0 }])
  })

  it('filters by contract type via the joined subscription', async () => {
    const { getJaryoAdminDailyRevenue } = await import('./revenue-queries')
    await seedTenant({ id: 't-auto', name: '자동결제' })
    await seedTenant({ id: 't-manual', name: '수동청구' })
    await seedSubscription({ id: 'sub-auto', tenantId: 't-auto', planCode: 'growth', contractType: 'provider_auto_billing' })
    await seedSubscription({ id: 'sub-manual', tenantId: 't-manual', planCode: 'starter', contractType: 'manual_invoice' })
    await seedInvoiceEvent({ id: 'e-auto', tenantId: 't-auto', subscriptionId: 'sub-auto', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 30000, occurredAt: '2026-06-05T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-manual', tenantId: 't-manual', subscriptionId: 'sub-manual', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 50000, occurredAt: '2026-06-05T00:00:00+09:00' })

    const result = await getJaryoAdminDailyRevenue({ from: '2026-06-01', to: '2026-06-30', contractType: 'provider_auto_billing' })

    expect(result).toEqual([{ date: '2026-06-05', paidAmountKrw: 30000, failedAmountKrw: 0 }])
  })
})

describe('getJaryoAdminRevenueByPlan', () => {
  it('groups paid amount by plan code', async () => {
    const { getJaryoAdminRevenueByPlan } = await import('./revenue-queries')
    await seedTenant({ id: 't-a', name: 'A' })
    await seedTenant({ id: 't-b', name: 'B' })
    await seedSubscription({ id: 'sub-a', tenantId: 't-a', planCode: 'growth', contractType: 'provider_auto_billing' })
    await seedSubscription({ id: 'sub-b', tenantId: 't-b', planCode: 'pro', contractType: 'provider_auto_billing' })
    await seedInvoiceEvent({ id: 'e-a', tenantId: 't-a', subscriptionId: 'sub-a', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 30000, occurredAt: '2026-06-05T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-b', tenantId: 't-b', subscriptionId: 'sub-b', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 60000, occurredAt: '2026-06-06T00:00:00+09:00' })

    const result = await getJaryoAdminRevenueByPlan({ from: '2026-06-01', to: '2026-06-30' })

    expect(result).toContainEqual({ planCode: 'growth', paidAmountKrw: 30000 })
    expect(result).toContainEqual({ planCode: 'pro', paidAmountKrw: 60000 })
  })

  it('does not produce a 0-amount row for a plan whose only event is a cancellation', async () => {
    const { getJaryoAdminRevenueByPlan } = await import('./revenue-queries')
    await seedTenant({ id: 't-cancel-only', name: '취소만' })
    await seedSubscription({ id: 'sub-cancel-only', tenantId: 't-cancel-only', planCode: 'enterprise', contractType: 'provider_auto_billing' })
    await seedInvoiceEvent({ id: 'e-cancel', tenantId: 't-cancel-only', subscriptionId: 'sub-cancel-only', eventType: 'payment_canceled', status: 'succeeded', amountKrw: 90000, occurredAt: '2026-06-10T00:00:00+09:00' })

    const result = await getJaryoAdminRevenueByPlan({ from: '2026-06-01', to: '2026-06-30' })

    expect(result.find((r) => r.planCode === 'enterprise')).toBeUndefined()
  })
})

describe('getJaryoAdminRevenueByContractType', () => {
  it('counts only distinct paying tenants per contract type', async () => {
    const { getJaryoAdminRevenueByContractType } = await import('./revenue-queries')
    await seedTenant({ id: 't-auto-1', name: 'auto1' })
    await seedSubscription({ id: 'sub-auto-1', tenantId: 't-auto-1', planCode: 'growth', contractType: 'provider_auto_billing' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-auto-1', subscriptionId: 'sub-auto-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 30000, occurredAt: '2026-06-01T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-2', tenantId: 't-auto-1', subscriptionId: 'sub-auto-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 30000, occurredAt: '2026-06-02T00:00:00+09:00' })

    const result = await getJaryoAdminRevenueByContractType({ from: '2026-06-01', to: '2026-06-30' })
    const autoRow = result.find((r) => r.contractType === 'provider_auto_billing')

    expect(autoRow?.paidAmountKrw).toBe(60000)
    expect(autoRow?.tenantCount).toBe(1)
  })

  it('does not produce a 0-amount row for a contract type whose only event is a cancellation', async () => {
    const { getJaryoAdminRevenueByContractType } = await import('./revenue-queries')
    await seedTenant({ id: 't-pilot-cancel-only', name: '파일럿취소만' })
    await seedSubscription({ id: 'sub-pilot-cancel-only', tenantId: 't-pilot-cancel-only', planCode: 'pilot', contractType: 'manual_pilot' })
    await seedInvoiceEvent({ id: 'e-cancel', tenantId: 't-pilot-cancel-only', subscriptionId: 'sub-pilot-cancel-only', eventType: 'payment_canceled', status: 'succeeded', amountKrw: 90000, occurredAt: '2026-06-10T00:00:00+09:00' })

    const result = await getJaryoAdminRevenueByContractType({ from: '2026-06-01', to: '2026-06-30' })

    expect(result.find((r) => r.contractType === 'manual_pilot')).toBeUndefined()
  })
})

describe('listJaryoAdminTenantPayments', () => {
  it('paginates with deterministic ordering and includes cancel events without summing them', async () => {
    const { listJaryoAdminTenantPayments } = await import('./revenue-queries')
    await seedTenant({ id: 't-1', name: '테넌트1' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'e-2', tenantId: 't-1', eventType: 'payment_canceled', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-02T00:00:00+09:00' })

    const result = await listJaryoAdminTenantPayments({ from: '2026-06-01', to: '2026-06-30', page: 1 })

    expect(result.total).toBe(2)
    expect(result.rows.map((r) => r.eventType)).toEqual(['payment_canceled', 'charge_succeeded'])
  })

  it('never exposes provider payload or payment key', async () => {
    const { listJaryoAdminTenantPayments } = await import('./revenue-queries')
    await seedTenant({ id: 't-1', name: '테넌트1' })
    await seedInvoiceEvent({ id: 'e-1', tenantId: 't-1', eventType: 'charge_succeeded', status: 'succeeded', amountKrw: 10000, occurredAt: '2026-06-01T00:00:00+09:00' })

    const result = await listJaryoAdminTenantPayments({ from: '2026-06-01', to: '2026-06-30', page: 1 })
    const keys = Object.keys(result.rows[0])

    expect(keys).not.toContain('providerPayload')
    expect(keys).not.toContain('paymentKey')
  })
})

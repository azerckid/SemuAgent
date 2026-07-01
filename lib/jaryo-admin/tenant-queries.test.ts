import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

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
    CREATE TABLE staff (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'STAFF',
      phone text,
      active integer NOT NULL DEFAULT 1,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      staff_id text,
      email text NOT NULL,
      contact_name text,
      name text NOT NULL,
      address text,
      phone text,
      analysis_notes text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE tenant_billing_profile (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      business_registration_number text NOT NULL,
      business_name text NOT NULL,
      representative_name text NOT NULL,
      business_address text NOT NULL,
      business_type text,
      business_item text,
      tax_invoice_email text NOT NULL,
      billing_contact_name text NOT NULL,
      billing_contact_phone text NOT NULL,
      memo text,
      created_by_staff_id text,
      updated_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
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
      billing_customer_id text,
      billing_owner_staff_id text,
      current_period_start text,
      current_period_end text,
      next_billing_at text,
      cancel_at text,
      canceled_at text,
      provider_subscription_id text,
      provider_payment_method_id text,
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
  await client.execute(`
    CREATE TABLE billing_webhook_event (
      id text PRIMARY KEY,
      provider text NOT NULL,
      idempotency_key text NOT NULL,
      event_type text NOT NULL,
      status text NOT NULL DEFAULT 'received',
      tenant_id text,
      subscription_id text,
      billing_customer_id text,
      provider_event_id text,
      transmission_id text,
      transmission_time text,
      retried_count integer,
      provider_code text,
      provider_message text,
      provider_payload text,
      received_at text NOT NULL,
      processed_at text,
      created_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM tenant')
  await client.execute('DELETE FROM staff')
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM tenant_billing_profile')
  await client.execute('DELETE FROM tenant_subscription')
  await client.execute('DELETE FROM billing_invoice_event')
  await client.execute('DELETE FROM billing_webhook_event')
})

async function seedTenant(params: {
  id: string
  name: string
  plan?: 'free' | 'starter' | 'pro'
  createdAt: string
  subscription?: {
    status: string
    contractType: string
    planCode?: string
    currentPeriodEnd?: string
    nextBillingAt?: string
  }
  hasBillingProfile?: boolean
  clientCount?: number
  staffCount?: number
}) {
  await client.execute({
    sql: 'INSERT INTO tenant (id, name, subdomain, plan, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [params.id, params.name, params.id, params.plan ?? 'free', 'Asia/Seoul', params.createdAt],
  })

  if (params.subscription) {
    await client.execute({
      sql: 'INSERT INTO tenant_subscription (id, tenant_id, plan_code, status, contract_type, provider, current_period_end, next_billing_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        `${params.id}-sub`,
        params.id,
        params.subscription.planCode ?? 'starter',
        params.subscription.status,
        params.subscription.contractType,
        'manual',
        params.subscription.currentPeriodEnd ?? null,
        params.subscription.nextBillingAt ?? null,
        params.createdAt,
        params.createdAt,
      ],
    })
  }

  if (params.hasBillingProfile) {
    await client.execute({
      sql: `INSERT INTO tenant_billing_profile
        (id, tenant_id, business_registration_number, business_name, representative_name, business_address, tax_invoice_email, billing_contact_name, billing_contact_phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `${params.id}-profile`,
        params.id,
        '123-45-67890',
        `${params.name} 사업자명`,
        '대표자',
        '서울시 어딘가',
        'tax@example.com',
        '담당자',
        '010-0000-0000',
        params.createdAt,
        params.createdAt,
      ],
    })
  }

  for (let i = 0; i < (params.clientCount ?? 0); i += 1) {
    await client.execute({
      sql: 'INSERT INTO client (id, tenant_id, email, name, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [`${params.id}-client-${i}`, params.id, `client${i}@example.com`, `고객사${i}`, params.createdAt],
    })
  }

  for (let i = 0; i < (params.staffCount ?? 0); i += 1) {
    await client.execute({
      sql: 'INSERT INTO staff (id, tenant_id, user_id, email, name, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [`${params.id}-staff-${i}`, params.id, `${params.id}-user-${i}`, `staff${i}@example.com`, `직원${i}`, 'STAFF', 1, params.createdAt],
    })
  }
}

async function seedInvoiceEvent(params: {
  id: string
  tenantId: string
  eventType: string
  status: string
  amountKrw?: number | null
  occurredAt: string
}) {
  await client.execute({
    sql: 'INSERT INTO billing_invoice_event (id, tenant_id, provider, event_type, status, amount_krw, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [params.id, params.tenantId, 'toss_payments', params.eventType, params.status, params.amountKrw ?? null, params.occurredAt, params.occurredAt],
  })
}

async function seedWebhookEvent(params: {
  id: string
  tenantId: string | null
  eventType: string
  status: string
  receivedAt: string
}) {
  await client.execute({
    sql: 'INSERT INTO billing_webhook_event (id, provider, idempotency_key, event_type, status, tenant_id, received_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [params.id, 'toss_payments', params.id, params.eventType, params.status, params.tenantId, params.receivedAt, params.receivedAt],
  })
}

describe('listJaryoAdminTenants', () => {
  it('returns deterministic pages without loading every tenant at once', async () => {
    const { listJaryoAdminTenants, JARYO_ADMIN_TENANT_PAGE_SIZE } = await import('./tenant-queries')

    for (let i = 0; i < JARYO_ADMIN_TENANT_PAGE_SIZE + 5; i += 1) {
      await seedTenant({ id: `tenant-${i}`, name: `테넌트${i}`, createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00+09:00` })
    }

    const pageOne = await listJaryoAdminTenants({ view: 'all', page: 1 })
    const pageTwo = await listJaryoAdminTenants({ view: 'all', page: 2 })

    expect(pageOne.total).toBe(JARYO_ADMIN_TENANT_PAGE_SIZE + 5)
    expect(pageOne.rows).toHaveLength(JARYO_ADMIN_TENANT_PAGE_SIZE)
    expect(pageTwo.rows).toHaveLength(5)
    const pageOneIds = new Set(pageOne.rows.map((row) => row.id))
    expect(pageTwo.rows.every((row) => !pageOneIds.has(row.id))).toBe(true)
  })

  it('displays tenant_subscription.plan_code as the source of truth over legacy tenant.plan', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    // legacy tenant.plan is stale 'starter' but the real commercial plan is growth.
    await seedTenant({
      id: 't-growth',
      name: '그로스',
      plan: 'starter',
      createdAt: '2026-01-01T00:00:00+09:00',
      subscription: { status: 'active', contractType: 'provider_auto_billing', planCode: 'growth' },
    })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1 })
    const row = result.rows.find((r) => r.id === 't-growth')

    expect(row?.plan).toBe('growth')
  })

  it('falls back to legacy tenant.plan only when no subscription row exists', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-legacy-free', name: '레거시', plan: 'free', createdAt: '2026-01-01T00:00:00+09:00' })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1 })
    const row = result.rows.find((r) => r.id === 't-legacy-free')

    expect(row?.plan).toBe('free')
  })

  it('filters by commercial plan codes that are not in the legacy tenant.plan enum', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-enterprise', name: '엔터프라이즈', plan: 'pro', createdAt: '2026-01-01T00:00:00+09:00', subscription: { status: 'active', contractType: 'provider_auto_billing', planCode: 'enterprise' } })
    await seedTenant({ id: 't-pro-legacy', name: '프로', plan: 'pro', createdAt: '2026-01-02T00:00:00+09:00', subscription: { status: 'active', contractType: 'provider_auto_billing', planCode: 'pro' } })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1, plan: 'enterprise' })

    expect(result.rows.map((row) => row.id)).toEqual(['t-enterprise'])
  })

  it('filters by free using legacy tenant.plan only when no subscription row exists', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-free', name: '프리', plan: 'free', createdAt: '2026-01-01T00:00:00+09:00' })
    await seedTenant({ id: 't-pilot', name: '파일럿가입자', plan: 'free', createdAt: '2026-01-02T00:00:00+09:00', subscription: { status: 'manual_pilot', contractType: 'manual_pilot', planCode: 'pilot' } })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1, plan: 'free' })

    expect(result.rows.map((row) => row.id)).toEqual(['t-free'])
  })

  it('filters by the payment_issue saved view using subscription status only', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-ok', name: '정상', createdAt: '2026-01-01T00:00:00+09:00', subscription: { status: 'active', contractType: 'provider_auto_billing' }, hasBillingProfile: true })
    await seedTenant({ id: 't-bad', name: '연체', createdAt: '2026-01-02T00:00:00+09:00', subscription: { status: 'past_due', contractType: 'provider_auto_billing' }, hasBillingProfile: true })

    const result = await listJaryoAdminTenants({ view: 'payment_issue', page: 1 })

    expect(result.rows.map((row) => row.id)).toEqual(['t-bad'])
  })

  it('filters by billing_profile_missing without exposing any profile field', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-has-profile', name: '완료', createdAt: '2026-01-01T00:00:00+09:00', hasBillingProfile: true })
    await seedTenant({ id: 't-no-profile', name: '미완성', createdAt: '2026-01-02T00:00:00+09:00', hasBillingProfile: false })

    const result = await listJaryoAdminTenants({ view: 'billing_profile_missing', page: 1 })

    expect(result.rows.map((row) => row.id)).toEqual(['t-no-profile'])
    for (const row of result.rows) {
      expect(Object.keys(row)).not.toContain('businessRegistrationNumber')
      expect(Object.keys(row)).not.toContain('representativeName')
    }
  })

  it('filters by the pilot saved view using contract type', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-pilot', name: '파일럿', createdAt: '2026-01-01T00:00:00+09:00', subscription: { status: 'manual_pilot', contractType: 'manual_pilot' } })
    await seedTenant({ id: 't-paid', name: '유료', createdAt: '2026-01-02T00:00:00+09:00', subscription: { status: 'active', contractType: 'provider_auto_billing' } })

    const result = await listJaryoAdminTenants({ view: 'pilot', page: 1 })

    expect(result.rows.map((row) => row.id)).toEqual(['t-pilot'])
  })

  it('filters by renewal_upcoming using a cycle-agnostic nextBillingAt window', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    const inThreeDays = toDBString(now().plus({ days: 3 }))
    const inThirtyDays = toDBString(now().plus({ days: 30 }))

    await seedTenant({
      id: 't-renewing-soon',
      name: '곧갱신',
      createdAt: '2026-01-01T00:00:00+09:00',
      subscription: { status: 'active', contractType: 'provider_auto_billing', nextBillingAt: inThreeDays },
    })
    await seedTenant({
      id: 't-renewing-later',
      name: '나중갱신',
      createdAt: '2026-01-02T00:00:00+09:00',
      subscription: { status: 'active', contractType: 'provider_auto_billing', nextBillingAt: inThirtyDays },
    })
    await seedTenant({
      id: 't-manual-no-next-billing',
      name: '수동청구',
      createdAt: '2026-01-03T00:00:00+09:00',
      subscription: { status: 'active', contractType: 'manual_invoice' },
    })

    const result = await listJaryoAdminTenants({ view: 'renewal_upcoming', page: 1 })

    expect(result.rows.map((row) => row.id)).toEqual(['t-renewing-soon'])
  })

  it('counts only active staff and all managed clients per tenant', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-counts', name: '카운트', createdAt: '2026-01-01T00:00:00+09:00', clientCount: 3, staffCount: 2 })
    await client.execute({
      sql: 'INSERT INTO staff (id, tenant_id, user_id, email, name, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['t-counts-staff-inactive', 't-counts', 't-counts-user-inactive', 'inactive@example.com', '퇴사자', 'STAFF', 0, '2026-01-01T00:00:00+09:00'],
    })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1 })
    const row = result.rows.find((r) => r.id === 't-counts')

    expect(row?.clientCount).toBe(3)
    expect(row?.staffCount).toBe(2)
  })

  it('searches by name case-insensitively', async () => {
    const { listJaryoAdminTenants } = await import('./tenant-queries')
    await seedTenant({ id: 't-chunsim', name: '춘심회계법인', createdAt: '2026-01-01T00:00:00+09:00' })
    await seedTenant({ id: 't-other', name: '다른회계법인', createdAt: '2026-01-02T00:00:00+09:00' })

    const result = await listJaryoAdminTenants({ view: 'all', page: 1, q: '춘심' })

    expect(result.rows.map((row) => row.id)).toEqual(['t-chunsim'])
  })
})

describe('getJaryoAdminTenantDetail', () => {
  it('shows tenant_subscription.plan_code as the source of truth over legacy tenant.plan', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({
      id: 't-detail-growth',
      name: '디테일그로스',
      plan: 'starter',
      createdAt: '2026-01-01T00:00:00+09:00',
      subscription: { status: 'active', contractType: 'provider_auto_billing', planCode: 'growth' },
    })

    const detail = await getJaryoAdminTenantDetail('t-detail-growth')

    expect(detail?.plan).toBe('growth')
  })

  it('returns null for an unknown tenant id instead of leaking another tenant', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({ id: 't-real', name: '실재', createdAt: '2026-01-01T00:00:00+09:00' })

    const result = await getJaryoAdminTenantDetail('t-does-not-exist')

    expect(result).toBeNull()
  })

  it('scopes every related select to the requested tenant id only', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({
      id: 't-a',
      name: '테넌트A',
      createdAt: '2026-01-01T00:00:00+09:00',
      subscription: { status: 'past_due', contractType: 'provider_auto_billing' },
      hasBillingProfile: true,
      clientCount: 2,
      staffCount: 1,
    })
    await seedTenant({
      id: 't-b',
      name: '테넌트B',
      createdAt: '2026-01-02T00:00:00+09:00',
      clientCount: 5,
      staffCount: 4,
    })

    const detail = await getJaryoAdminTenantDetail('t-a')

    expect(detail?.clientCount).toBe(2)
    expect(detail?.staffCount).toBe(1)
    expect(detail?.subscriptionStatus).toBe('past_due')
    expect(detail?.nextAction).toBe('결제 실패 follow-up')
    expect(detail?.staff.every((s) => s.id.startsWith('t-a-staff-'))).toBe(true)
  })

  it('never selects billing profile PII fields, only existence', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({ id: 't-pii', name: 'PII체크', createdAt: '2026-01-01T00:00:00+09:00', hasBillingProfile: true })

    const detail = await getJaryoAdminTenantDetail('t-pii')

    expect(detail?.hasBillingProfile).toBe(true)
    expect(Object.keys(detail ?? {})).not.toContain('businessRegistrationNumber')
    expect(Object.keys(detail ?? {})).not.toContain('representativeName')
    expect(Object.keys(detail ?? {})).not.toContain('businessAddress')
  })

  it('includes recent invoice/webhook events scoped to the tenant, newest first, bounded to 5', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({ id: 't-events', name: '이벤트테넌트', createdAt: '2026-01-01T00:00:00+09:00' })
    await seedTenant({ id: 't-other-events', name: '다른테넌트', createdAt: '2026-01-01T00:00:00+09:00' })

    for (let i = 0; i < 6; i += 1) {
      await seedInvoiceEvent({
        id: `t-events-invoice-${i}`,
        tenantId: 't-events',
        eventType: 'charge_succeeded',
        status: 'succeeded',
        amountKrw: 10000 + i,
        occurredAt: `2026-01-${String(10 + i).padStart(2, '0')}T00:00:00+09:00`,
      })
    }
    await seedInvoiceEvent({ id: 'other-tenant-invoice', tenantId: 't-other-events', eventType: 'charge_succeeded', status: 'succeeded', occurredAt: '2026-01-20T00:00:00+09:00' })
    await seedWebhookEvent({ id: 't-events-webhook-1', tenantId: 't-events', eventType: 'PAYMENT_STATUS_CHANGED', status: 'failed', receivedAt: '2026-01-15T00:00:00+09:00' })

    const detail = await getJaryoAdminTenantDetail('t-events')

    expect(detail?.billing.recentInvoiceEvents).toHaveLength(5)
    expect(detail?.billing.recentInvoiceEvents[0].occurredAt).toBe('2026-01-15T00:00:00+09:00')
    expect(detail?.billing.recentInvoiceEvents.every((e) => e.amountKrw !== undefined)).toBe(true)
    expect(detail?.billing.recentWebhookEvents).toHaveLength(1)
    expect(detail?.billing.recentWebhookEvents[0].status).toBe('failed')
  })

  it('never exposes provider secrets or raw payload in the billing section', async () => {
    const { getJaryoAdminTenantDetail } = await import('./tenant-queries')
    await seedTenant({ id: 't-secrets', name: '시크릿테넌트', createdAt: '2026-01-01T00:00:00+09:00' })
    await seedInvoiceEvent({ id: 'secrets-invoice', tenantId: 't-secrets', eventType: 'charge_succeeded', status: 'succeeded', occurredAt: '2026-01-10T00:00:00+09:00' })
    await seedWebhookEvent({ id: 'secrets-webhook', tenantId: 't-secrets', eventType: 'PAYMENT_STATUS_CHANGED', status: 'received', receivedAt: '2026-01-10T00:00:00+09:00' })

    const detail = await getJaryoAdminTenantDetail('t-secrets')

    const invoiceKeys = Object.keys(detail?.billing.recentInvoiceEvents[0] ?? {})
    const webhookKeys = Object.keys(detail?.billing.recentWebhookEvents[0] ?? {})
    for (const forbidden of ['providerPayload', 'paymentKey', 'providerCode', 'providerMessage', 'transmissionId', 'providerBillingKey']) {
      expect(invoiceKeys).not.toContain(forbidden)
      expect(webhookKeys).not.toContain(forbidden)
    }
  })
})

describe('countJaryoAdminWebhookFailures', () => {
  it('counts only recent, tenant-scoped, failed webhook events', async () => {
    const { countJaryoAdminWebhookFailures } = await import('./tenant-queries')
    await seedTenant({ id: 't-webhook-counts', name: '웹훅카운트', createdAt: '2026-01-01T00:00:00+09:00' })

    const recentFailed = toDBString(now().minus({ days: 5 }))
    const oldFailed = toDBString(now().minus({ days: 45 }))
    const recentSucceeded = toDBString(now().minus({ days: 2 }))

    await seedWebhookEvent({ id: 'wh-recent-failed', tenantId: 't-webhook-counts', eventType: 'PAYMENT_STATUS_CHANGED', status: 'failed', receivedAt: recentFailed })
    await seedWebhookEvent({ id: 'wh-old-failed', tenantId: 't-webhook-counts', eventType: 'PAYMENT_STATUS_CHANGED', status: 'failed', receivedAt: oldFailed })
    await seedWebhookEvent({ id: 'wh-recent-succeeded', tenantId: 't-webhook-counts', eventType: 'PAYMENT_STATUS_CHANGED', status: 'processed', receivedAt: recentSucceeded })
    await seedWebhookEvent({ id: 'wh-no-tenant-failed', tenantId: null, eventType: 'PAYMENT_STATUS_CHANGED', status: 'failed', receivedAt: recentFailed })

    const count = await countJaryoAdminWebhookFailures()

    expect(count).toBe(1)
  })
})

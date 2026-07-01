import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  billingInvoiceEvent,
  billingWebhookEvent,
  client,
  staff,
  tenant,
  tenantBillingProfile,
  tenantSubscription,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { deriveTenantNextAction, type TenantSubscriptionStatus } from './tenant-next-action'
import type { EnabledTenantSavedViewId } from './tenant-saved-views'

const RENEWAL_UPCOMING_WINDOW_DAYS = 7
const WEBHOOK_FAILURE_LOOKBACK_DAYS = 30

export const JARYO_ADMIN_TENANT_PAGE_SIZE = 50

/**
 * tenant.plan ('free'|'starter'|'pro') is legacy display state.
 * tenant_subscription.plan_code is the commercial source of truth once a
 * subscription row exists (05_BILLING_SUBSCRIPTION_SPEC.md §4/§5). 'free'
 * tenants never get a subscription row, so it stays as the only legacy
 * fallback value here.
 */
export type EffectiveTenantPlan = 'free' | 'starter' | 'growth' | 'pro' | 'enterprise' | 'pilot'

export type ListJaryoAdminTenantsParams = {
  q?: string
  plan?: EffectiveTenantPlan
  view: EnabledTenantSavedViewId
  page: number
}

export type JaryoAdminTenantListRow = {
  id: string
  name: string
  plan: EffectiveTenantPlan
  createdAt: string
  contractType: 'manual_pilot' | 'manual_invoice' | 'provider_auto_billing' | null
  subscriptionStatus: TenantSubscriptionStatus
  hasBillingProfile: boolean
  clientCount: number
  staffCount: number
  nextAction: string
}

export type ListJaryoAdminTenantsResult = {
  rows: JaryoAdminTenantListRow[]
  total: number
  page: number
  pageSize: number
}

function buildTenantListConditions(params: Pick<ListJaryoAdminTenantsParams, 'q' | 'plan' | 'view'>) {
  const conditions = []

  if (params.q && params.q.trim().length > 0) {
    const needle = `%${params.q.trim().toLowerCase()}%`
    conditions.push(sql`lower(${tenant.name}) like ${needle}`)
  }

  if (params.plan === 'free') {
    // 'free' has no commercial subscription row — matches tenant.plan directly.
    conditions.push(isNull(tenantSubscription.id), eq(tenant.plan, 'free'))
  } else if (params.plan) {
    conditions.push(eq(tenantSubscription.planCode, params.plan))
  }

  if (params.view === 'payment_issue') {
    conditions.push(eq(tenantSubscription.status, 'past_due'))
  }

  if (params.view === 'pilot') {
    conditions.push(eq(tenantSubscription.contractType, 'manual_pilot'))
  }

  if (params.view === 'billing_profile_missing') {
    conditions.push(isNull(tenantBillingProfile.id))
  }

  if (params.view === 'renewal_upcoming') {
    const windowEnd = toDBString(now().plus({ days: RENEWAL_UPCOMING_WINDOW_DAYS }))
    const windowStart = toDBString(now())
    conditions.push(
      eq(tenantSubscription.contractType, 'provider_auto_billing'),
      gte(tenantSubscription.nextBillingAt, windowStart),
      lte(tenantSubscription.nextBillingAt, windowEnd),
    )
  }

  return and(...conditions)
}

/**
 * Global query — lists tenants across the whole service. Allowed only behind
 * requireJaryoAdminSession(). Never select tenantBillingProfile columns
 * beyond `id` here; billing profile PII (business registration number,
 * representative name, address) is out of scope for the tenant list.
 */
export async function listJaryoAdminTenants(params: ListJaryoAdminTenantsParams): Promise<ListJaryoAdminTenantsResult> {
  const pageSize = JARYO_ADMIN_TENANT_PAGE_SIZE
  const page = Math.max(1, params.page)
  const whereClause = buildTenantListConditions(params)

  const rows = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      legacyPlan: tenant.plan,
      planCode: tenantSubscription.planCode,
      createdAt: tenant.createdAt,
      contractType: tenantSubscription.contractType,
      subscriptionStatus: tenantSubscription.status,
      hasBillingProfileFlag: sql<number>`case when ${tenantBillingProfile.id} is null then 0 else 1 end`,
    })
    .from(tenant)
    .leftJoin(tenantSubscription, eq(tenantSubscription.tenantId, tenant.id))
    .leftJoin(tenantBillingProfile, eq(tenantBillingProfile.tenantId, tenant.id))
    .where(whereClause)
    .orderBy(desc(tenant.createdAt), asc(tenant.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenant)
    .leftJoin(tenantSubscription, eq(tenantSubscription.tenantId, tenant.id))
    .leftJoin(tenantBillingProfile, eq(tenantBillingProfile.tenantId, tenant.id))
    .where(whereClause)

  const tenantIds = rows.map((row) => row.id)

  const clientCounts = tenantIds.length > 0
    ? await db
      .select({ tenantId: client.tenantId, count: sql<number>`count(*)` })
      .from(client)
      .where(inArray(client.tenantId, tenantIds))
      .groupBy(client.tenantId)
    : []

  const staffCounts = tenantIds.length > 0
    ? await db
      .select({ tenantId: staff.tenantId, count: sql<number>`count(*)` })
      .from(staff)
      .where(and(inArray(staff.tenantId, tenantIds), eq(staff.active, true)))
      .groupBy(staff.tenantId)
    : []

  const clientCountByTenant = new Map(clientCounts.map((row) => [row.tenantId, row.count]))
  const staffCountByTenant = new Map(staffCounts.map((row) => [row.tenantId, row.count]))

  return {
    rows: rows.map((row) => {
      const hasBillingProfile = row.hasBillingProfileFlag === 1
      return {
        id: row.id,
        name: row.name,
        plan: row.planCode ?? row.legacyPlan,
        createdAt: row.createdAt,
        contractType: row.contractType,
        subscriptionStatus: row.subscriptionStatus,
        hasBillingProfile,
        clientCount: clientCountByTenant.get(row.id) ?? 0,
        staffCount: staffCountByTenant.get(row.id) ?? 0,
        nextAction: deriveTenantNextAction({ subscriptionStatus: row.subscriptionStatus, hasBillingProfile }),
      }
    }),
    total: totalRow?.count ?? 0,
    page,
    pageSize,
  }
}

/**
 * Global query — lightweight count for an overview queue card. Reuses the
 * same view conditions as listJaryoAdminTenants so the card and the filtered
 * list it links to never disagree.
 */
export async function countJaryoAdminTenantsByView(
  view: 'payment_issue' | 'billing_profile_missing' | 'pilot' | 'renewal_upcoming',
): Promise<number> {
  const whereClause = buildTenantListConditions({ view })
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenant)
    .leftJoin(tenantSubscription, eq(tenantSubscription.tenantId, tenant.id))
    .leftJoin(tenantBillingProfile, eq(tenantBillingProfile.tenantId, tenant.id))
    .where(whereClause)

  return row?.count ?? 0
}

/**
 * Global query — count of recent webhook events that need operator
 * attention. Bounded to the last WEBHOOK_FAILURE_LOOKBACK_DAYS days so an old,
 * already-resolved failure does not haunt the overview forever. Only counts
 * webhook events tied to a tenant (tenantId is nullable on this table).
 */
export async function countJaryoAdminWebhookFailures(): Promise<number> {
  const cutoff = toDBString(now().minus({ days: WEBHOOK_FAILURE_LOOKBACK_DAYS }))
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(billingWebhookEvent)
    .where(and(
      eq(billingWebhookEvent.status, 'failed'),
      isNotNull(billingWebhookEvent.tenantId),
      gte(billingWebhookEvent.receivedAt, cutoff),
    ))

  return row?.count ?? 0
}

export type JaryoAdminTenantStaffRow = {
  id: string
  name: string
  email: string
  role: 'TENANT_ADMIN' | 'STAFF'
  active: boolean
}

export type JaryoAdminInvoiceEventRow = {
  eventType: string
  status: 'pending' | 'succeeded' | 'failed' | 'skipped'
  amountKrw: number | null
  occurredAt: string
}

export type JaryoAdminWebhookEventRow = {
  eventType: string
  status: 'received' | 'processed' | 'skipped' | 'failed'
  receivedAt: string
}

export type JaryoAdminTenantBillingDetail = {
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  recentInvoiceEvents: JaryoAdminInvoiceEventRow[]
  recentWebhookEvents: JaryoAdminWebhookEventRow[]
}

export type JaryoAdminTenantDetail = {
  id: string
  name: string
  plan: EffectiveTenantPlan
  createdAt: string
  contractType: 'manual_pilot' | 'manual_invoice' | 'provider_auto_billing' | null
  subscriptionStatus: TenantSubscriptionStatus
  hasBillingProfile: boolean
  clientCount: number
  staffCount: number
  nextAction: string
  staff: JaryoAdminTenantStaffRow[]
  billing: JaryoAdminTenantBillingDetail
}

/**
 * Tenant-detail scoped query — every select below filters by the explicit
 * tenantId argument. This is the exception to the global tenant list query
 * above, not a replacement for tenant isolation.
 */
export async function getJaryoAdminTenantDetail(tenantId: string): Promise<JaryoAdminTenantDetail | null> {
  const [tenantRow] = await db
    .select({ id: tenant.id, name: tenant.name, plan: tenant.plan, createdAt: tenant.createdAt })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  if (!tenantRow) return null

  const [subscriptionRow] = await db
    .select({
      planCode: tenantSubscription.planCode,
      contractType: tenantSubscription.contractType,
      status: tenantSubscription.status,
      currentPeriodEnd: tenantSubscription.currentPeriodEnd,
      nextBillingAt: tenantSubscription.nextBillingAt,
    })
    .from(tenantSubscription)
    .where(eq(tenantSubscription.tenantId, tenantId))
    .limit(1)

  const recentInvoiceEvents = await db
    .select({
      eventType: billingInvoiceEvent.eventType,
      status: billingInvoiceEvent.status,
      amountKrw: billingInvoiceEvent.amountKrw,
      occurredAt: billingInvoiceEvent.occurredAt,
    })
    .from(billingInvoiceEvent)
    .where(eq(billingInvoiceEvent.tenantId, tenantId))
    .orderBy(desc(billingInvoiceEvent.occurredAt))
    .limit(5)

  const recentWebhookEvents = await db
    .select({
      eventType: billingWebhookEvent.eventType,
      status: billingWebhookEvent.status,
      receivedAt: billingWebhookEvent.receivedAt,
    })
    .from(billingWebhookEvent)
    .where(eq(billingWebhookEvent.tenantId, tenantId))
    .orderBy(desc(billingWebhookEvent.receivedAt))
    .limit(5)

  const [billingProfileRow] = await db
    .select({ id: tenantBillingProfile.id })
    .from(tenantBillingProfile)
    .where(eq(tenantBillingProfile.tenantId, tenantId))
    .limit(1)

  const [clientCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(client)
    .where(eq(client.tenantId, tenantId))

  const staffRows = await db
    .select({ id: staff.id, name: staff.name, email: staff.email, role: staff.role, active: staff.active })
    .from(staff)
    .where(eq(staff.tenantId, tenantId))
    .orderBy(asc(staff.name))

  const hasBillingProfile = !!billingProfileRow
  const subscriptionStatus = subscriptionRow?.status ?? null

  return {
    id: tenantRow.id,
    name: tenantRow.name,
    plan: subscriptionRow?.planCode ?? tenantRow.plan,
    createdAt: tenantRow.createdAt,
    contractType: subscriptionRow?.contractType ?? null,
    subscriptionStatus,
    hasBillingProfile,
    clientCount: clientCountRow?.count ?? 0,
    staffCount: staffRows.filter((row) => row.active).length,
    nextAction: deriveTenantNextAction({ subscriptionStatus, hasBillingProfile }),
    staff: staffRows,
    billing: {
      currentPeriodEnd: subscriptionRow?.currentPeriodEnd ?? null,
      nextBillingAt: subscriptionRow?.nextBillingAt ?? null,
      recentInvoiceEvents,
      recentWebhookEvents,
    },
  }
}

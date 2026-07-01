import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { billingInvoiceEvent, tenant, tenantSubscription } from '@/lib/db/schema'
import type { DailyRevenueRow } from './revenue-rollup'

export const JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE = 50

export type RevenueQueryFilters = {
  from: string
  to: string
  contractType?: 'manual_pilot' | 'manual_invoice' | 'provider_auto_billing'
  planCode?: 'starter' | 'growth' | 'pro' | 'enterprise' | 'pilot'
}

/**
 * v1 deliberately only sums charge_succeeded/succeeded ("paid") and
 * charge_failed/failed ("failed"). Refund/cancel events
 * (payment_canceled, payment_partially_canceled) are recorded in
 * billing_invoice_event for audit purposes but are never summed here:
 * lib/billing/webhook.ts stores the original payment's full amount on a
 * partial-cancel event, not the actual canceled amount, so a refund total
 * computed from this column would overstate refunds. Net revenue,
 * expected amount, and overdue amount are out of scope for the same
 * reason plus missing product definitions — see Work Order Slice 3.5.
 */
/**
 * occurredAt is always stored as ISO text with a consistent +09:00 offset
 * (Luxon's toDBString(now())). SQLite's date() function converts to UTC
 * before extracting the date, which shifts the calendar day for any
 * timestamp before 09:00 KST — a plain substring keeps the original KST
 * calendar date instead.
 */
const eventDateSql = sql`substr(${billingInvoiceEvent.occurredAt}, 1, 10)`

function buildRevenueConditions(filters: RevenueQueryFilters) {
  const conditions = [
    sql`${eventDateSql} >= ${filters.from}`,
    sql`${eventDateSql} <= ${filters.to}`,
  ]

  if (filters.contractType) {
    conditions.push(eq(tenantSubscription.contractType, filters.contractType))
  }
  if (filters.planCode) {
    conditions.push(eq(tenantSubscription.planCode, filters.planCode))
  }

  return and(...conditions)
}

/**
 * The three aggregate views below (daily, by-plan, by-contract-type) must
 * only group over charge_succeeded/charge_failed rows. Without this, a date
 * (or plan, or contract type) whose only billing_invoice_event activity was
 * a payment_canceled/setup_started/etc row would still produce a 0-amount
 * bucket — a misleading "there was billing activity here, it was just zero"
 * signal for an operator. listJaryoAdminTenantPayments deliberately keeps
 * the unrestricted condition since it is a raw activity log, not a sum.
 */
function buildAggregateRevenueConditions(filters: RevenueQueryFilters) {
  return and(
    buildRevenueConditions(filters),
    inArray(billingInvoiceEvent.eventType, ['charge_succeeded', 'charge_failed']),
  )
}

const paidSumSql = sql<number>`coalesce(sum(case when ${billingInvoiceEvent.eventType} = 'charge_succeeded' and ${billingInvoiceEvent.status} = 'succeeded' then ${billingInvoiceEvent.amountKrw} else 0 end), 0)`
const failedSumSql = sql<number>`coalesce(sum(case when ${billingInvoiceEvent.eventType} = 'charge_failed' and ${billingInvoiceEvent.status} = 'failed' then ${billingInvoiceEvent.amountKrw} else 0 end), 0)`

/** Global query — daily paid/failed sums for the date range, bounded by the range itself (at most one row per calendar day). */
export async function getJaryoAdminDailyRevenue(filters: RevenueQueryFilters): Promise<DailyRevenueRow[]> {
  const whereClause = buildAggregateRevenueConditions(filters)

  const rows = await db
    .select({
      date: sql<string>`${eventDateSql}`,
      paidAmountKrw: paidSumSql,
      failedAmountKrw: failedSumSql,
    })
    .from(billingInvoiceEvent)
    .leftJoin(tenantSubscription, eq(tenantSubscription.id, billingInvoiceEvent.subscriptionId))
    .where(whereClause)
    .groupBy(eventDateSql)
    .orderBy(eventDateSql)

  return rows
}

export type RevenueByPlanRow = {
  planCode: string | null
  paidAmountKrw: number
}

/** Global query — paid-amount breakdown by commercial plan code for the date range. */
export async function getJaryoAdminRevenueByPlan(filters: RevenueQueryFilters): Promise<RevenueByPlanRow[]> {
  const whereClause = buildAggregateRevenueConditions(filters)

  return db
    .select({
      planCode: tenantSubscription.planCode,
      paidAmountKrw: paidSumSql,
    })
    .from(billingInvoiceEvent)
    .leftJoin(tenantSubscription, eq(tenantSubscription.id, billingInvoiceEvent.subscriptionId))
    .where(whereClause)
    .groupBy(tenantSubscription.planCode)
}

export type RevenueByContractTypeRow = {
  contractType: 'manual_pilot' | 'manual_invoice' | 'provider_auto_billing' | null
  paidAmountKrw: number
  tenantCount: number
}

/** Global query — paid-amount and distinct-paying-tenant count by billing cycle (contract type) for the date range. */
export async function getJaryoAdminRevenueByContractType(filters: RevenueQueryFilters): Promise<RevenueByContractTypeRow[]> {
  const whereClause = buildAggregateRevenueConditions(filters)

  return db
    .select({
      contractType: tenantSubscription.contractType,
      paidAmountKrw: paidSumSql,
      tenantCount: sql<number>`count(distinct case when ${billingInvoiceEvent.eventType} = 'charge_succeeded' and ${billingInvoiceEvent.status} = 'succeeded' then ${billingInvoiceEvent.tenantId} else null end)`,
    })
    .from(billingInvoiceEvent)
    .leftJoin(tenantSubscription, eq(tenantSubscription.id, billingInvoiceEvent.subscriptionId))
    .where(whereClause)
    .groupBy(tenantSubscription.contractType)
}

export type JaryoAdminTenantPaymentRow = {
  tenantId: string
  tenantName: string
  eventType: string
  status: 'pending' | 'succeeded' | 'failed' | 'skipped'
  amountKrw: number | null
  occurredAt: string
}

export type ListJaryoAdminTenantPaymentsResult = {
  rows: JaryoAdminTenantPaymentRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * Global query — cross-tenant invoice event list for the date range, bounded
 * server-side pagination. This is a raw activity log (includes
 * payment_canceled/payment_partially_canceled rows for transparency) and is
 * never summed into a total here — only listed.
 */
export async function listJaryoAdminTenantPayments(
  filters: RevenueQueryFilters & { page: number },
): Promise<ListJaryoAdminTenantPaymentsResult> {
  const pageSize = JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE
  const page = Math.max(1, filters.page)
  const whereClause = buildRevenueConditions(filters)

  const rows = await db
    .select({
      tenantId: billingInvoiceEvent.tenantId,
      tenantName: tenant.name,
      eventType: billingInvoiceEvent.eventType,
      status: billingInvoiceEvent.status,
      amountKrw: billingInvoiceEvent.amountKrw,
      occurredAt: billingInvoiceEvent.occurredAt,
    })
    .from(billingInvoiceEvent)
    .innerJoin(tenant, eq(tenant.id, billingInvoiceEvent.tenantId))
    .leftJoin(tenantSubscription, eq(tenantSubscription.id, billingInvoiceEvent.subscriptionId))
    .where(whereClause)
    .orderBy(sql`${billingInvoiceEvent.occurredAt} desc`)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(billingInvoiceEvent)
    .leftJoin(tenantSubscription, eq(tenantSubscription.id, billingInvoiceEvent.subscriptionId))
    .where(whereClause)

  return { rows, total: totalRow?.count ?? 0, page, pageSize }
}

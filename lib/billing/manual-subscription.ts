import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantSubscription } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { requireBillingAdmin } from './admin'
import {
  manualBillingUpdateSchema,
  type ManualBillingUpdateInput,
} from './manual-subscription-model'
import { getBillingPlan } from './plans'
import { getBillingProfileStatus, getTenantBillingProfile } from './profile'

export { manualBillingUpdateSchema, type ManualBillingUpdateInput } from './manual-subscription-model'

export type ManualBillingUpdateResult = {
  planCode: 'starter' | 'growth' | 'pro'
  contractType: 'manual_invoice' | 'manual_pilot'
  status: 'pending_payment' | 'manual_pilot'
  planName: string
  monthlyPriceKrw: number
}

export async function upsertManualTenantSubscription(params: {
  tenantId: string
  userId: string
  input: ManualBillingUpdateInput
}): Promise<ManualBillingUpdateResult> {
  const staffRecord = await requireBillingAdmin(params.tenantId, params.userId)
  const parsed = manualBillingUpdateSchema.parse(params.input)
  const profile = await getTenantBillingProfile(params.tenantId)
  if (getBillingProfileStatus(profile) !== 'complete') {
    throw new Error('BillingProfileIncomplete')
  }

  const plan = getBillingPlan(parsed.planCode)
  if (plan.monthlyPriceKrw === null) {
    throw new Error('ManualBillingPlanUnsupported')
  }

  const status = parsed.mode === 'manual_pilot' ? 'manual_pilot' : 'pending_payment'
  const timestamp = toDBString(now())
  const existingRows = await db
    .select()
    .from(tenantSubscription)
    .where(eq(tenantSubscription.tenantId, params.tenantId))
    .limit(1)
  const existing = existingRows[0]

  if (existing) {
    await db
      .update(tenantSubscription)
      .set({
        planCode: parsed.planCode,
        status,
        contractType: parsed.mode,
        provider: 'manual',
        billingCustomerId: null,
        billingOwnerStaffId: staffRecord.id,
        providerSubscriptionId: null,
        providerPaymentMethodId: null,
        updatedAt: timestamp,
      })
      .where(and(
        eq(tenantSubscription.id, existing.id),
        eq(tenantSubscription.tenantId, params.tenantId),
      ))
  } else {
    await db.insert(tenantSubscription).values({
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      planCode: parsed.planCode,
      status,
      contractType: parsed.mode,
      provider: 'manual',
      billingCustomerId: null,
      billingOwnerStaffId: staffRecord.id,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      nextBillingAt: null,
      cancelAt: null,
      canceledAt: null,
      providerSubscriptionId: null,
      providerPaymentMethodId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  return {
    planCode: parsed.planCode,
    contractType: parsed.mode,
    status,
    planName: plan.name,
    monthlyPriceKrw: plan.monthlyPriceKrw,
  }
}

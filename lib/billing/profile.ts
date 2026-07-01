import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenantBillingProfile } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { requireBillingAdmin } from './admin'
import {
  billingProfileInputSchema,
  formatBusinessRegistrationNumber,
  maskBusinessRegistrationNumber,
  type BillingProfileInput,
  type BillingProfileView,
} from './profile-model'

export {
  billingProfileInputSchema,
  getBillingProfileStatus,
  type BillingProfileInput,
  type BillingProfileStatus,
  type BillingProfileView,
} from './profile-model'

function toBillingProfileView(row: typeof tenantBillingProfile.$inferSelect): BillingProfileView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    businessRegistrationNumber: formatBusinessRegistrationNumber(row.businessRegistrationNumber),
    maskedBusinessRegistrationNumber: maskBusinessRegistrationNumber(row.businessRegistrationNumber),
    businessName: row.businessName,
    representativeName: row.representativeName,
    businessAddress: row.businessAddress,
    businessType: row.businessType,
    businessItem: row.businessItem,
    taxInvoiceEmail: row.taxInvoiceEmail,
    billingContactName: row.billingContactName,
    billingContactPhone: row.billingContactPhone,
    memo: row.memo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getTenantBillingProfile(tenantId: string): Promise<BillingProfileView | null> {
  const rows = await db
    .select()
    .from(tenantBillingProfile)
    .where(eq(tenantBillingProfile.tenantId, tenantId))
    .limit(1)

  return rows[0] ? toBillingProfileView(rows[0]) : null
}

export async function upsertTenantBillingProfile(params: {
  tenantId: string
  userId: string
  input: BillingProfileInput
}): Promise<BillingProfileView> {
  const staffRecord = await requireBillingAdmin(params.tenantId, params.userId)
  const parsed = billingProfileInputSchema.parse(params.input)
  const timestamp = toDBString(now())
  const existingRows = await db
    .select()
    .from(tenantBillingProfile)
    .where(eq(tenantBillingProfile.tenantId, params.tenantId))
    .limit(1)
  const existing = existingRows[0]

  if (existing) {
    await db
      .update(tenantBillingProfile)
      .set({
        ...parsed,
        updatedByStaffId: staffRecord.id,
        updatedAt: timestamp,
      })
      .where(and(
        eq(tenantBillingProfile.id, existing.id),
        eq(tenantBillingProfile.tenantId, params.tenantId),
      ))
    const updated = await getTenantBillingProfile(params.tenantId)
    if (!updated) throw new Error('BillingProfileNotFound')
    return updated
  }

  const created = {
    id: crypto.randomUUID(),
    tenantId: params.tenantId,
    ...parsed,
    createdByStaffId: staffRecord.id,
    updatedByStaffId: staffRecord.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.insert(tenantBillingProfile).values(created)
  return toBillingProfileView(created)
}

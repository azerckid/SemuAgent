import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'

export type BillingAdminStaff = {
  id: string
  role: string
  name: string
  email: string
}

export async function requireBillingAdmin(tenantId: string, userId: string): Promise<BillingAdminStaff> {
  const rows = await db
    .select({
      id: staff.id,
      role: staff.role,
      name: staff.name,
      email: staff.email,
    })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, userId), eq(staff.active, true)))
    .limit(1)

  const staffRecord = rows[0]
  if (!staffRecord || staffRecord.role !== 'TENANT_ADMIN') {
    throw new Error('Forbidden')
  }

  return staffRecord
}

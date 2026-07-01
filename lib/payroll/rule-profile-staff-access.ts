import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, staff } from '@/lib/db/schema'

export type PayrollRuleProfileStaffAccess = {
  tenantId: string
  clientId: string
  staffId: string
  staffRole: 'TENANT_ADMIN' | 'STAFF'
}

/** 급여기준 프로필 API용: tenant 세션 + 고객사 담당자 또는 TENANT_ADMIN. */
export async function requirePayrollRuleProfileStaffAccess(
  clientId: string,
): Promise<PayrollRuleProfileStaffAccess> {
  const { user, tenantId } = await requireTenantSession()

  const [clientRows, staffRows] = await Promise.all([
    db
      .select({ id: client.id, staffId: client.staffId })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1),
  ])

  const clientRow = clientRows[0]
  if (!clientRow) {
    throw new Error('NOT_FOUND')
  }

  const staffRow = staffRows[0]
  if (!staffRow) {
    throw new Error('FORBIDDEN')
  }

  if (staffRow.role !== 'TENANT_ADMIN' && clientRow.staffId !== staffRow.id) {
    throw new Error('FORBIDDEN')
  }

  return {
    tenantId,
    clientId,
    staffId: staffRow.id,
    staffRole: staffRow.role,
  }
}

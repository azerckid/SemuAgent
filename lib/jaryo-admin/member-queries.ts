import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { session, user } from '@/lib/db/auth-schema'
import { staff, tenant } from '@/lib/db/schema'

export const JARYO_ADMIN_MEMBER_PAGE_SIZE = 50

export type ListJaryoAdminMembersParams = {
  q?: string
  page: number
}

export type JaryoAdminMemberTenantMembership = {
  tenantId: string
  tenantName: string
  role: 'TENANT_ADMIN' | 'STAFF'
  active: boolean
}

export type JaryoAdminMemberRow = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: Date
  lastLoginAt: Date | null
  memberships: JaryoAdminMemberTenantMembership[]
}

export type ListJaryoAdminMembersResult = {
  rows: JaryoAdminMemberRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * Global query — searches users across every tenant. Allowed only behind
 * requireJaryoAdminSession(). Never selects from `account` (password hash,
 * OAuth access/refresh/id tokens) or `session.token` — only `session.updatedAt`
 * is read, to derive a last-login timestamp.
 *
 * Pagination is over distinct users, not staff rows: a user with memberships
 * in multiple tenants is one row, not one row per tenant.
 */
export async function listJaryoAdminMembers(params: ListJaryoAdminMembersParams): Promise<ListJaryoAdminMembersResult> {
  const pageSize = JARYO_ADMIN_MEMBER_PAGE_SIZE
  const page = Math.max(1, params.page)

  const whereClause = params.q && params.q.trim().length > 0
    ? sql`lower(${user.email}) like ${`%${params.q.trim().toLowerCase()}%`}`
    : undefined

  const userRows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(whereClause)
    .orderBy(desc(user.createdAt), user.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(whereClause)

  const userIds = userRows.map((row) => row.id)

  const membershipRows = userIds.length > 0
    ? await db
      .select({
        userId: staff.userId,
        tenantId: staff.tenantId,
        tenantName: tenant.name,
        role: staff.role,
        active: staff.active,
      })
      .from(staff)
      .innerJoin(tenant, eq(tenant.id, staff.tenantId))
      .where(inArray(staff.userId, userIds))
    : []

  const lastLoginRows = userIds.length > 0
    ? await db
      .select({ userId: session.userId, lastLoginAt: sql<number>`max(${session.updatedAt})` })
      .from(session)
      .where(inArray(session.userId, userIds))
      .groupBy(session.userId)
    : []

  const membershipsByUser = new Map<string, JaryoAdminMemberTenantMembership[]>()
  for (const row of membershipRows) {
    const list = membershipsByUser.get(row.userId) ?? []
    list.push({ tenantId: row.tenantId, tenantName: row.tenantName, role: row.role, active: row.active })
    membershipsByUser.set(row.userId, list)
  }

  const lastLoginByUser = new Map(lastLoginRows.map((row) => [row.userId, row.lastLoginAt]))

  return {
    rows: userRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
      lastLoginAt: lastLoginByUser.has(row.id) ? new Date(lastLoginByUser.get(row.id) as number) : null,
      memberships: membershipsByUser.get(row.id) ?? [],
    })),
    total: totalRow?.count ?? 0,
    page,
    pageSize,
  }
}

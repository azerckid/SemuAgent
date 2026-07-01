/**
 * org-sync.ts — Better Auth organization/member ↔ JARYO tenant/staff sync
 *
 * Better Auth의 databaseHooks는 user/session/account만 지원하며
 * organization/member는 미지원이므로, 이 서비스 레이어를 통해 명시적으로 동기화한다.
 *
 * 규칙: 조직·멤버 생성·역할 변경은 반드시 이 모듈을 거친다.
 * Better Auth API를 라우트에서 직접 호출하지 않는다.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenant, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { auth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Tenant (= Better Auth Organization)
// ---------------------------------------------------------------------------

export interface CreateTenantInput {
  name: string
  subdomain: string   // Better Auth organization slug
  timezone?: string
}

/**
 * 신규 테넌트(회계법인) 생성.
 *
 * 실행 순서:
 *  1. 세션에서 creator 정보 획득
 *  2. Better Auth organization 생성
 *  3. JARYO tenant 레코드 생성 (id = org.id)
 *  4. creator를 TENANT_ADMIN staff로 등록
 *
 * 3·4 실패 시 Better Auth organization 삭제를 시도해 고아 상태를 방지한다.
 * 보상 삭제도 실패하면 org_id를 로그에 남겨 수동 정리를 유도한다.
 */
export async function createTenantWithOrg(
  input: CreateTenantInput,
  requestHeaders: Headers,
) {
  // 1. creator 정보 획득
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) throw new Error('Unauthorized — must be authenticated to create a tenant')

  const creator = session.user

  // 2. Better Auth organization 생성
  const org = await auth.api.createOrganization({
    body: { name: input.name, slug: input.subdomain },
    headers: requestHeaders,
  })

  // 3 + 4. tenant + creator staff를 트랜잭션으로 묶어 부분 성공 방지.
  // 트랜잭션 실패 시 두 레코드 모두 롤백 → Better Auth org만 남으므로 보상 삭제 시도.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tenant).values({
        id: org.id,
        name: org.name,
        subdomain: org.slug,
        plan: 'free',
        timezone: input.timezone ?? 'Asia/Seoul',
        createdAt: toDBString(now()),
      })

      await tx.insert(staff).values({
        id: crypto.randomUUID(),
        tenantId: org.id,
        userId: creator.id,
        email: creator.email,
        name: creator.name,
        role: 'TENANT_ADMIN',
        createdAt: toDBString(now()),
      })
    })
  } catch (insertError) {
    // 보상: Better Auth org 삭제 시도 (트랜잭션 롤백으로 JARYO 레코드는 이미 없음)
    try {
      await auth.api.deleteOrganization({
        body: { organizationId: org.id },
        headers: requestHeaders,
      })
    } catch (compensationError) {
      console.error(
        `[org-sync] Compensation failed — orphaned org: ${org.id}. Manual cleanup required.`,
        compensationError,
      )
    }
    throw insertError
  }

  return org
}

// ---------------------------------------------------------------------------
// Staff (= Better Auth Member)
// ---------------------------------------------------------------------------

export interface SyncMemberToStaffInput {
  organizationId: string  // tenant_id
  userId: string          // Better Auth user.id
  userEmail: string
  userName: string
  betterAuthRole: 'owner' | 'admin' | 'member'
}

/**
 * Better Auth member 생성·수락 후 호출.
 * JARYO staff 레코드를 upsert한다.
 * owner → TENANT_ADMIN, 나머지 → STAFF
 */
export async function syncMemberToStaff(input: SyncMemberToStaffInput) {
  const role = input.betterAuthRole === 'owner' ? 'TENANT_ADMIN' : 'STAFF'

  const existing = await db.query.staff?.findFirst({
    where: (s, { and: wAnd, eq: wEq }) =>
      wAnd(wEq(s.userId, input.userId), wEq(s.tenantId, input.organizationId)),
  })

  if (existing) {
    await db
      .update(staff)
      .set({ role })
      .where(and(eq(staff.userId, input.userId), eq(staff.tenantId, input.organizationId)))
    return
  }

  await db.insert(staff).values({
    id: crypto.randomUUID(),
    tenantId: input.organizationId,
    userId: input.userId,
    email: input.userEmail,
    name: input.userName,
    role,
    createdAt: toDBString(now()),
  })
}

/**
 * 역할 변경 시 호출. Better Auth member.role과 staff.role을 동기화한다.
 * tenantId를 반드시 포함해 다른 tenant의 staff를 오염시키지 않는다.
 */
export async function syncRoleChange(
  userId: string,
  tenantId: string,
  newBetterAuthRole: 'owner' | 'admin' | 'member',
) {
  const role = newBetterAuthRole === 'owner' ? 'TENANT_ADMIN' : 'STAFF'
  await db
    .update(staff)
    .set({ role })
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId)))
}

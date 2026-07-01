import { randomUUID } from 'crypto'
import { and, desc, eq, isNull, lte, gte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientPayrollRuleProfile, clientPayrollRuleProfileSource } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  effectivePeriodsOverlap,
  normalizeProfileForApproval,
} from '@/lib/payroll/rule-profile-lifecycle'
import {
  clientPayrollRuleProfileV1Schema,
  parseClientPayrollRuleProfile,
  payrollRuleSourceSummarySchema,
  type ClientPayrollRuleProfileV1,
  type PayrollRuleSourceSummary,
} from '@/lib/validations/payroll-rule-profile'

export type ClientPayrollRuleProfileRow = typeof clientPayrollRuleProfile.$inferSelect

/**
 * 고객사별 급여기준 프로필 레지스트리.
 *
 * 모든 쿼리는 tenant_id를 강제한다(멀티테넌트 격리). 읽기는 client_id까지
 * 함께 조건으로 건다. 쓰기는 profile_json/source_summary_json을 Zod로 검증한
 * 뒤에만 저장하고, 신규 생성은 항상 status='draft'로 강제한다(담당자 승인 전
 * 월 급여 계산에 적용되지 않도록).
 */

export async function listClientPayrollRuleProfiles(params: {
  tenantId: string
  clientId: string
}): Promise<ClientPayrollRuleProfileRow[]> {
  return db
    .select()
    .from(clientPayrollRuleProfile)
    .where(
      and(
        eq(clientPayrollRuleProfile.tenantId, params.tenantId),
        eq(clientPayrollRuleProfile.clientId, params.clientId),
      ),
    )
    .orderBy(desc(clientPayrollRuleProfile.version))
}

/**
 * 급여 기간(yyyy-MM)에 유효한 active 프로필을 해석한다. effective_from <= period
 * <= effective_to(또는 무제한)이고 status='active'인 것 중 최신 version. 없으면 null.
 * (yyyy-MM 문자열은 사전순 비교가 시간순과 일치한다.)
 */
export async function getActiveClientPayrollRuleProfile(params: {
  tenantId: string
  clientId: string
  payrollPeriod: string
}): Promise<ClientPayrollRuleProfileRow | null> {
  const rows = await db
    .select()
    .from(clientPayrollRuleProfile)
    .where(
      and(
        eq(clientPayrollRuleProfile.tenantId, params.tenantId),
        eq(clientPayrollRuleProfile.clientId, params.clientId),
        eq(clientPayrollRuleProfile.status, 'active'),
        lte(clientPayrollRuleProfile.effectiveFrom, params.payrollPeriod),
        or(
          isNull(clientPayrollRuleProfile.effectiveTo),
          gte(clientPayrollRuleProfile.effectiveTo, params.payrollPeriod),
        ),
      ),
    )
    .orderBy(desc(clientPayrollRuleProfile.version))
    .limit(1)
  return rows[0] ?? null
}

export type CreateProfileDraftInput = {
  tenantId: string
  clientId: string
  profile: ClientPayrollRuleProfileV1
  sourceSummary: PayrollRuleSourceSummary
  createdByStaffId?: string | null
}

/**
 * 프로필 초안을 생성한다. profile/sourceSummary를 Zod로 검증하고, clientId 일치와
 * status='draft'를 강제한다. 유효기간(effective_from/to)은 별도 입력이 아니라
 * 검증된 profile에서 파생해 단일 진실의 원천을 유지한다. profile row와 source
 * row들은 같은 트랜잭션으로 저장한다. 검증 실패 시 throw(fail closed).
 */
export async function createClientPayrollRuleProfileDraft(
  input: CreateProfileDraftInput,
): Promise<ClientPayrollRuleProfileRow> {
  const parsedProfile = clientPayrollRuleProfileV1Schema.safeParse(input.profile)
  if (!parsedProfile.success) {
    throw new Error('잘못된 급여기준 프로필 JSON입니다')
  }
  if (parsedProfile.data.clientId !== input.clientId) {
    throw new Error('프로필 clientId가 요청 clientId와 일치하지 않습니다')
  }
  const parsedSummary = payrollRuleSourceSummarySchema.safeParse(input.sourceSummary)
  if (!parsedSummary.success) {
    throw new Error('잘못된 급여기준 출처 요약입니다')
  }

  const ts = toDBString(now())
  const profileId = randomUUID()
  const row = {
    id: profileId,
    tenantId: input.tenantId,
    clientId: input.clientId,
    status: 'draft' as const,
    version: 1,
    // 유효기간은 검증된 profile에서 파생(입력과 profile 불일치 방지)
    effectiveFrom: parsedProfile.data.effectiveFrom,
    effectiveTo: parsedProfile.data.effectiveTo ?? null,
    profileJson: JSON.stringify(parsedProfile.data),
    sourceSummaryJson: JSON.stringify(parsedSummary.data),
    approvalNotes: null,
    approvedByStaffId: null,
    approvedAt: null,
    createdByStaffId: input.createdByStaffId ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
  const sourceRows = parsedSummary.data.sources.map((source) => ({
    id: randomUUID(),
    tenantId: input.tenantId,
    profileId,
    clientId: input.clientId,
    sourceType: source.sourceType,
    sourceFileId: source.sourceFileId ?? null,
    sourceHash: source.sourceHash,
    sourceEffectiveFrom: null,
    securityLane: source.securityLane,
    aiProviderMetadataJson: source.aiProviderMetadata ?? null,
    createdAt: ts,
  }))

  await db.transaction(async (tx) => {
    await tx.insert(clientPayrollRuleProfile).values(row)
    if (sourceRows.length > 0) {
      await tx.insert(clientPayrollRuleProfileSource).values(sourceRows)
    }
  })
  return row
}

/** 프로필의 검증된 profile_json을 반환한다. 깨졌으면 null. */
export function readProfileJson(row: ClientPayrollRuleProfileRow): ClientPayrollRuleProfileV1 | null {
  return parseClientPayrollRuleProfile(row.profileJson)
}

export type ClientPayrollRuleProfileSourceRow = typeof clientPayrollRuleProfileSource.$inferSelect

export async function listClientPayrollRuleProfileSources(params: {
  tenantId: string
  clientId: string
  profileId: string
}): Promise<ClientPayrollRuleProfileSourceRow[]> {
  return db
    .select()
    .from(clientPayrollRuleProfileSource)
    .where(
      and(
        eq(clientPayrollRuleProfileSource.tenantId, params.tenantId),
        eq(clientPayrollRuleProfileSource.clientId, params.clientId),
        eq(clientPayrollRuleProfileSource.profileId, params.profileId),
      ),
    )
}

/** 한 고객사의 모든 프로필 출처를 조회한다(tenant+client 격리). 상태 패널 집계용. */
export async function listClientPayrollRuleProfileSourcesByClient(params: {
  tenantId: string
  clientId: string
}): Promise<ClientPayrollRuleProfileSourceRow[]> {
  return db
    .select()
    .from(clientPayrollRuleProfileSource)
    .where(
      and(
        eq(clientPayrollRuleProfileSource.tenantId, params.tenantId),
        eq(clientPayrollRuleProfileSource.clientId, params.clientId),
      ),
    )
}

export type ProfileLifecycleResult =
  | { success: true; profile: ClientPayrollRuleProfileRow }
  | { success: false; status: 404 | 409 | 422; error: string; code?: string }

export async function getClientPayrollRuleProfile(params: {
  tenantId: string
  clientId: string
  profileId: string
}): Promise<ClientPayrollRuleProfileRow | null> {
  const rows = await db
    .select()
    .from(clientPayrollRuleProfile)
    .where(
      and(
        eq(clientPayrollRuleProfile.id, params.profileId),
        eq(clientPayrollRuleProfile.tenantId, params.tenantId),
        eq(clientPayrollRuleProfile.clientId, params.clientId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function approveClientPayrollRuleProfile(params: {
  tenantId: string
  clientId: string
  profileId: string
  approvedByStaffId: string
  effectiveFrom: string
  effectiveTo?: string | null
  approvalNotes?: string | null
  supersedeConfirmed?: boolean
}): Promise<ProfileLifecycleResult> {
  const row = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!row) {
    return { success: false, status: 404, error: '급여기준 프로필을 찾을 수 없습니다' }
  }
  if (row.status !== 'draft') {
    return { success: false, status: 422, error: '초안 상태의 프로필만 승인할 수 있습니다', code: 'invalid_status' }
  }

  const parsedProfile = readProfileJson(row)
  if (!parsedProfile) {
    return { success: false, status: 422, error: '프로필 JSON이 손상되어 승인할 수 없습니다', code: 'invalid_profile' }
  }

  const sources = await listClientPayrollRuleProfileSources({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (sources.some((source) => source.securityLane === 'tee_required')) {
    return {
      success: false,
      status: 422,
      error: '민감정보 보안 처리 경로가 필요한 출처는 승인할 수 없습니다',
      code: 'tee_required',
    }
  }

  const normalized = normalizeProfileForApproval(
    parsedProfile,
    params.effectiveFrom,
    params.effectiveTo ?? null,
  )
  if (!normalized.ok) {
    return {
      success: false,
      status: 422,
      error: normalized.message,
      code: normalized.code,
    }
  }

  const effectiveTo = params.effectiveTo ?? null
  const ts = toDBString(now())

  let txFailure: ProfileLifecycleResult | null = null

  await db.transaction(async (tx) => {
    const overlappingActive = (
      await tx
        .select()
        .from(clientPayrollRuleProfile)
        .where(
          and(
            eq(clientPayrollRuleProfile.tenantId, params.tenantId),
            eq(clientPayrollRuleProfile.clientId, params.clientId),
            eq(clientPayrollRuleProfile.status, 'active'),
          ),
        )
    ).filter((active) =>
      effectivePeriodsOverlap(
        params.effectiveFrom,
        effectiveTo,
        active.effectiveFrom,
        active.effectiveTo,
      ),
    )

    if (overlappingActive.length > 0 && !params.supersedeConfirmed) {
      txFailure = {
        success: false,
        status: 409,
        error: '동일 유효기간에 승인된 급여기준이 있습니다. 기존 기준을 대체하려면 확인이 필요합니다',
        code: 'overlap_requires_supersede',
      }
      return
    }

    const versionRows = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${clientPayrollRuleProfile.version}), 0)` })
      .from(clientPayrollRuleProfile)
      .where(
        and(
          eq(clientPayrollRuleProfile.tenantId, params.tenantId),
          eq(clientPayrollRuleProfile.clientId, params.clientId),
        ),
      )
    const nextVersion = (versionRows[0]?.maxVersion ?? 0) + 1

    if (overlappingActive.length > 0) {
      for (const active of overlappingActive) {
        await tx
          .update(clientPayrollRuleProfile)
          .set({ status: 'superseded', updatedAt: ts })
          .where(
            and(
              eq(clientPayrollRuleProfile.id, active.id),
              eq(clientPayrollRuleProfile.tenantId, params.tenantId),
              eq(clientPayrollRuleProfile.clientId, params.clientId),
              eq(clientPayrollRuleProfile.status, 'active'),
            ),
          )
      }
    }

    const activateResult = await tx
      .update(clientPayrollRuleProfile)
      .set({
        status: 'active',
        version: nextVersion,
        effectiveFrom: params.effectiveFrom,
        effectiveTo,
        profileJson: JSON.stringify(normalized.profile),
        approvalNotes: params.approvalNotes ?? null,
        approvedByStaffId: params.approvedByStaffId,
        approvedAt: ts,
        updatedAt: ts,
      })
      .where(
        and(
          eq(clientPayrollRuleProfile.id, params.profileId),
          eq(clientPayrollRuleProfile.tenantId, params.tenantId),
          eq(clientPayrollRuleProfile.clientId, params.clientId),
          eq(clientPayrollRuleProfile.status, 'draft'),
        ),
      )

    if (activateResult.rowsAffected === 0) {
      txFailure = {
        success: false,
        status: 409,
        error: '다른 요청이 먼저 이 프로필의 상태를 변경했습니다. 새로고침 후 다시 시도해 주세요',
        code: 'concurrent_update',
      }
    }
  })

  if (txFailure) {
    return txFailure
  }

  const updated = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!updated || updated.status !== 'active') {
    return {
      success: false,
      status: 409,
      error: '다른 요청이 먼저 이 프로필의 상태를 변경했습니다. 새로고침 후 다시 시도해 주세요',
      code: 'concurrent_update',
    }
  }

  return { success: true, profile: updated }
}

export async function rejectClientPayrollRuleProfile(params: {
  tenantId: string
  clientId: string
  profileId: string
  reason?: string | null
}): Promise<ProfileLifecycleResult> {
  const row = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!row) {
    return { success: false, status: 404, error: '급여기준 프로필을 찾을 수 없습니다' }
  }
  if (row.status !== 'draft') {
    return { success: false, status: 422, error: '초안 상태의 프로필만 거부할 수 있습니다', code: 'invalid_status' }
  }

  const ts = toDBString(now())
  const result = await db
    .update(clientPayrollRuleProfile)
    .set({
      status: 'rejected',
      approvalNotes: params.reason ?? row.approvalNotes,
      updatedAt: ts,
    })
    .where(
      and(
        eq(clientPayrollRuleProfile.id, params.profileId),
        eq(clientPayrollRuleProfile.tenantId, params.tenantId),
        eq(clientPayrollRuleProfile.clientId, params.clientId),
        eq(clientPayrollRuleProfile.status, 'draft'),
      ),
    )

  if (result.rowsAffected === 0) {
    return {
      success: false,
      status: 409,
      error: '다른 요청이 먼저 이 프로필의 상태를 변경했습니다. 새로고침 후 다시 시도해 주세요',
      code: 'concurrent_update',
    }
  }

  const updated = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!updated) {
    return { success: false, status: 404, error: '급여기준 프로필을 찾을 수 없습니다' }
  }
  return { success: true, profile: updated }
}

export async function retireClientPayrollRuleProfile(params: {
  tenantId: string
  clientId: string
  profileId: string
  reason?: string | null
}): Promise<ProfileLifecycleResult> {
  const row = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!row) {
    return { success: false, status: 404, error: '급여기준 프로필을 찾을 수 없습니다' }
  }
  if (row.status !== 'active') {
    return { success: false, status: 422, error: '승인된(active) 프로필만 폐기할 수 있습니다', code: 'invalid_status' }
  }

  const ts = toDBString(now())
  const result = await db
    .update(clientPayrollRuleProfile)
    .set({
      status: 'retired',
      approvalNotes: params.reason ?? row.approvalNotes,
      updatedAt: ts,
    })
    .where(
      and(
        eq(clientPayrollRuleProfile.id, params.profileId),
        eq(clientPayrollRuleProfile.tenantId, params.tenantId),
        eq(clientPayrollRuleProfile.clientId, params.clientId),
        eq(clientPayrollRuleProfile.status, 'active'),
      ),
    )

  if (result.rowsAffected === 0) {
    return {
      success: false,
      status: 409,
      error: '다른 요청이 먼저 이 프로필의 상태를 변경했습니다. 새로고침 후 다시 시도해 주세요',
      code: 'concurrent_update',
    }
  }

  const updated = await getClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    profileId: params.profileId,
  })
  if (!updated) {
    return { success: false, status: 404, error: '급여기준 프로필을 찾을 수 없습니다' }
  }
  return { success: true, profile: updated }
}

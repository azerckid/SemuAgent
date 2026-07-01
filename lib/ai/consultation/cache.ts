import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { DateTime } from 'luxon'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consultationSourceCache } from '@/lib/db/schema'
import {
  NormalizedSource,
  type NormalizedSource as NormalizedSourceType,
  type SourceType,
} from './schemas'

// ---------------------------------------------------------------------------
// TTL policy (doc 69 §8-1)
//   캐시 한 행(response_json)에는 여러 sourceType이 섞인 검색 결과가 함께
//   담긴다. 따라서 행의 만료는 그 안에 포함된 source들 중 "가장 짧은" TTL을
//   따른다. 결과가 비어 있으면 기본(법령) TTL을 적용한다.
// ---------------------------------------------------------------------------

const TTL_SECONDS_BY_SOURCE_TYPE: Record<SourceType, number> = {
  statute: 604_800, // 7일 — 법령 본문은 준정적
  enforcement_decree: 604_800, // 7일 — 시행령도 동일
  ministerial_order: 259_200, // 3일 — 시행규칙은 더 자주 갱신
  administrative_rule: 86_400, // 1일 — 행정규칙은 변경이 잦음
  unknown: 86_400, // 1일 — 유형 불명 시 보수적으로 최단
}

const DEFAULT_TTL_SECONDS = TTL_SECONDS_BY_SOURCE_TYPE.statute

// 운영/테스트용 선택적 오버라이드. 설정 시 모든 행에 단일 TTL을 강제한다.
const ttlOverrideSchema = z.object({
  LAW_CACHE_TTL_SEC: z.coerce.number().int().min(1).optional(),
})

function resolveTtlSeconds(sources: NormalizedSourceType[]): number {
  const override = ttlOverrideSchema.parse(process.env).LAW_CACHE_TTL_SEC
  if (override !== undefined) return override
  if (sources.length === 0) return DEFAULT_TTL_SECONDS
  return Math.min(
    ...sources.map(
      (s) => TTL_SECONDS_BY_SOURCE_TYPE[s.sourceType] ?? TTL_SECONDS_BY_SOURCE_TYPE.unknown,
    ),
  )
}

export type ConsultationCacheSource = 'law'

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function buildQueryHash(source: ConsultationCacheSource, query: string | undefined): string {
  const normalizedQuery = (query ?? '').trim().toLowerCase()
  return createHash('sha256').update(`${source}:${normalizedQuery}`).digest('hex')
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type CachedSourcesResult = {
  sources: NormalizedSourceType[]
  totalCount: number
  cachedAt: string
}

/**
 * Returns cached sources when a non-expired entry exists, otherwise null.
 * Global cache (no tenant scoping) — law.go.kr data is public reference material.
 */
export async function getCachedSources(params: {
  source: ConsultationCacheSource
  query?: string
}): Promise<CachedSourcesResult | null> {
  const queryHash = buildQueryHash(params.source, params.query)

  const [row] = await db
    .select()
    .from(consultationSourceCache)
    .where(eq(consultationSourceCache.queryHash, queryHash))
    .limit(1)

  if (!row) return null

  // TTL 만료 검사 (Luxon UTC 비교)
  const expiresAt = DateTime.fromISO(row.expiresAt, { zone: 'utc' })
  if (!expiresAt.isValid || expiresAt <= DateTime.utc()) {
    return null
  }

  let rawJson: unknown
  try {
    rawJson = JSON.parse(row.responseJson)
  } catch {
    // 손상된 JSON — miss로 처리해 새로 가져오게 한다.
    return null
  }

  const parsed = z.array(NormalizedSource).safeParse(rawJson)
  if (!parsed.success) {
    // 스키마 불일치 캐시 — miss로 처리해 새로 가져오게 한다.
    return null
  }

  return {
    sources: parsed.data,
    totalCount: row.totalCount,
    cachedAt: row.cachedAt,
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upserts a cache entry keyed by query_hash with a fresh TTL window.
 */
export async function setCachedSources(params: {
  source: ConsultationCacheSource
  query?: string
  sources: NormalizedSourceType[]
  totalCount: number
}): Promise<void> {
  const queryHash = buildQueryHash(params.source, params.query)
  const cachedAt = DateTime.utc()
  const expiresAt = cachedAt.plus({ seconds: resolveTtlSeconds(params.sources) })

  const responseJson = JSON.stringify(params.sources)

  await db
    .insert(consultationSourceCache)
    .values({
      id: randomUUID(),
      queryHash,
      source: params.source,
      responseJson,
      totalCount: params.totalCount,
      cachedAt: cachedAt.toISO() ?? '',
      expiresAt: expiresAt.toISO() ?? '',
    })
    .onConflictDoUpdate({
      target: consultationSourceCache.queryHash,
      set: {
        responseJson,
        totalCount: params.totalCount,
        cachedAt: cachedAt.toISO() ?? '',
        expiresAt: expiresAt.toISO() ?? '',
      },
    })
}

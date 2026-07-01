import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { DateTime } from 'luxon'
import * as appSchema from '@/lib/db/schema'
import { type NormalizedSource } from './schemas'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE consultation_source_cache (
      id text PRIMARY KEY,
      query_hash text NOT NULL,
      source text NOT NULL,
      response_json text NOT NULL,
      total_count integer NOT NULL,
      cached_at text NOT NULL,
      expires_at text NOT NULL
    )
  `)
  await client.execute(
    `CREATE UNIQUE INDEX consultation_source_cache_query_hash_uidx
       ON consultation_source_cache(query_hash)`,
  )
})

beforeEach(async () => {
  await client.execute(`DELETE FROM consultation_source_cache`)
  vi.unstubAllEnvs()
})

// Import after the mock is set up
const { getCachedSources, setCachedSources } = await import('./cache')

function sampleSource(overrides: Partial<NormalizedSource> = {}): NormalizedSource {
  return {
    sourceId: 'law.go.kr/010719',
    sourceType: 'statute',
    title: '개인정보 보호법',
    shortName: '개인정보법',
    url: 'https://www.law.go.kr/DRF/lawService.do?MST=010719',
    agency: '개인정보보호위원회',
    publishedAt: '2023-08-08T00:00:00.000Z',
    effectiveAt: '2023-08-08T00:00:00.000Z',
    status: 'active',
    authorityLevel: 'official_law',
    freshness: 'fresh',
    retrievedAt: '2026-06-17T00:00:00.000Z',
    metadata: { serialNumber: '253527' },
    ...overrides,
  }
}

describe('consultation source cache', () => {
  it('returns null on cache miss', async () => {
    const result = await getCachedSources({ source: 'law', query: '없는검색어' })
    expect(result).toBeNull()
  })

  it('stores and retrieves sources (cache hit)', async () => {
    const sources = [sampleSource()]
    await setCachedSources({ source: 'law', query: '개인정보', sources, totalCount: 1 })

    const result = await getCachedSources({ source: 'law', query: '개인정보' })
    expect(result).not.toBeNull()
    expect(result?.sources).toHaveLength(1)
    expect(result?.sources[0].sourceId).toBe('law.go.kr/010719')
    expect(result?.totalCount).toBe(1)
  })

  it('normalizes query for hashing (case + whitespace insensitive)', async () => {
    await setCachedSources({ source: 'law', query: '개인정보', sources: [sampleSource()], totalCount: 1 })

    const result = await getCachedSources({ source: 'law', query: '  개인정보  ' })
    expect(result).not.toBeNull()
  })

  it('treats different queries as different cache keys', async () => {
    await setCachedSources({ source: 'law', query: '개인정보', sources: [sampleSource()], totalCount: 1 })

    const result = await getCachedSources({ source: 'law', query: '법인세' })
    expect(result).toBeNull()
  })

  it('returns null when entry is expired (TTL=1s, cached in the past)', async () => {
    vi.stubEnv('LAW_CACHE_TTL_SEC', '1')
    await setCachedSources({ source: 'law', query: '개인정보', sources: [sampleSource()], totalCount: 1 })

    // Force expiry by rewriting expires_at into the past
    const past = DateTime.utc().minus({ minutes: 5 }).toISO()
    await client.execute({
      sql: `UPDATE consultation_source_cache SET expires_at = ?`,
      args: [past],
    })

    const result = await getCachedSources({ source: 'law', query: '개인정보' })
    expect(result).toBeNull()
  })

  it('upserts on conflict (same query overwrites previous entry)', async () => {
    await setCachedSources({ source: 'law', query: '개인정보', sources: [sampleSource()], totalCount: 1 })
    await setCachedSources({
      source: 'law',
      query: '개인정보',
      sources: [sampleSource({ title: '개정된 개인정보 보호법' }), sampleSource({ sourceId: 'law.go.kr/2' })],
      totalCount: 2,
    })

    const result = await getCachedSources({ source: 'law', query: '개인정보' })
    expect(result?.sources).toHaveLength(2)
    expect(result?.totalCount).toBe(2)
    expect(result?.sources[0].title).toBe('개정된 개인정보 보호법')

    // Confirm only one row exists (upsert, not insert)
    const count = await client.execute(`SELECT COUNT(*) AS c FROM consultation_source_cache`)
    expect(Number(count.rows[0].c)).toBe(1)
  })

  it('returns null when stored JSON is corrupted', async () => {
    await setCachedSources({ source: 'law', query: '개인정보', sources: [sampleSource()], totalCount: 1 })
    await client.execute(`UPDATE consultation_source_cache SET response_json = '{not valid'`)

    const result = await getCachedSources({ source: 'law', query: '개인정보' })
    expect(result).toBeNull()
  })

  it('caches the default listing (no query) under a stable key', async () => {
    await setCachedSources({ source: 'law', sources: [sampleSource()], totalCount: 5588 })

    const result = await getCachedSources({ source: 'law' })
    expect(result).not.toBeNull()
    expect(result?.totalCount).toBe(5588)
  })

  it('does not store the raw query text (privacy: query column removed)', async () => {
    await setCachedSources({ source: 'law', query: '대표 김철수 퇴직금', sources: [sampleSource()], totalCount: 1 })

    const cols = await client.execute(`PRAGMA table_info(consultation_source_cache)`)
    const names = cols.rows.map((r) => r.name)
    expect(names).not.toContain('query')
  })
})

describe('consultation source cache — TTL per source type (doc 69 §8-1)', () => {
  async function readTtlSeconds(): Promise<number> {
    const row = await client.execute(
      `SELECT cached_at, expires_at FROM consultation_source_cache LIMIT 1`,
    )
    const { cached_at, expires_at } = row.rows[0] as unknown as {
      cached_at: string
      expires_at: string
    }
    const cachedAt = DateTime.fromISO(cached_at, { zone: 'utc' })
    const expiresAt = DateTime.fromISO(expires_at, { zone: 'utc' })
    return Math.round(expiresAt.diff(cachedAt, 'seconds').seconds)
  }

  it('applies 7-day TTL for statute', async () => {
    await setCachedSources({ source: 'law', query: 's', sources: [sampleSource({ sourceType: 'statute' })], totalCount: 1 })
    expect(await readTtlSeconds()).toBe(604_800)
  })

  it('applies 3-day TTL for ministerial_order', async () => {
    await setCachedSources({ source: 'law', query: 'm', sources: [sampleSource({ sourceType: 'ministerial_order' })], totalCount: 1 })
    expect(await readTtlSeconds()).toBe(259_200)
  })

  it('applies 1-day TTL for administrative_rule', async () => {
    await setCachedSources({ source: 'law', query: 'a', sources: [sampleSource({ sourceType: 'administrative_rule' })], totalCount: 1 })
    expect(await readTtlSeconds()).toBe(86_400)
  })

  it('uses the SHORTEST TTL when a row mixes source types', async () => {
    await setCachedSources({
      source: 'law',
      query: 'mixed',
      sources: [
        sampleSource({ sourceType: 'statute' }),
        sampleSource({ sourceType: 'administrative_rule' }),
      ],
      totalCount: 2,
    })
    expect(await readTtlSeconds()).toBe(86_400)
  })

  it('falls back to the default (statute) TTL for an empty result set', async () => {
    await setCachedSources({ source: 'law', query: 'empty', sources: [], totalCount: 0 })
    expect(await readTtlSeconds()).toBe(604_800)
  })

  it('lets LAW_CACHE_TTL_SEC override force a single TTL for all rows', async () => {
    vi.stubEnv('LAW_CACHE_TTL_SEC', '42')
    await setCachedSources({ source: 'law', query: 'override', sources: [sampleSource({ sourceType: 'administrative_rule' })], totalCount: 1 })
    expect(await readTtlSeconds()).toBe(42)
  })
})

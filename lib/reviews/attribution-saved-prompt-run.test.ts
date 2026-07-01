import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const mocks = vi.hoisted(() => ({
  getBookkeepingMaterialAttribution: vi.fn(),
}))

vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getBookkeepingMaterialAttribution: mocks.getBookkeepingMaterialAttribution,
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE review_attribution_saved_prompt (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      description text,
      prompt_text text NOT NULL,
      compiled_filter_json text NOT NULL,
      filter_version integer NOT NULL DEFAULT 1,
      scope text NOT NULL DEFAULT 'tenant',
      work_type text NOT NULL DEFAULT 'bookkeeping',
      is_active integer NOT NULL DEFAULT 1,
      sort_order integer NOT NULL DEFAULT 0,
      created_by_staff_id text,
      updated_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM review_attribution_saved_prompt')
  mocks.getBookkeepingMaterialAttribution.mockReset()
})

const { runAttributionSavedPrompt } = await import('./attribution-saved-prompt-run')

async function insertPrompt(overrides: Partial<typeof appSchema.reviewAttributionSavedPrompt.$inferInsert> = {}) {
  await testDb.insert(appSchema.reviewAttributionSavedPrompt).values({
    id: 'prompt-1',
    tenantId: 'tenant-1',
    name: '큰 금액',
    description: null,
    promptText: '200만원 이상만',
    compiledFilterJson: JSON.stringify({
      version: 1,
      amountKrw: { min: 2_000_000 },
      explanationKo: '2,000,000원 이상',
    }),
    filterVersion: 1,
    scope: 'tenant',
    workType: 'bookkeeping',
    isActive: true,
    sortOrder: 0,
    createdByStaffId: 'staff-1',
    updatedByStaffId: 'staff-1',
    createdAt: '2026-06-25 00:00:00',
    updatedAt: '2026-06-25 00:00:00',
    ...overrides,
  })
}

describe('runAttributionSavedPrompt', () => {
  it('does not run prompts that belong to another tenant', async () => {
    await insertPrompt({ id: 'prompt-other-tenant', tenantId: 'tenant-2' })

    const result = await runAttributionSavedPrompt({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      promptId: 'prompt-other-tenant',
      staffRecord: { id: 'staff-1', role: 'STAFF' },
    })

    expect(result).toEqual({ ok: false, status: 404, error: '저장 프롬프트를 찾을 수 없습니다.' })
    expect(mocks.getBookkeepingMaterialAttribution).not.toHaveBeenCalled()
  })

  it('propagates session tenant isolation failures from the attribution loader', async () => {
    await insertPrompt({ id: 'prompt-1', tenantId: 'tenant-1' })
    mocks.getBookkeepingMaterialAttribution.mockResolvedValue({
      ok: false,
      status: 404,
      error: '세션을 찾을 수 없습니다.',
    })

    const result = await runAttributionSavedPrompt({
      tenantId: 'tenant-1',
      sessionId: 'session-other-tenant',
      promptId: 'prompt-1',
      staffRecord: { id: 'staff-1', role: 'STAFF' },
    })

    expect(result).toEqual({ ok: false, status: 404, error: '세션을 찾을 수 없습니다.' })
    expect(mocks.getBookkeepingMaterialAttribution).toHaveBeenCalledWith({
      sessionId: 'session-other-tenant',
      tenantId: 'tenant-1',
      staffRecord: { id: 'staff-1', role: 'STAFF' },
    })
  })

  it('blocks prompt extraction when requested period data is missing', async () => {
    await insertPrompt({ id: 'prompt-1', tenantId: 'tenant-1' })
    mocks.getBookkeepingMaterialAttribution.mockResolvedValue({
      ok: true,
      rows: [{ id: 'row-1', uploadFileId: 'file-1', sourceLabel: 'a', periodRelation: 'prior' }],
      summary: {
        requestedPeriod: '2026-06',
        closePeriod: '2026-04~2026-06',
        total: 278,
        include: 200,
        hold: 0,
        excludeDuplicate: 0,
        referenceOnly: 78,
        prior: 278,
        future: 0,
        unknown: 0,
        possibleDuplicate: 0,
        requestedInPeriod: 0,
        inCloseWindow: 278,
        outOfScope: 0,
        inCloseWindowPeriods: ['2026-04', '2026-05'],
        outOfScopePeriods: [],
      },
    })

    const result = await runAttributionSavedPrompt({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      promptId: 'prompt-1',
      staffRecord: { id: 'staff-1', role: 'STAFF' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('notReady')
    expect(result.notReadyReason).toContain('요청 기간(2026-06)에 해당하는 거래가 확인되지 않습니다.')
    expect(result.notReadyReason).toContain('프롬프트 추출은 보충 자료 업로드 후 다시 시도해 주세요.')
    expect(result.rows).toEqual([])
  })
})

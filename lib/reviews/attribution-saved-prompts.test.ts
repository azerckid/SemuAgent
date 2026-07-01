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
  interpretReviewAttributionPrompt: vi.fn(),
}))

vi.mock('@/lib/ai/review-attribution-prompt-interpret', () => ({
  interpretReviewAttributionPrompt: mocks.interpretReviewAttributionPrompt,
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
  mocks.interpretReviewAttributionPrompt.mockReset()
  mocks.interpretReviewAttributionPrompt.mockResolvedValue({
    ok: true,
    spec: { version: 1, amountKrw: { min: 2_000_000 }, explanationKo: '2,000,000원 이상' },
  })
})

const {
  createAttributionSavedPrompt,
  listAttributionSavedPrompts,
  updateAttributionSavedPrompt,
} = await import('./attribution-saved-prompts')

function validFilterJson(label = '2,000,000원 이상') {
  return JSON.stringify({ version: 1, amountKrw: { min: 2_000_000 }, explanationKo: label })
}

async function insertPrompt(overrides: Partial<typeof appSchema.reviewAttributionSavedPrompt.$inferInsert> = {}) {
  await testDb.insert(appSchema.reviewAttributionSavedPrompt).values({
    id: 'prompt-1',
    tenantId: 'tenant-1',
    name: '큰 금액',
    description: null,
    promptText: '200만원 이상만',
    compiledFilterJson: validFilterJson(),
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

describe('attribution saved prompt service', () => {
  it('lists only prompts for the requested tenant by default', async () => {
    await insertPrompt({ id: 'tenant-1-active', tenantId: 'tenant-1', isActive: true })
    await insertPrompt({ id: 'tenant-1-inactive', tenantId: 'tenant-1', isActive: false })
    await insertPrompt({ id: 'tenant-2-active', tenantId: 'tenant-2', isActive: true })

    const activeOnly = await listAttributionSavedPrompts({ tenantId: 'tenant-1' })
    const includeInactive = await listAttributionSavedPrompts({ tenantId: 'tenant-1', includeInactive: true })

    expect(activeOnly.map((prompt) => prompt.id)).toEqual(['tenant-1-active'])
    expect(includeInactive.map((prompt) => prompt.id).sort()).toEqual(['tenant-1-active', 'tenant-1-inactive'])
  })

  it('does not update prompts from another tenant', async () => {
    await insertPrompt({ id: 'prompt-other-tenant', tenantId: 'tenant-2', name: '원래 이름' })

    const result = await updateAttributionSavedPrompt({
      tenantId: 'tenant-1',
      staffId: 'staff-1',
      promptId: 'prompt-other-tenant',
      name: '수정 시도',
    })
    const allPrompts = await listAttributionSavedPrompts({ tenantId: 'tenant-2', includeInactive: true })

    expect(result).toEqual({ ok: false, status: 404, error: '저장 프롬프트를 찾을 수 없습니다.' })
    expect(allPrompts[0]?.name).toBe('원래 이름')
    expect(mocks.interpretReviewAttributionPrompt).not.toHaveBeenCalled()
  })

  it('fails closed and does not insert when AI interpretation fails', async () => {
    mocks.interpretReviewAttributionPrompt.mockResolvedValue({ ok: false, error: 'invalid JSON' })

    const result = await createAttributionSavedPrompt({
      tenantId: 'tenant-1',
      staffId: 'staff-1',
      name: '해석 실패',
      promptText: '모호한 조건',
    })
    const prompts = await listAttributionSavedPrompts({ tenantId: 'tenant-1', includeInactive: true })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(prompts).toEqual([])
  })
})

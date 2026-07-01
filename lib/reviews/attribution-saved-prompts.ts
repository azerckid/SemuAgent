import { randomUUID } from 'crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reviewAttributionSavedPrompt } from '@/lib/db/schema'
import { interpretReviewAttributionPrompt } from '@/lib/ai/review-attribution-prompt-interpret'
import { parseReviewAttributionFilterSpecJson } from '@/lib/reviews/attribution-saved-prompt-filter-schema'
import { now, toDBString } from '@/lib/time'

export type AttributionSavedPromptSummary = {
  id: string
  name: string
  description: string | null
  promptText: string
  explanationKo: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

function toSummary(row: typeof reviewAttributionSavedPrompt.$inferSelect): AttributionSavedPromptSummary | null {
  const parsed = parseReviewAttributionFilterSpecJson(row.compiledFilterJson)
  if (!parsed.success) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    promptText: row.promptText,
    explanationKo: parsed.data.explanationKo,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  }
}

export async function listAttributionSavedPrompts(params: {
  tenantId: string
  includeInactive?: boolean
}): Promise<AttributionSavedPromptSummary[]> {
  const conditions = [eq(reviewAttributionSavedPrompt.tenantId, params.tenantId)]
  if (!params.includeInactive) {
    conditions.push(eq(reviewAttributionSavedPrompt.isActive, true))
  }

  const rows = await db
    .select()
    .from(reviewAttributionSavedPrompt)
    .where(and(...conditions))
    .orderBy(asc(reviewAttributionSavedPrompt.sortOrder), desc(reviewAttributionSavedPrompt.updatedAt))

  return rows.map(toSummary).filter((row): row is AttributionSavedPromptSummary => row !== null)
}

export async function getAttributionSavedPromptById(params: {
  tenantId: string
  promptId: string
  activeOnly?: boolean
}) {
  const conditions = [
    eq(reviewAttributionSavedPrompt.tenantId, params.tenantId),
    eq(reviewAttributionSavedPrompt.id, params.promptId),
  ]
  if (params.activeOnly) {
    conditions.push(eq(reviewAttributionSavedPrompt.isActive, true))
  }

  const [row] = await db
    .select()
    .from(reviewAttributionSavedPrompt)
    .where(and(...conditions))
    .limit(1)

  if (!row) return null
  return toSummary(row)
}

export async function createAttributionSavedPrompt(params: {
  tenantId: string
  staffId: string
  name: string
  description?: string | null
  promptText: string
  requestedPeriod?: string
  closePeriod?: string
}) {
  const interpreted = await interpretReviewAttributionPrompt({
    promptText: params.promptText,
    requestedPeriod: params.requestedPeriod,
    closePeriod: params.closePeriod,
  })

  if (!interpreted.ok) {
    return { ok: false as const, status: 400, error: '이 프롬프트를 안전한 검토 조건으로 해석하지 못했습니다. 금액, 기간 관계, 거래처, 적요, 중복 상태처럼 명확한 조건으로 다시 입력해 주세요.' }
  }

  const id = randomUUID()
  const ts = toDBString(now())

  await db.insert(reviewAttributionSavedPrompt).values({
    id,
    tenantId: params.tenantId,
    name: params.name,
    description: params.description?.trim() || null,
    promptText: params.promptText,
    compiledFilterJson: JSON.stringify(interpreted.spec),
    filterVersion: interpreted.spec.version,
    scope: 'tenant',
    workType: 'bookkeeping',
    isActive: true,
    sortOrder: 0,
    createdByStaffId: params.staffId,
    updatedByStaffId: params.staffId,
    createdAt: ts,
    updatedAt: ts,
  })

  const summary = await getAttributionSavedPromptById({ tenantId: params.tenantId, promptId: id })
  if (!summary) {
    return { ok: false as const, status: 500, error: '저장된 프롬프트를 불러오지 못했습니다.' }
  }

  return { ok: true as const, prompt: summary }
}

export async function updateAttributionSavedPrompt(params: {
  tenantId: string
  staffId: string
  promptId: string
  name?: string
  description?: string | null
  promptText?: string
  isActive?: boolean
  sortOrder?: number
  requestedPeriod?: string
  closePeriod?: string
}) {
  const [existing] = await db
    .select()
    .from(reviewAttributionSavedPrompt)
    .where(
      and(
        eq(reviewAttributionSavedPrompt.tenantId, params.tenantId),
        eq(reviewAttributionSavedPrompt.id, params.promptId),
      ),
    )
    .limit(1)

  if (!existing) {
    return { ok: false as const, status: 404, error: '저장 프롬프트를 찾을 수 없습니다.' }
  }

  let compiledFilterJson = existing.compiledFilterJson
  let filterVersion = existing.filterVersion
  let promptText = existing.promptText

  if (params.promptText !== undefined) {
    const interpreted = await interpretReviewAttributionPrompt({
      promptText: params.promptText,
      requestedPeriod: params.requestedPeriod,
      closePeriod: params.closePeriod,
    })
    if (!interpreted.ok) {
      return { ok: false as const, status: 400, error: '이 프롬프트를 안전한 검토 조건으로 해석하지 못했습니다. 금액, 기간 관계, 거래처, 적요, 중복 상태처럼 명확한 조건으로 다시 입력해 주세요.' }
    }
    compiledFilterJson = JSON.stringify(interpreted.spec)
    filterVersion = interpreted.spec.version
    promptText = params.promptText
  }

  const ts = toDBString(now())
  await db
    .update(reviewAttributionSavedPrompt)
    .set({
      name: params.name ?? existing.name,
      description: params.description !== undefined ? (params.description?.trim() || null) : existing.description,
      promptText,
      compiledFilterJson,
      filterVersion,
      isActive: params.isActive ?? existing.isActive,
      sortOrder: params.sortOrder ?? existing.sortOrder,
      updatedByStaffId: params.staffId,
      updatedAt: ts,
    })
    .where(
      and(
        eq(reviewAttributionSavedPrompt.tenantId, params.tenantId),
        eq(reviewAttributionSavedPrompt.id, params.promptId),
      ),
    )

  const summary = await getAttributionSavedPromptById({ tenantId: params.tenantId, promptId: params.promptId })
  if (!summary) {
    return { ok: false as const, status: 500, error: '수정된 프롬프트를 불러오지 못했습니다.' }
  }

  return { ok: true as const, prompt: summary }
}

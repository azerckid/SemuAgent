import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reviewAttributionSavedPrompt, uploadFile } from '@/lib/db/schema'
import {
  getBookkeepingMaterialAttribution,
} from '@/lib/bookkeeping/period-attribution-service'
import { applyReviewAttributionFilterSpec } from '@/lib/reviews/attribution-saved-prompt-filter'
import { parseReviewAttributionFilterSpecJson } from '@/lib/reviews/attribution-saved-prompt-filter-schema'
import {
  buildRequestedPeriodPromptBlockMessage,
  hasRequestedPeriodDataGap,
} from '@/lib/reviews/period-scope-presentation'

type AttributionStaffRecord = Parameters<typeof getBookkeepingMaterialAttribution>[0]['staffRecord']

export type RunAttributionSavedPromptResult =
  | {
      ok: true
      status: 'ok' | 'notReady'
      notReadyReason?: string
      prompt: { id: string; name: string; explanationKo: string }
      summary: {
        totalRows: number
        matchedRows: number
        amountSumKrw: number
        needsReviewRows: number
      }
      rows: Array<{
        id: string
        fileLabel: string | null
        evidenceDate: string | null
        attributedPeriod: string | null
        periodRelation: string
        counterparty: string | null
        description: string | null
        amountKrw: number | null
        duplicateStatus: string
        aiRecommendation: string
        staffDecision: string | null
      }>
    }
  | { ok: false; status: number; error: string }

async function loadFileLabels(tenantId: string, fileIds: string[]) {
  if (fileIds.length === 0) return new Map<string, string>()

  const rows = await db
    .select({ id: uploadFile.id, originalFilename: uploadFile.originalFilename })
    .from(uploadFile)
    .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.id, fileIds)))

  return new Map(rows.map((row) => [row.id, row.originalFilename]))
}

export async function runAttributionSavedPrompt(params: {
  tenantId: string
  sessionId: string
  promptId: string
  staffRecord: AttributionStaffRecord
}): Promise<RunAttributionSavedPromptResult> {
  const [fullPrompt] = await db
    .select()
    .from(reviewAttributionSavedPrompt)
    .where(
      and(
        eq(reviewAttributionSavedPrompt.tenantId, params.tenantId),
        eq(reviewAttributionSavedPrompt.id, params.promptId),
        eq(reviewAttributionSavedPrompt.isActive, true),
      ),
    )
    .limit(1)

  if (!fullPrompt) {
    return { ok: false, status: 404, error: '저장 프롬프트를 찾을 수 없습니다.' }
  }

  const parsedSpec = parseReviewAttributionFilterSpecJson(fullPrompt.compiledFilterJson)
  if (!parsedSpec.success) {
    return { ok: false, status: 500, error: '저장된 필터 스펙이 손상되었습니다.' }
  }

  const attributionResult = await getBookkeepingMaterialAttribution({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    staffRecord: params.staffRecord,
  })

  if (!attributionResult.ok) {
    return { ok: false, status: attributionResult.status, error: attributionResult.error }
  }

  const promptSummary = {
    id: fullPrompt.id,
    name: fullPrompt.name,
    explanationKo: parsedSpec.data.explanationKo,
  }

  if (hasRequestedPeriodDataGap(attributionResult.summary)) {
    return {
      ok: true,
      status: 'notReady',
      notReadyReason: buildRequestedPeriodPromptBlockMessage(attributionResult.summary),
      prompt: promptSummary,
      summary: {
        totalRows: attributionResult.rows.length,
        matchedRows: 0,
        amountSumKrw: 0,
        needsReviewRows: 0,
      },
      rows: [],
    }
  }

  if (attributionResult.rows.length === 0) {
    return {
      ok: true,
      status: 'notReady',
      prompt: promptSummary,
      summary: {
        totalRows: 0,
        matchedRows: 0,
        amountSumKrw: 0,
        needsReviewRows: 0,
      },
      rows: [],
    }
  }

  const fileIds = [
    ...new Set(
      attributionResult.rows
        .map((row) => row.uploadFileId)
        .filter((fileId): fileId is string => Boolean(fileId)),
    ),
  ]
  const fileLabels = await loadFileLabels(params.tenantId, fileIds)

  const filterRows = attributionResult.rows.map((row) => ({
    id: row.id,
    fileLabel: row.uploadFileId ? (fileLabels.get(row.uploadFileId) ?? null) : null,
    sourceLabel: row.sourceLabel,
    evidenceDate: row.evidenceDate,
    attributedPeriod: row.attributedPeriod,
    periodRelation: row.periodRelation,
    amountKrw: row.amountKrw,
    counterparty: row.counterparty,
    description: row.description,
    duplicateStatus: row.duplicateStatus,
    recommendation: row.recommendation,
    staffDecision: row.staffDecision,
  }))

  const filtered = applyReviewAttributionFilterSpec(filterRows, parsedSpec.data)

  return {
    ok: true,
    status: 'ok',
    prompt: promptSummary,
    summary: filtered.summary,
    rows: filtered.rows.map((row) => ({
      id: row.id,
      fileLabel: row.fileLabel,
      evidenceDate: row.evidenceDate,
      attributedPeriod: row.attributedPeriod,
      periodRelation: row.periodRelation,
      counterparty: row.counterparty,
      description: row.description,
      amountKrw: row.amountKrw,
      duplicateStatus: row.duplicateStatus,
      aiRecommendation: row.recommendation,
      staffDecision: row.staffDecision,
    })),
  }
}

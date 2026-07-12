import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { vatTaxTreatmentAiResult } from '@/lib/db/schema'
import { fromISO, now, toDBString, type DateTime } from '@/lib/time'
import {
  VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
  VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
  type VatTaxTreatmentAiProviderTrace,
  type VatTaxTreatmentAiResultPayload,
  vatTaxTreatmentAiProviderTraceListSchema,
  vatTaxTreatmentAiResultPayloadSchema,
} from '@/lib/validations/vat-tax-treatment-ai-result'
import {
  vatTaxTreatmentAiWorkflowStateSchema,
  type VatTaxTreatmentAiWorkflowState,
} from '@/lib/validations/vat-tax-treatment-ai-workflow'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { shouldEvaluateVatTaxTreatmentRowWithAi } from './tax-treatment-ai-eligibility'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'

export const VAT_TAX_TREATMENT_AI_LEASE_MINUTES = 2
export const VAT_TAX_TREATMENT_AI_FALLBACK_BACKOFF_MINUTES = 15

export type VatTaxTreatmentAiDatabase = (typeof import('@/lib/db'))['db']

async function resolveDatabase(database?: VatTaxTreatmentAiDatabase) {
  return database ?? (await import('@/lib/db')).db
}

export type VatTaxTreatmentAiResultReadRow = Pick<
  typeof vatTaxTreatmentAiResult.$inferSelect,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'periodKey'
  | 'classificationRowId'
  | 'inputFingerprint'
  | 'ruleVersion'
  | 'promptVersion'
  | 'status'
  | 'payloadVersion'
  | 'resultPayloadJson'
  | 'resultFingerprint'
  | 'startedAt'
  | 'completedAt'
  | 'nextRetryAt'
  | 'leaseExpiresAt'
  | 'updatedAt'
>

function buildPayload(row: VatTaxTreatmentDisplayRow): VatTaxTreatmentAiResultPayload {
  return vatTaxTreatmentAiResultPayloadSchema.parse({
    version: VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
    recommendation: row.recommendation,
    provisionalJudgment: row.provisionalJudgment,
    judgmentWorkflowStatus: row.judgmentWorkflowStatus,
    evidenceTrace: row.evidenceTrace,
    searchedSources: row.searchedSources,
    source: row.source,
    confidence: row.confidence,
    basisLabel: row.basisLabel,
    ruleReference: row.ruleReference,
    missingFacts: row.missingFacts,
    hometaxAction: row.hometaxAction,
    aiTrace: row.aiTrace,
    aiRuntimeStatus: row.aiRuntimeStatus,
  })
}

function buildProviderTrace(row: VatTaxTreatmentDisplayRow) {
  if (!row.aiTrace) return []
  const providers = row.aiTrace.consensusProviders.length > 0
    ? row.aiTrace.consensusProviders
    : [row.aiTrace.provider]
  return vatTaxTreatmentAiProviderTraceListSchema.parse(providers.map((provider) => ({
    provider,
    modelName: row.aiTrace!.modelName,
    status: 'completed' as const,
  })))
}

function parsePayload(row: VatTaxTreatmentAiResultReadRow) {
  if (
    row.payloadVersion !== VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION
    || !row.resultPayloadJson
  ) return null
  try {
    const parsed = vatTaxTreatmentAiResultPayloadSchema.safeParse(JSON.parse(row.resultPayloadJson))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function isReusableAt(row: VatTaxTreatmentAiResultReadRow, currentTime: DateTime) {
  if (row.status === 'ready') return true
  if (row.status !== 'manual_fallback' || !row.nextRetryAt) return false
  const retryAt = fromISO(row.nextRetryAt)
  return retryAt.isValid && retryAt.toMillis() > currentTime.toMillis()
}

function payloadMatchesStatus(
  status: VatTaxTreatmentAiResultReadRow['status'],
  payload: VatTaxTreatmentAiResultPayload,
) {
  if (status === 'ready') {
    return payload.aiRuntimeStatus === 'completed'
      && (payload.source === 'ai_single' || payload.source === 'ai_consensus')
      && payload.provisionalJudgment !== null
      && payload.judgmentWorkflowStatus === 'user_confirmation_pending'
  }
  if (status === 'manual_fallback') {
    return payload.recommendation === 'needs_review'
      && payload.provisionalJudgment === null
      && payload.judgmentWorkflowStatus === 'ai_temporary_error'
      && (payload.aiRuntimeStatus === 'manual_fallback' || payload.aiRuntimeStatus === 'deferred')
  }
  return false
}

function parseStoredResult(
  row: VatTaxTreatmentDisplayRow,
  candidate: VatTaxTreatmentAiResultReadRow,
) {
  const payload = parsePayload(candidate)
  if (!payload || !payloadMatchesStatus(candidate.status, payload)) return null
  const merged = vatTaxTreatmentDisplayRowSchema.safeParse(
    withVatTaxTreatmentRecommendationFingerprint({ ...row, ...payload }),
  )
  if (!merged.success || merged.data.recommendationFingerprint !== candidate.resultFingerprint) {
    return null
  }
  return merged.data
}

function matchesCurrentInput(
  row: VatTaxTreatmentDisplayRow,
  candidate: VatTaxTreatmentAiResultReadRow,
) {
  return candidate.tenantId === row.tenantId
    && candidate.clientId === row.businessEntityId
    && candidate.periodKey === row.periodKey
    && candidate.inputFingerprint === row.recommendationFingerprint
    && candidate.ruleVersion === row.ruleVersion
    && candidate.promptVersion === VAT_TAX_TREATMENT_AI_PROMPT_VERSION
}

function hasValidLease(candidate: VatTaxTreatmentAiResultReadRow, currentTime: DateTime) {
  return !expired(candidate.leaseExpiresAt, currentTime)
}

function workflowStateForRow(params: {
  row: VatTaxTreatmentDisplayRow
  resultRows: VatTaxTreatmentAiResultReadRow[]
  currentTime: DateTime
}): VatTaxTreatmentAiWorkflowState {
  const canEvaluate = shouldEvaluateVatTaxTreatmentRowWithAi(params.row)
  const scoped = params.resultRows.filter((candidate) => (
    candidate.tenantId === params.row.tenantId
    && candidate.clientId === params.row.businessEntityId
    && candidate.periodKey === params.row.periodKey
  ))
  const current = scoped.find((candidate) => matchesCurrentInput(params.row, candidate))
  let status: VatTaxTreatmentAiWorkflowState['status'] = scoped.length > 0 ? 'stale' : 'idle'

  if (current?.status === 'queued' || current?.status === 'running') {
    status = hasValidLease(current, params.currentTime) ? 'checking' : 'stale'
  } else if (current?.status === 'ready') {
    status = parseStoredResult(params.row, current) ? 'ready' : 'stale'
  } else if (current?.status === 'manual_fallback') {
    status = parseStoredResult(params.row, current) ? 'manual_fallback' : 'stale'
  } else if (current?.status === 'stale') {
    status = 'stale'
  }

  return vatTaxTreatmentAiWorkflowStateSchema.parse({
    rowId: params.row.rowId,
    status: canEvaluate ? status : 'idle',
    canEvaluate,
    completedAt: current?.completedAt ?? null,
    nextRetryAt: current?.nextRetryAt ?? null,
  })
}

export function applyVatTaxTreatmentAiWorkflowStates(params: {
  rows: VatTaxTreatmentDisplayRow[]
  resultRows: VatTaxTreatmentAiResultReadRow[]
  nowAt?: DateTime
}) {
  const currentTime = params.nowAt ?? now()
  const resultsByClassification = new Map<string, VatTaxTreatmentAiResultReadRow[]>()
  for (const resultRow of params.resultRows) {
    const existing = resultsByClassification.get(resultRow.classificationRowId) ?? []
    resultsByClassification.set(resultRow.classificationRowId, [...existing, resultRow])
  }

  return params.rows.map((row) => vatTaxTreatmentDisplayRowSchema.parse({
    ...row,
    aiWorkflow: workflowStateForRow({
      row,
      resultRows: resultsByClassification.get(row.classificationRowId) ?? [],
      currentTime,
    }),
  }))
}

export function applyReusableVatTaxTreatmentAiResults(params: {
  rows: VatTaxTreatmentDisplayRow[]
  resultRows: VatTaxTreatmentAiResultReadRow[]
  nowAt?: DateTime
}) {
  const currentTime = params.nowAt ?? now()
  const resultsByClassification = new Map<string, VatTaxTreatmentAiResultReadRow[]>()
  for (const resultRow of params.resultRows) {
    const existing = resultsByClassification.get(resultRow.classificationRowId) ?? []
    resultsByClassification.set(resultRow.classificationRowId, [...existing, resultRow])
  }

  return params.rows.map((row) => {
    if (row.finalDecision || row.userActionStatus !== 'pending') return row
    const stored = (resultsByClassification.get(row.classificationRowId) ?? []).find((candidate) => (
      matchesCurrentInput(row, candidate)
      && isReusableAt(candidate, currentTime)
    ))
    if (!stored) return row

    return parseStoredResult(row, stored) ?? row
  })
}

export async function loadVatTaxTreatmentAiResultRows(params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  classificationRowIds: string[]
  database?: VatTaxTreatmentAiDatabase
}) {
  if (params.classificationRowIds.length === 0) return []
  const db = await resolveDatabase(params.database)
  return db
    .select({
      id: vatTaxTreatmentAiResult.id,
      tenantId: vatTaxTreatmentAiResult.tenantId,
      clientId: vatTaxTreatmentAiResult.clientId,
      periodKey: vatTaxTreatmentAiResult.periodKey,
      classificationRowId: vatTaxTreatmentAiResult.classificationRowId,
      inputFingerprint: vatTaxTreatmentAiResult.inputFingerprint,
      ruleVersion: vatTaxTreatmentAiResult.ruleVersion,
      promptVersion: vatTaxTreatmentAiResult.promptVersion,
      status: vatTaxTreatmentAiResult.status,
      payloadVersion: vatTaxTreatmentAiResult.payloadVersion,
      resultPayloadJson: vatTaxTreatmentAiResult.resultPayloadJson,
      resultFingerprint: vatTaxTreatmentAiResult.resultFingerprint,
      startedAt: vatTaxTreatmentAiResult.startedAt,
      completedAt: vatTaxTreatmentAiResult.completedAt,
      nextRetryAt: vatTaxTreatmentAiResult.nextRetryAt,
      leaseExpiresAt: vatTaxTreatmentAiResult.leaseExpiresAt,
      updatedAt: vatTaxTreatmentAiResult.updatedAt,
    })
    .from(vatTaxTreatmentAiResult)
    .where(and(
      eq(vatTaxTreatmentAiResult.tenantId, params.tenantId),
      eq(vatTaxTreatmentAiResult.clientId, params.businessEntityId),
      eq(vatTaxTreatmentAiResult.periodKey, params.periodKey),
      inArray(vatTaxTreatmentAiResult.classificationRowId, params.classificationRowIds),
    ))
    .orderBy(desc(vatTaxTreatmentAiResult.updatedAt))
}

export async function applyStoredVatTaxTreatmentAiResults(params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  rows: VatTaxTreatmentDisplayRow[]
  nowAt?: DateTime
  database?: VatTaxTreatmentAiDatabase
}) {
  const resultRows = await loadVatTaxTreatmentAiResultRows({
    tenantId: params.tenantId,
    businessEntityId: params.businessEntityId,
    periodKey: params.periodKey,
    classificationRowIds: params.rows.map((row) => row.classificationRowId),
    database: params.database,
  })
  const rowsWithWorkflow = applyVatTaxTreatmentAiWorkflowStates({
    rows: params.rows,
    resultRows,
    nowAt: params.nowAt,
  })
  return applyReusableVatTaxTreatmentAiResults({
    rows: rowsWithWorkflow,
    resultRows,
    nowAt: params.nowAt,
  })
}

export type VatTaxTreatmentAiReservation = {
  resultId: string | null
  executionToken: string | null
  status: 'excluded' | 'queued' | 'running' | 'ready' | 'manual_fallback'
  shouldRun: boolean
}

function expired(value: string | null, currentTime: DateTime) {
  if (!value) return true
  const parsed = fromISO(value)
  return !parsed.isValid || parsed.toMillis() <= currentTime.toMillis()
}

export async function reserveVatTaxTreatmentAiResult(params: {
  row: VatTaxTreatmentDisplayRow
  force?: boolean
  nowAt?: DateTime
  database?: VatTaxTreatmentAiDatabase
}): Promise<VatTaxTreatmentAiReservation> {
  const { row } = params
  if (
    row.finalDecision
    || row.userActionStatus !== 'pending'
    || row.source === 'ai_single'
    || row.source === 'ai_consensus'
  ) {
    return { resultId: null, executionToken: null, status: 'excluded', shouldRun: false }
  }

  const db = await resolveDatabase(params.database)
  const currentTime = params.nowAt ?? now()
  const timestamp = toDBString(currentTime)
  const leaseExpiresAt = toDBString(currentTime.plus({ minutes: VAT_TAX_TREATMENT_AI_LEASE_MINUTES }))
  const executionToken = randomUUID()

  const scope = and(
    eq(vatTaxTreatmentAiResult.tenantId, row.tenantId),
    eq(vatTaxTreatmentAiResult.clientId, row.businessEntityId),
    eq(vatTaxTreatmentAiResult.periodKey, row.periodKey),
    eq(vatTaxTreatmentAiResult.classificationRowId, row.classificationRowId),
  )
  await db
    .update(vatTaxTreatmentAiResult)
    .set({
      status: 'stale',
      executionToken: null,
      leaseExpiresAt: null,
      updatedAt: timestamp,
    })
    .where(and(
      scope,
      notInArray(vatTaxTreatmentAiResult.status, ['stale']),
      or(
        ne(vatTaxTreatmentAiResult.inputFingerprint, row.recommendationFingerprint),
        ne(vatTaxTreatmentAiResult.ruleVersion, row.ruleVersion),
        ne(vatTaxTreatmentAiResult.promptVersion, VAT_TAX_TREATMENT_AI_PROMPT_VERSION),
      ),
    ))

  const inserted = await db
    .insert(vatTaxTreatmentAiResult)
    .values({
      id: randomUUID(),
      tenantId: row.tenantId,
      clientId: row.businessEntityId,
      periodKey: row.periodKey,
      classificationRowId: row.classificationRowId,
      inputFingerprint: row.recommendationFingerprint,
      ruleVersion: row.ruleVersion,
      promptVersion: VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
      status: 'queued',
      executionToken,
      leaseExpiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing()
    .returning({ id: vatTaxTreatmentAiResult.id })

  const [current] = await db
    .select()
    .from(vatTaxTreatmentAiResult)
    .where(and(
      scope,
      eq(vatTaxTreatmentAiResult.inputFingerprint, row.recommendationFingerprint),
      eq(vatTaxTreatmentAiResult.ruleVersion, row.ruleVersion),
      eq(vatTaxTreatmentAiResult.promptVersion, VAT_TAX_TREATMENT_AI_PROMPT_VERSION),
    ))
    .limit(1)
  if (!current) {
    return { resultId: null, executionToken: null, status: 'excluded', shouldRun: false }
  }
  if (inserted.length > 0) {
    return {
      resultId: current.id,
      executionToken,
      status: 'queued',
      shouldRun: true,
    }
  }

  const canRequeue = current.status === 'stale'
    || ((current.status === 'queued' || current.status === 'running') && expired(current.leaseExpiresAt, currentTime))
    || (current.status === 'manual_fallback' && expired(current.nextRetryAt, currentTime))
    || (params.force === true && (current.status === 'ready' || current.status === 'manual_fallback'))
  if (!canRequeue) {
    return {
      resultId: current.id,
      executionToken: null,
      status: current.status === 'stale' ? 'queued' : current.status,
      shouldRun: false,
    }
  }

  const reclaimCondition = current.status === 'stale'
    ? eq(vatTaxTreatmentAiResult.status, 'stale')
    : params.force === true && (current.status === 'ready' || current.status === 'manual_fallback')
      ? eq(vatTaxTreatmentAiResult.status, current.status)
    : current.status === 'manual_fallback'
      ? and(
        eq(vatTaxTreatmentAiResult.status, 'manual_fallback'),
        lte(vatTaxTreatmentAiResult.nextRetryAt, timestamp),
      )
      : and(
        eq(vatTaxTreatmentAiResult.status, current.status),
        lte(vatTaxTreatmentAiResult.leaseExpiresAt, timestamp),
      )
  const reclaimed = await db
    .update(vatTaxTreatmentAiResult)
    .set({
      status: 'queued',
      executionToken,
      leaseExpiresAt,
      resultPayloadJson: null,
      resultFingerprint: null,
      providerTraceJson: '[]',
      startedAt: null,
      completedAt: null,
      nextRetryAt: null,
      updatedAt: timestamp,
    })
    .where(and(eq(vatTaxTreatmentAiResult.id, current.id), reclaimCondition))
    .returning({ id: vatTaxTreatmentAiResult.id })

  return {
    resultId: current.id,
    executionToken: reclaimed.length > 0 ? executionToken : null,
    status: 'queued',
    shouldRun: reclaimed.length > 0,
  }
}

export async function startVatTaxTreatmentAiResult(params: {
  resultId: string
  executionToken: string
  nowAt?: DateTime
  database?: VatTaxTreatmentAiDatabase
}) {
  const db = await resolveDatabase(params.database)
  const currentTime = params.nowAt ?? now()
  const started = await db
    .update(vatTaxTreatmentAiResult)
    .set({
      status: 'running',
      attemptCount: sql`${vatTaxTreatmentAiResult.attemptCount} + 1`,
      startedAt: toDBString(currentTime),
      leaseExpiresAt: toDBString(currentTime.plus({ minutes: VAT_TAX_TREATMENT_AI_LEASE_MINUTES })),
      updatedAt: toDBString(currentTime),
    })
    .where(and(
      eq(vatTaxTreatmentAiResult.id, params.resultId),
      eq(vatTaxTreatmentAiResult.status, 'queued'),
      eq(vatTaxTreatmentAiResult.executionToken, params.executionToken),
      gt(vatTaxTreatmentAiResult.leaseExpiresAt, toDBString(currentTime)),
    ))
    .returning({ id: vatTaxTreatmentAiResult.id })
  return started.length > 0
}

export async function completeVatTaxTreatmentAiResult(params: {
  resultId: string
  executionToken: string
  inputFingerprint: string
  result: VatTaxTreatmentDisplayRow
  providerTrace?: VatTaxTreatmentAiProviderTrace[]
  nowAt?: DateTime
  database?: VatTaxTreatmentAiDatabase
}) {
  const db = await resolveDatabase(params.database)
  const payload = buildPayload(params.result)
  const isReady = payload.aiRuntimeStatus === 'completed'
  const status = isReady ? 'ready' : 'manual_fallback'
  const currentTime = params.nowAt ?? now()
  const timestamp = toDBString(currentTime)
  const providerTrace = params.providerTrace ?? buildProviderTrace(params.result)
  const parsedTrace = vatTaxTreatmentAiProviderTraceListSchema.parse(providerTrace)

  const completed = await db
    .update(vatTaxTreatmentAiResult)
    .set({
      status,
      payloadVersion: VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
      resultPayloadJson: JSON.stringify(payload),
      resultFingerprint: params.result.recommendationFingerprint,
      providerTraceJson: JSON.stringify(parsedTrace),
      executionToken: null,
      leaseExpiresAt: null,
      completedAt: timestamp,
      nextRetryAt: isReady
        ? null
        : toDBString(currentTime.plus({ minutes: VAT_TAX_TREATMENT_AI_FALLBACK_BACKOFF_MINUTES })),
      updatedAt: timestamp,
    })
    .where(and(
      eq(vatTaxTreatmentAiResult.id, params.resultId),
      eq(vatTaxTreatmentAiResult.status, 'running'),
      eq(vatTaxTreatmentAiResult.executionToken, params.executionToken),
      eq(vatTaxTreatmentAiResult.tenantId, params.result.tenantId),
      eq(vatTaxTreatmentAiResult.clientId, params.result.businessEntityId),
      eq(vatTaxTreatmentAiResult.periodKey, params.result.periodKey),
      eq(vatTaxTreatmentAiResult.classificationRowId, params.result.classificationRowId),
      eq(vatTaxTreatmentAiResult.inputFingerprint, params.inputFingerprint),
      eq(vatTaxTreatmentAiResult.ruleVersion, params.result.ruleVersion),
      eq(vatTaxTreatmentAiResult.promptVersion, VAT_TAX_TREATMENT_AI_PROMPT_VERSION),
    ))
    .returning({ id: vatTaxTreatmentAiResult.id })
  return completed.length > 0
}

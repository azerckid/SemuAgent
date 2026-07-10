import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingMaterialAttribution,
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
  bookkeepingTransactionClassification,
  client,
  clientRequestEvent,
  requestItemValidation,
  requestTemplate,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import {
  defaultCriteriaForWorkType,
  formatGeneralDefaultCriteriaForPrompt,
} from '@/lib/review/default-criteria'
import { sourceBatchIdForLegacyUploadSession } from '@/lib/source-batch/scope'
import { now, toDBString } from '@/lib/time'
import {
  buildClearedManualVatFactFields,
  buildManualVatFactFields,
  buildParsedVatFactFields,
  isVatEvidenceSource,
  type ManualVatFactInput,
} from '@/lib/vat/facts'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import {
  formatBookkeepingCategoryNotes,
  isBookkeepingAccountCategoryKey,
} from './account-categories'
import {
  recommendAccountForCandidate,
  selectAiClassificationCandidates,
} from './account-classification-rules'
import { buildMaterialAttributionGate } from './attribution-gate'
import { isDisplayableClassificationRow } from './classification-rows'
import {
  isBookkeepingPeriodInRange,
  resolveBookkeepingPeriodRangeSnapshot,
  type BookkeepingPeriodRange,
} from './period-range'
import {
  BOOKKEEPING_CLASSIFICATION_MODEL,
  BOOKKEEPING_CLASSIFICATION_OPENAI_MODEL,
  classifyBookkeepingTransactionsWithClaude,
  classifyBookkeepingTransactionsWithGemini,
  classifyBookkeepingTransactionsWithOpenAI,
} from './classification-ai'
import {
  buildFileSummaryClassificationCandidates,
} from './file-summary-classification'
import { collectTransactionCandidatesForFile } from '@/lib/reviews/adaptive-structuring-apply'
import {
  findFreshRunningClassificationRun,
  reconcileBookkeepingClassificationSession,
  resolveBookkeepingClassificationView,
  START_REPLACE_RUN_STATUSES,
  supersedePreviousCompletedClassificationRuns,
} from './classification-run-lifecycle'
import type { BookkeepingClassificationAiOutput, BookkeepingRowStatus, TransactionCandidate } from './schemas'
export { formatClassificationRowsForExport } from './export'

const READY_SESSION_STATUSES = ['ready_for_accountant', 'completed'] as const
const PARTIAL_PROGRESSION_STATUS = 'needs_resubmission'
const EDITABLE_RUN_STATUS = 'completed'
const CLASSIFICATION_AI_BATCH_SIZE = 20
const MAX_SYNC_AI_CLASSIFICATION_CANDIDATES = 40

const BOOKKEEPING_GROUPS = new Set(defaultCriteriaForWorkType('bookkeeping').map((criterion) => criterion.itemGroup))
const VAT_GROUPS = new Set(defaultCriteriaForWorkType('vat').map((criterion) => criterion.itemGroup))

export type StaffRecord = {
  id: string
  role: 'TENANT_ADMIN' | 'STAFF'
}

const CLASSIFICATION_PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
}

export type ClassificationEligibility =
  | { eligible: true; workType: 'bookkeeping'; reason: string }
  | { eligible: false; workType: 'bookkeeping' | 'vat' | 'payroll' | 'unknown'; reason: string }

export async function getActiveStaffForUser(params: {
  userId: string
  tenantId: string
}): Promise<StaffRecord | null> {
  const [row] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, params.userId), eq(staff.tenantId, params.tenantId), eq(staff.active, true)))
    .limit(1)
  return row ?? null
}

export async function getSessionForStaff(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const [row] = await db
    .select({
      session: uploadSession,
      clientName: client.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, params.tenantId)))
    .where(and(eq(uploadSession.id, params.sessionId), eq(uploadSession.tenantId, params.tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!row) return null
  if (params.staffRecord.role === 'STAFF' && row.session.createdByStaffId !== params.staffRecord.id) return null
  return row
}

export async function canAccessClassificationSession(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  return Boolean(await getSessionForStaff(params))
}

function inferWorkTypeFromValidationGroups(groups: Array<string | null>) {
  const known = groups.filter((group): group is string => Boolean(group))
  const bookkeepingCount = known.filter((group) => BOOKKEEPING_GROUPS.has(group)).length
  const vatCount = known.filter((group) => VAT_GROUPS.has(group)).length

  if (bookkeepingCount > 0 && bookkeepingCount > vatCount) return 'bookkeeping' as const
  if (vatCount > 0 && vatCount > bookkeepingCount) return 'vat' as const
  return 'unknown' as const
}

function inferWorkTypeFromEmail(params: {
  subject: string | null
  body: string | null
}) {
  const source = `${params.subject ?? ''}\n${params.body ?? ''}`.toLowerCase()
  const hasVat = source.includes('부가세') || source.includes('vat')
  const hasBookkeeping = source.includes('기장') || source.includes('장부') || source.includes('거래내역')
  if (hasVat && !hasBookkeeping) return 'vat' as const
  if (hasBookkeeping && !hasVat) return 'bookkeeping' as const
  return 'unknown' as const
}

function resolveTargetRangeFromSession(session: typeof uploadSession.$inferSelect) {
  return resolveBookkeepingPeriodRangeSnapshot({
    accountingPeriod: session.accountingPeriod,
    bookkeepingPeriodType: session.bookkeepingPeriodType,
    bookkeepingPeriodStart: session.bookkeepingPeriodStart,
    bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
  })
}

async function resolveWorkType(params: {
  session: typeof uploadSession.$inferSelect
  tenantId: string
}) {
  if (params.session.requestKind === 'payroll') return 'payroll' as const

  const [eventRow] = await db
    .select({ workType: requestTemplate.workType })
    .from(clientRequestEvent)
    .leftJoin(requestTemplate, and(eq(clientRequestEvent.requestTemplateId, requestTemplate.id), eq(requestTemplate.tenantId, params.tenantId)))
    .where(
      and(
        eq(clientRequestEvent.tenantId, params.tenantId),
        or(
          eq(clientRequestEvent.id, params.session.requestEventId ?? ''),
          eq(clientRequestEvent.uploadSessionId, params.session.id),
        ),
      ),
    )
    .limit(1)

  if (eventRow?.workType) return eventRow.workType

  const validationRows = await db
    .select({ itemGroup: requestItemValidation.itemGroup })
    .from(requestItemValidation)
    .where(and(eq(requestItemValidation.tenantId, params.tenantId), eq(requestItemValidation.uploadSessionId, params.session.id)))

  const byValidation = inferWorkTypeFromValidationGroups(validationRows.map((row) => row.itemGroup))
  if (byValidation !== 'unknown') return byValidation

  return inferWorkTypeFromEmail({
    subject: params.session.requestEmailSubject,
    body: params.session.requestEmailBody,
  })
}

export async function getClassificationEligibility(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}): Promise<ClassificationEligibility> {
  const row = await getSessionForStaff(params)
  if (!row) return { eligible: false, workType: 'unknown', reason: '세션을 찾을 수 없거나 접근 권한이 없습니다.' }

  const { session } = row
  const workType = await resolveWorkType({ session, tenantId: params.tenantId })
  if (workType !== 'bookkeeping') {
    return {
      eligible: false,
      workType,
      reason: workType === 'vat'
        ? '부가세 자료 요청은 계정항목 정리 대상이 아닙니다.'
        : workType === 'payroll'
          ? '급여정산은 별도 엑셀 출력 흐름을 사용합니다.'
          : '기장 업무유형을 확정할 수 없습니다.',
    }
  }

  const fileRows = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, session.id), eq(uploadFile.tenantId, params.tenantId)))
    .limit(1)

  if (!fileRows[0]) {
    return { eligible: false, workType, reason: '읽을 수 있는 업로드 파일이 없습니다.' }
  }

  const targetRange = resolveTargetRangeFromSession(session)
  if (!targetRange) {
    return { eligible: false, workType, reason: '기장 대상 기간을 확정할 수 없습니다.' }
  }

  const [includedAttribution] = await db
    .select({ id: bookkeepingMaterialAttribution.id })
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, session.id),
        eq(bookkeepingMaterialAttribution.status, 'active'),
        or(
          eq(bookkeepingMaterialAttribution.staffDecision, 'include'),
          and(
            isNull(bookkeepingMaterialAttribution.staffDecision),
            eq(bookkeepingMaterialAttribution.recommendation, 'include'),
          ),
        ),
        sql`coalesce(${bookkeepingMaterialAttribution.attributedPeriod}, substr(${bookkeepingMaterialAttribution.evidenceDate}, 1, 7)) >= ${targetRange.start}`,
        sql`coalesce(${bookkeepingMaterialAttribution.attributedPeriod}, substr(${bookkeepingMaterialAttribution.evidenceDate}, 1, 7)) <= ${targetRange.end}`,
      ),
    )
    .limit(1)

  if (includedAttribution) {
    return { eligible: true, workType, reason: '귀속기간 검토에서 포함된 자료가 있어 계정항목 정리를 시작할 수 있습니다.' }
  }

  const [activeAttribution] = await db
    .select({ id: bookkeepingMaterialAttribution.id })
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, session.id),
        eq(bookkeepingMaterialAttribution.status, 'active'),
      ),
    )
    .limit(1)

  if (activeAttribution || session.status === PARTIAL_PROGRESSION_STATUS) {
    return {
      eligible: false,
      workType,
      reason: '귀속기간 검토에서 계정항목 정리에 포함할 자료를 먼저 확정해야 합니다.',
    }
  }

  if ((READY_SESSION_STATUSES as readonly string[]).includes(session.status)) {
    return { eligible: true, workType, reason: '계정항목 정리를 시작할 수 있습니다.' }
  }

  return {
    eligible: false,
    workType,
    reason: '먼저 자료 검토에서 귀속기간 검토를 실행하고, 포함할 자료를 확정해 주세요.',
  }
}

async function getMaterialAttributionGate(params: {
  files: Array<typeof uploadFile.$inferSelect>
  sessionId: string
  tenantId: string
  requestedPeriod: string
  targetRange: BookkeepingPeriodRange
}) {
  const attributionRows = await db
    .select({
      uploadFileId: bookkeepingMaterialAttribution.uploadFileId,
      sourceKind: bookkeepingMaterialAttribution.sourceKind,
      sourceLabel: bookkeepingMaterialAttribution.sourceLabel,
      evidenceDate: bookkeepingMaterialAttribution.evidenceDate,
      attributedPeriod: bookkeepingMaterialAttribution.attributedPeriod,
      amountKrw: bookkeepingMaterialAttribution.amountKrw,
      counterparty: bookkeepingMaterialAttribution.counterparty,
      description: bookkeepingMaterialAttribution.description,
      recommendation: bookkeepingMaterialAttribution.recommendation,
      staffDecision: bookkeepingMaterialAttribution.staffDecision,
    })
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.status, 'active'),
      ),
    )

  const gate = buildMaterialAttributionGate({
    files: params.files,
    attributionRows,
    requestedPeriod: params.requestedPeriod,
    targetRange: params.targetRange,
  })
  if (!gate) return null

  return {
    ...gate,
    fileSummaryCandidates: buildFileSummaryClassificationCandidates({
      attributionRows,
      targetRange: params.targetRange,
    }),
  }
}

function buildAppliedCategoryNotes() {
  return [
    '기장 기본 자료 기준',
    formatGeneralDefaultCriteriaForPrompt('bookkeeping'),
    '',
    '기장 계정항목 후보',
    formatBookkeepingCategoryNotes(),
  ].join('\n')
}

function chunkCandidates<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function classificationTransactionSignature(transaction: {
  sourceFileId: string
  transactionDate?: string
  merchantName?: string
  description?: string
  amountKrw?: number
}) {
  return [
    transaction.sourceFileId,
    transaction.transactionDate ?? '',
    transaction.merchantName ?? '',
    transaction.description ?? '',
    transaction.amountKrw ?? '',
  ].join('|')
}

function rowStatusForRecommendation(params: {
  recommendedAccount: string
  confidence: 'high' | 'medium' | 'low'
  needsStaffDecision: boolean
}): BookkeepingRowStatus {
  if (params.recommendedAccount === 'unclassified') return 'unclassified'
  if (params.needsStaffDecision || params.confidence === 'low') return 'needs_decision'
  return 'suggested'
}

function unclassifiedTransactionFromCandidate(candidate: TransactionCandidate, reason: string) {
  return {
    sourceFileId: candidate.sourceFileId,
    sourceType: candidate.sourceType,
    transactionDate: candidate.transactionDate,
    merchantName: candidate.merchantName,
    description: candidate.description,
    amountKrw: candidate.amountKrw,
    direction: candidate.direction,
    recommendedAccount: 'unclassified',
    confidence: 'low' as const,
    reason,
    evidence: {
      fieldsUsed: candidate.rawRow.slice(0, 8),
      needsStaffDecision: true,
    },
  }
}

function isCandidateInsideTargetRange(candidate: TransactionCandidate, targetRange: BookkeepingPeriodRange) {
  return isBookkeepingPeriodInRange(candidate.transactionDate?.slice(0, 7) ?? null, targetRange)
}

function ruleBasedTransactionFromCandidate(candidate: TransactionCandidate) {
  const recommendation = recommendAccountForCandidate(candidate)
  return {
    sourceFileId: candidate.sourceFileId,
    sourceType: candidate.sourceType,
    transactionDate: candidate.transactionDate,
    merchantName: candidate.merchantName,
    description: candidate.description,
    amountKrw: candidate.amountKrw,
    direction: candidate.direction,
    recommendedAccount: recommendation.account,
    confidence: recommendation.confidence,
    reason: recommendation.reason,
    evidence: {
      fieldsUsed: candidate.rawRow.slice(0, 8),
      needsStaffDecision: recommendation.needsStaffDecision,
    },
  }
}

async function classifyCandidateBatchWithProvider(params: {
  provider: AiProvider
  accountingPeriod: string
  candidates: TransactionCandidate[]
}) {
  if (params.provider === 'gemini') {
    const result = await classifyBookkeepingTransactionsWithGemini(params)
    return {
      transactions: result.data.transactions,
      modelName: result.modelName,
    }
  }
  if (params.provider === 'openai') {
    const result = await classifyBookkeepingTransactionsWithOpenAI(params)
    return {
      transactions: result.data.transactions,
      modelName: BOOKKEEPING_CLASSIFICATION_OPENAI_MODEL,
    }
  }

  const result = await classifyBookkeepingTransactionsWithClaude(params)
  return {
    transactions: result.data.transactions,
    modelName: BOOKKEEPING_CLASSIFICATION_MODEL,
  }
}

async function classifyCandidateBatch(params: {
  accountingPeriod: string
  candidates: TransactionCandidate[]
}): Promise<{
  transactions: BookkeepingClassificationAiOutput['transactions']
  provider: string
  modelName: string
}> {
  const providerErrors: string[] = []

  for (const provider of getActiveAiProviderOrder()) {
    try {
      const result = await classifyCandidateBatchWithProvider({ ...params, provider })
      return {
        transactions: result.transactions,
        provider,
        modelName: result.modelName,
      }
    } catch (err) {
      providerErrors.push(`${CLASSIFICATION_PROVIDER_LABELS[provider]}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const attemptedProviders = getActiveAiProviderOrder()
    .map((provider) => CLASSIFICATION_PROVIDER_LABELS[provider])
    .join(' → ')
  const reason = [
    `${attemptedProviders} 계정항목 추천 실패로 담당자 검토가 필요합니다.`,
    ...providerErrors,
  ].join(' ')

  return {
    transactions: params.candidates.map((candidate) => unclassifiedTransactionFromCandidate(candidate, reason.slice(0, 1000))),
    provider: 'ai-failed',
    modelName: 'ai-fallback-failed',
  }
}

async function collectTransactionCandidates(
  files: Array<typeof uploadFile.$inferSelect>,
  context: { tenantId: string; uploadSessionId: string },
) {
  const candidates: TransactionCandidate[] = []
  const warnings: string[] = []

  for (const file of files) {
    try {
      const blob = await get(file.storageKey, { access: 'private' })
      if (!blob || blob.statusCode !== 200) {
        warnings.push(`${file.originalFilename}: Blob 접근 실패`)
        continue
      }
      const buffer = await new Response(blob.stream).arrayBuffer()
      // 규칙 기반 extractor가 후보를 못 찾으면(빈 배열) 승인된 구조화 모델을 시도한다.
      // period-attribution-service.ts와 동일한 공유 함수를 쓴다 — "귀속기간 검토"에서는
      // 모델이 적용됐는데 "계정항목 정리"를 다시 누르면 사라지는 불일치를 막는다.
      candidates.push(...await collectTransactionCandidatesForFile({
        tenantId: context.tenantId,
        uploadSessionId: context.uploadSessionId,
        file,
        buffer,
      }))
    } catch (err) {
      warnings.push(`${file.originalFilename}: ${err instanceof Error ? err.message : '파일 처리 실패'}`)
    }
  }

  return { candidates, warnings }
}

async function refreshRunCounts(params: {
  runId: string
  tenantId: string
}) {
  const rows = await db
    .select({
      status: bookkeepingTransactionClassification.status,
      finalAccount: bookkeepingTransactionClassification.finalAccount,
    })
    .from(bookkeepingTransactionClassification)
    .where(
      and(
        eq(bookkeepingTransactionClassification.classificationRunId, params.runId),
        eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      ),
    )

  const confirmedRowCount = rows.filter((row) => row.status === 'confirmed').length
  const unclassifiedRowCount = rows.filter((row) => row.status === 'unclassified' || row.finalAccount === 'unclassified').length

  await db
    .update(bookkeepingClassificationRun)
    .set({
      confirmedRowCount,
      unclassifiedRowCount,
      updatedAt: toDBString(now()),
    })
    .where(and(eq(bookkeepingClassificationRun.id, params.runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))
}

async function getClassificationRunForAction(params: {
  runId: string
  tenantId: string
}) {
  const [run] = await db
    .select({ id: bookkeepingClassificationRun.id, status: bookkeepingClassificationRun.status })
    .from(bookkeepingClassificationRun)
    .where(and(eq(bookkeepingClassificationRun.id, params.runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))
    .limit(1)
  return run ?? null
}

async function isClassificationRunStillRunning(params: {
  runId: string
  tenantId: string
}) {
  const [run] = await db
    .select({ status: bookkeepingClassificationRun.status })
    .from(bookkeepingClassificationRun)
    .where(and(eq(bookkeepingClassificationRun.id, params.runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))
    .limit(1)

  return run?.status === 'running'
}

async function isClassificationRunStillCompleted(params: {
  runId: string
  tenantId: string
}) {
  const [run] = await db
    .select({ status: bookkeepingClassificationRun.status })
    .from(bookkeepingClassificationRun)
    .where(and(eq(bookkeepingClassificationRun.id, params.runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))
    .limit(1)

  return run?.status === 'completed'
}

function assertCompletedRun(run: { status: string } | null) {
  if (!run) return { ok: false as const, status: 404, error: '분류 실행 결과가 없습니다.' }
  if (run.status !== EDITABLE_RUN_STATUS) {
    return { ok: false as const, status: 409, error: '최신 계정항목 정리가 완료된 후 사용할 수 있습니다.' }
  }
  return { ok: true as const }
}

export async function cancelRunningBookkeepingClassification(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const runningRuns = await db
    .select({ id: bookkeepingClassificationRun.id })
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'running'),
      ),
    )

  if (runningRuns.length === 0) {
    return { ok: true as const, cancelledCount: 0 }
  }

  await db
    .update(bookkeepingClassificationRun)
    .set({
      status: 'failed',
      errorMessage: '담당자가 계정항목 정리를 중단했습니다. 다시 정리를 실행할 수 있습니다.',
      updatedAt: toDBString(now()),
    })
    .where(
      and(
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'running'),
      ),
    )

  await reconcileBookkeepingClassificationSession({
    tenantId: params.tenantId,
    sessionId: params.sessionId,
  })

  return { ok: true as const, cancelledCount: runningRuns.length }
}

export async function executeBookkeepingClassification(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const eligibility = await getClassificationEligibility(params)
  if (!eligibility.eligible) return { ok: false as const, status: 409, error: eligibility.reason }
  const targetRange = resolveTargetRangeFromSession(sessionRow.session)
  if (!targetRange) return { ok: false as const, status: 409, error: '기장 대상 기간을 확정할 수 없습니다.' }

  const files = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, params.sessionId), eq(uploadFile.tenantId, params.tenantId)))
  const attributionGate = await getMaterialAttributionGate({
    files,
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    requestedPeriod: sessionRow.session.accountingPeriod,
    targetRange,
  })
  const sourceFiles = attributionGate?.sourceFiles ?? files

  if (files.length > 0 && sourceFiles.length === 0) {
    return { ok: false as const, status: 409, error: '귀속기간 검토에서 포함된 업로드 파일이 없습니다.' }
  }

  await reconcileBookkeepingClassificationSession({
    tenantId: params.tenantId,
    sessionId: params.sessionId,
  })

  const freshRunning = await findFreshRunningClassificationRun({
    tenantId: params.tenantId,
    sessionId: params.sessionId,
  })
  if (freshRunning) {
    return { ok: false as const, status: 409, error: '계정항목 정리가 이미 실행 중입니다.' }
  }

  const ts = toDBString(now())
  const runId = randomUUID()
  const appliedCategoryNotes = buildAppliedCategoryNotes()
  const sourceBatchId = sourceBatchIdForLegacyUploadSession(params.sessionId)

  await db.transaction(async (tx) => {
    await tx
      .update(bookkeepingClassificationRun)
      .set({ status: 'superseded', updatedAt: ts })
      .where(
        and(
          eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
          eq(bookkeepingClassificationRun.tenantId, params.tenantId),
          inArray(bookkeepingClassificationRun.status, [...START_REPLACE_RUN_STATUSES]),
        ),
      )

    await tx.insert(bookkeepingClassificationRun).values({
      id: runId,
      tenantId: params.tenantId,
      uploadSessionId: params.sessionId,
      sourceBatchId,
      status: 'running',
      sourceFileCount: sourceFiles.length,
      extractedRowCount: 0,
      confirmedRowCount: 0,
      unclassifiedRowCount: 0,
      modelProvider: 'rules',
      modelName: 'rule-based',
      appliedCategoryNotes,
      errorMessage: null,
      createdByStaffId: params.staffRecord.id,
      createdAt: ts,
      updatedAt: ts,
    })
  })

  try {
    const collected = await collectTransactionCandidates(sourceFiles, {
      tenantId: params.tenantId,
      uploadSessionId: params.sessionId,
    })
    const transactionCandidates = (attributionGate
      ? attributionGate.filterCandidates(collected.candidates)
      : collected.candidates)
    const candidates = [
      ...transactionCandidates,
      ...(attributionGate?.fileSummaryCandidates ?? []),
    ]
      .filter((candidate) => isCandidateInsideTargetRange(candidate, targetRange))
      .filter(isDisplayableClassificationRow)
    const warnings = collected.warnings
    if (candidates.length === 0) {
      const warningText = warnings.length > 0 ? ` ${warnings.join(' / ')}` : ''
      throw new Error(`분류할 거래 행을 찾지 못했습니다.${warningText}`)
    }

    await db
      .update(bookkeepingClassificationRun)
      .set({
        extractedRowCount: candidates.length,
        updatedAt: toDBString(now()),
      })
      .where(and(eq(bookkeepingClassificationRun.id, runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))

    const ruleBasedTransactions = candidates.map(ruleBasedTransactionFromCandidate)
    const aiCandidates = selectAiClassificationCandidates(candidates)
    const aiTransactions: BookkeepingClassificationAiOutput['transactions'] = []
    let modelProvider = 'rules'
    let modelName = 'rule-based'
    const skippedAiCandidateCount = aiCandidates.length > MAX_SYNC_AI_CLASSIFICATION_CANDIDATES
      ? aiCandidates.length
      : 0

    if (skippedAiCandidateCount === 0) {
      for (const candidateBatch of chunkCandidates(aiCandidates, CLASSIFICATION_AI_BATCH_SIZE)) {
        if (!await isClassificationRunStillRunning({ runId, tenantId: params.tenantId })) {
          throw new Error('계정항목 정리가 중단되었습니다.')
        }
        const aiResult = await classifyCandidateBatch({
          accountingPeriod: sessionRow.session.accountingPeriod,
          candidates: candidateBatch,
        })
        aiTransactions.push(...aiResult.transactions)
        modelProvider = aiResult.provider
        modelName = aiResult.modelName
      }
    } else {
      warnings.push(
        `AI 검토 후보가 ${skippedAiCandidateCount.toLocaleString('ko-KR')}건으로 동기 처리 안전 한도(${MAX_SYNC_AI_CLASSIFICATION_CANDIDATES.toLocaleString('ko-KR')}건)를 초과해 규칙 기반 결과를 먼저 저장했습니다.`,
      )
    }
    const aiTransactionBySignature = new Map(aiTransactions.map((transaction) => [
      classificationTransactionSignature(transaction),
      transaction,
    ]))
    const candidateBySignature = new Map(candidates.map((candidate) => [
      classificationTransactionSignature(candidate),
      candidate,
    ]))
    const transactions = ruleBasedTransactions.map((transaction) => {
      const aiTransaction = aiTransactionBySignature.get(classificationTransactionSignature(transaction))
      if (aiTransaction) return aiTransaction
      if (skippedAiCandidateCount > 0 && transaction.recommendedAccount === 'unclassified') {
        return {
          ...transaction,
          reason: [
            transaction.reason,
            `AI 검토 후보가 많아 이번 실행에서는 규칙 기반 정리만 먼저 완료했습니다. 미분류 행은 담당자 검토 또는 필요한 범위로 나누어 다시 정리해 주세요.`,
          ].join(' '),
        }
      }
      return transaction
    })

    const rowTs = toDBString(now())
    const rows = transactions.filter(isDisplayableClassificationRow).map((transaction) => {
      const sourceCandidate = candidateBySignature.get(classificationTransactionSignature(transaction))
      const vatFactFields = buildParsedVatFactFields({
        sourceType: transaction.sourceType,
        direction: transaction.direction,
        sourceReference: sourceCandidate?.sourceRowRef ?? `${transaction.sourceFileId}:classification`,
        vatFact: sourceCandidate?.vatFact,
      })
      const recommendedAccount = isBookkeepingAccountCategoryKey(transaction.recommendedAccount)
        ? transaction.recommendedAccount
        : 'unclassified'
      const status = rowStatusForRecommendation({
        recommendedAccount,
        confidence: transaction.confidence,
        needsStaffDecision: transaction.evidence.needsStaffDecision,
      })

      return {
        id: randomUUID(),
        tenantId: params.tenantId,
        classificationRunId: runId,
        uploadSessionId: params.sessionId,
        sourceBatchId,
        uploadFileId: sourceFiles.some((file) => file.id === transaction.sourceFileId) ? transaction.sourceFileId : null,
        sourceType: transaction.sourceType,
        transactionDate: transaction.transactionDate ?? null,
        merchantName: transaction.merchantName ?? null,
        description: transaction.description ?? null,
        amountKrw: transaction.amountKrw ?? null,
        direction: transaction.direction,
        recommendedAccount,
        recommendationConfidence: transaction.confidence,
        recommendationReason: transaction.reason,
        evidenceJson: JSON.stringify(transaction.evidence),
        finalAccount: recommendedAccount === 'unclassified' ? null : recommendedAccount,
        staffMemo: null,
        status,
        ...vatFactFields,
        confirmedByStaffId: null,
        confirmedAt: null,
        createdAt: rowTs,
        updatedAt: rowTs,
      }
    })

    if (!await isClassificationRunStillRunning({ runId, tenantId: params.tenantId })) {
      throw new Error('계정항목 정리가 중단되었습니다.')
    }

    if (rows.length > 0) {
      await db.insert(bookkeepingTransactionClassification).values(rows)
    }

    if (!await isClassificationRunStillRunning({ runId, tenantId: params.tenantId })) {
      throw new Error('계정항목 정리가 중단되었습니다.')
    }

    const unclassifiedRowCount = rows.filter((row) => row.status === 'unclassified').length

    await db
      .update(bookkeepingClassificationRun)
      .set({
        status: 'completed',
        extractedRowCount: rows.length,
        unclassifiedRowCount,
        modelProvider,
        modelName,
        updatedAt: toDBString(now()),
      })
      .where(
        and(
          eq(bookkeepingClassificationRun.id, runId),
          eq(bookkeepingClassificationRun.tenantId, params.tenantId),
          eq(bookkeepingClassificationRun.status, 'running'),
        ),
      )

    if (!await isClassificationRunStillCompleted({ runId, tenantId: params.tenantId })) {
      throw new Error('계정항목 정리가 중단되었습니다.')
    }

    await supersedePreviousCompletedClassificationRuns({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      exceptRunId: runId,
    })

    return { ok: true as const, runId, rowCount: rows.length, unclassifiedRowCount }
  } catch (err) {
    const error = err instanceof Error ? err.message : '계정항목 추천 생성에 실패했습니다.'
    await db
      .update(bookkeepingClassificationRun)
      .set({
        status: 'failed',
        errorMessage: error.slice(0, 1000),
        updatedAt: toDBString(now()),
      })
      .where(and(eq(bookkeepingClassificationRun.id, runId), eq(bookkeepingClassificationRun.tenantId, params.tenantId)))

    await reconcileBookkeepingClassificationSession({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
    })

    return { ok: false as const, status: 500, error }
  }
}

export async function getLatestBookkeepingClassification(params: {
  sessionId: string
  tenantId: string
}) {
  return resolveBookkeepingClassificationView(params)
}

// JC-010 2b-2: 통장 행이 연결할 수 있는 증빙 소스 타입. summary.ts의
// isEvidenceSource와 동일한 목록이지만, mutation 레이어(lib/bookkeeping)가
// read-model 레이어(lib/bookkeeping-review)를 import하지 않도록 여기서
// 별도로 정의한다.
const LINKABLE_EVIDENCE_SOURCE_TYPES = new Set<string>(['card', 'receipt', 'tax_invoice'])

export async function updateBookkeepingClassificationRow(params: {
  rowId: string
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
  finalAccount?: string | null
  staffMemo?: string | null
  status?: BookkeepingRowStatus
  purposeRequestRowId?: string | null
  linkedEvidenceRowId?: string | null
  vatFact?: ManualVatFactInput | null
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) {
    return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }
  }

  const [row] = await db
    .select()
    .from(bookkeepingTransactionClassification)
    .where(
      and(
        eq(bookkeepingTransactionClassification.id, params.rowId),
        eq(bookkeepingTransactionClassification.uploadSessionId, params.sessionId),
        eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      ),
    )
    .limit(1)

  if (!row) return { ok: false as const, status: 404, error: '분류 행을 찾을 수 없습니다.' }

  const runCheck = assertCompletedRun(await getClassificationRunForAction({
    runId: row.classificationRunId,
    tenantId: params.tenantId,
  }))
  if (!runCheck.ok) return runCheck

  const nextStatus = params.status ?? row.status
  const nextFinalAccount = params.finalAccount === undefined ? row.finalAccount : params.finalAccount
  const nextMemo = params.staffMemo === undefined ? row.staffMemo : params.staffMemo
  const nextLinkedEvidenceRowId = params.linkedEvidenceRowId === undefined
    ? row.linkedEvidenceRowId
    : params.linkedEvidenceRowId

  let nextVatFactFields: ReturnType<typeof buildClearedManualVatFactFields> | undefined
  if (params.vatFact !== undefined) {
    if (!isVatEvidenceSource(row.sourceType)) {
      return { ok: false as const, status: 400, error: '세금계산서·현금영수증·카드 거래만 부가세 사실값을 저장할 수 있습니다.' }
    }

    const sourceReference = `staff:${params.staffRecord.id}:${row.id}`
    if (params.vatFact === null) {
      nextVatFactFields = buildClearedManualVatFactFields({
        direction: row.direction,
        sourceReference,
      })
    } else {
      const manualFields = buildManualVatFactFields(params.vatFact, sourceReference)
      if (!manualFields) {
        return { ok: false as const, status: 400, error: '공급가액·세액·합계액을 다시 확인해 주세요.' }
      }
      if (row.amountKrw === null || Math.abs(row.amountKrw) !== manualFields.vatGrossAmountKrw) {
        return { ok: false as const, status: 400, error: '부가세 합계액은 원장 거래금액과 일치해야 합니다.' }
      }
      nextVatFactFields = manualFields
    }
  }

  if (nextStatus === 'confirmed' && !nextFinalAccount) {
    return { ok: false as const, status: 400, error: '확정하려면 계정항목을 선택해야 합니다.' }
  }
  if (nextStatus === 'excluded' && !nextMemo?.trim()) {
    return { ok: false as const, status: 400, error: '제외하려면 메모가 필요합니다.' }
  }

  if (params.linkedEvidenceRowId !== undefined && params.linkedEvidenceRowId !== null) {
    // JC-010 2b-2 scope: only bank rows link to evidence. Card/receipt/
    // tax_invoice rows are themselves evidence (2b-1 decision) and never
    // initiate a link; without this check, the same PATCH endpoint would
    // let a card row set its own linkedEvidenceRowId, which the UI never
    // offers but the API would otherwise silently accept.
    if (row.sourceType !== 'bank') {
      return { ok: false as const, status: 400, error: '통장 거래만 증빙을 연결할 수 있습니다.' }
    }
    if (params.linkedEvidenceRowId === row.id) {
      return { ok: false as const, status: 400, error: '같은 거래를 증빙으로 연결할 수 없습니다.' }
    }

    const [evidenceRow] = await db
      .select({
        id: bookkeepingTransactionClassification.id,
        sourceType: bookkeepingTransactionClassification.sourceType,
        amountKrw: bookkeepingTransactionClassification.amountKrw,
      })
      .from(bookkeepingTransactionClassification)
      .where(
        and(
          eq(bookkeepingTransactionClassification.id, params.linkedEvidenceRowId),
          eq(bookkeepingTransactionClassification.uploadSessionId, params.sessionId),
          eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
        ),
      )
      .limit(1)

    if (!evidenceRow) {
      return { ok: false as const, status: 400, error: '연결할 증빙 거래를 찾을 수 없습니다.' }
    }
    if (!LINKABLE_EVIDENCE_SOURCE_TYPES.has(evidenceRow.sourceType)) {
      return { ok: false as const, status: 400, error: '세금계산서·현금영수증·카드 거래만 증빙으로 연결할 수 있습니다.' }
    }
    if (row.amountKrw === null || evidenceRow.amountKrw === null || Math.abs(row.amountKrw) !== Math.abs(evidenceRow.amountKrw)) {
      return { ok: false as const, status: 400, error: '금액이 다른 증빙은 바로 연결할 수 없습니다. 차액을 확인해 주세요.' }
    }
  }

  let purposeRowToConfirm: typeof bookkeepingTransactionPurposeRequestRow.$inferSelect | null = null
  if (params.purposeRequestRowId && nextStatus === 'confirmed') {
    const [purposeRow] = await db
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(
        and(
          eq(bookkeepingTransactionPurposeRequestRow.id, params.purposeRequestRowId),
          eq(bookkeepingTransactionPurposeRequestRow.tenantId, params.tenantId),
          eq(bookkeepingTransactionPurposeRequestRow.classificationRowId, row.id),
          inArray(bookkeepingTransactionPurposeRequestRow.status, ['answered', 'staff_confirmed']),
        ),
      )
      .limit(1)

    if (!purposeRow) {
      return {
        ok: false as const,
        status: 400,
        error: '확정할 고객 답변을 찾을 수 없습니다. 답변 도착 후 다시 시도해 주세요.',
      }
    }
    purposeRowToConfirm = purposeRow
  }

  const ts = toDBString(now())
  await db.transaction(async (tx) => {
    await tx
      .update(bookkeepingTransactionClassification)
      .set({
        finalAccount: nextFinalAccount,
        staffMemo: nextMemo,
        status: nextStatus,
        linkedEvidenceRowId: nextLinkedEvidenceRowId,
        ...nextVatFactFields,
        confirmedByStaffId: nextStatus === 'confirmed' ? params.staffRecord.id : row.confirmedByStaffId,
        confirmedAt: nextStatus === 'confirmed' ? ts : row.confirmedAt,
        updatedAt: ts,
      })
      .where(and(eq(bookkeepingTransactionClassification.id, params.rowId), eq(bookkeepingTransactionClassification.tenantId, params.tenantId)))

    if (purposeRowToConfirm) {
      await tx
        .update(bookkeepingTransactionPurposeRequestRow)
        .set({
          staffFinalAccount: nextFinalAccount,
          staffMemo: nextMemo,
          status: 'staff_confirmed',
          updatedAt: ts,
        })
        .where(
          and(
            eq(bookkeepingTransactionPurposeRequestRow.id, purposeRowToConfirm.id),
            eq(bookkeepingTransactionPurposeRequestRow.tenantId, params.tenantId),
          ),
        )

      const siblingRows = await tx
        .select({ status: bookkeepingTransactionPurposeRequestRow.status })
        .from(bookkeepingTransactionPurposeRequestRow)
        .where(
          and(
            eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, purposeRowToConfirm.purposeRequestId),
            eq(bookkeepingTransactionPurposeRequestRow.tenantId, params.tenantId),
          ),
        )

      const allRowsClosed = siblingRows.length > 0 && siblingRows.every((item) =>
        ['staff_confirmed', 'skipped', 'cancelled'].includes(item.status),
      )

      if (allRowsClosed) {
        await tx
          .update(bookkeepingTransactionPurposeRequest)
          .set({
            status: 'closed',
            closedAt: ts,
            updatedAt: ts,
          })
          .where(
            and(
              eq(bookkeepingTransactionPurposeRequest.id, purposeRowToConfirm.purposeRequestId),
              eq(bookkeepingTransactionPurposeRequest.tenantId, params.tenantId),
            ),
          )
      }
    }
  })

  await refreshRunCounts({ runId: row.classificationRunId, tenantId: params.tenantId })
  return {
    ok: true as const,
    // Snapshot of the row before this update, for shallow undo (Brief 41
    // §0.4): the caller can PATCH these values straight back to revert the
    // most recent apply/confirm action without a separate audit-log store.
    previous: {
      finalAccount: row.finalAccount,
      staffMemo: row.staffMemo,
      status: row.status,
      linkedEvidenceRowId: row.linkedEvidenceRowId,
    },
  }
}

export async function bulkConfirmBookkeepingRows(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
  rowIds?: string[]
  mode: 'explicit' | 'high_confidence'
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) {
    return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }
  }

  const { displayRun, rows } = await getLatestBookkeepingClassification({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
  })
  if (!displayRun) return { ok: false as const, status: 404, error: '분류 실행 결과가 없습니다.' }
  const runCheck = assertCompletedRun(displayRun)
  if (!runCheck.ok) return runCheck

  const explicitIds = new Set(params.rowIds ?? [])
  const eligibleRows = rows.filter((row) => {
    if (params.mode === 'explicit' && !explicitIds.has(row.id)) return false
    if (params.mode === 'high_confidence' && row.recommendationConfidence !== 'high') return false
    return Boolean(row.finalAccount ?? row.recommendedAccount) &&
      row.recommendedAccount !== 'unclassified' &&
      row.status !== 'excluded'
  })

  if (eligibleRows.length === 0) {
    return { ok: false as const, status: 400, error: '확정할 수 있는 행이 없습니다.' }
  }

  const ts = toDBString(now())
  await db
    .update(bookkeepingTransactionClassification)
    .set({
      finalAccount: sql`coalesce(${bookkeepingTransactionClassification.finalAccount}, ${bookkeepingTransactionClassification.recommendedAccount})`,
      status: 'confirmed',
      confirmedByStaffId: params.staffRecord.id,
      confirmedAt: ts,
      updatedAt: ts,
    })
    .where(
      and(
        eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
        inArray(bookkeepingTransactionClassification.id, eligibleRows.map((row) => row.id)),
      ),
    )

  await refreshRunCounts({ runId: displayRun.id, tenantId: params.tenantId })
  return { ok: true as const, count: eligibleRows.length }
}

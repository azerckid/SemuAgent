import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import { extractTransactionCandidates } from '@/lib/bookkeeping/transaction-extraction'
import { transactionCandidateSchema, type TransactionCandidate } from '@/lib/bookkeeping/schemas'
import { db } from '@/lib/db'
import { adaptiveStructureModel, adaptiveStructureModelRun } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  matchReviewAdaptiveWorkbookSignature,
  runReviewAdaptiveCommonEngine,
  type ReviewAdaptivePreviewRow,
} from './adaptive-structuring-common-engine'
import { reviewAdaptiveModelContractSchema, type ReviewAdaptiveModelContract } from './adaptive-structuring-model-contract'
import { REVIEW_ADAPTIVE_TARGET_WORKFLOW } from './adaptive-structuring-registry'

type ApprovedModelRow = typeof adaptiveStructureModel.$inferSelect

type ModelMatchResult =
  | { kind: 'none' }
  | { kind: 'ambiguous'; matchedModelIds: string[] }
  | { kind: 'matched'; model: ApprovedModelRow; contract: ReviewAdaptiveModelContract }

// 같은 워크북에 승인된 모델이 2개 이상 매칭되면 어떤 걸 골라야 할지 추측하지 않는다.
// fail closed: 적용하지 않고 기존 규칙 기반 extractor 결과(빈 배열)를 그대로 둔다.
// targetWorkflow 조건은 Slice 4에서 정한 cross-workflow 격리 원칙 그대로다 — payroll
// 모델이 우연히 같은 시그니처를 가져도 review apply path가 그걸 적용해서는 안 된다.
export async function findApprovedReviewAdaptiveModelMatch(params: {
  tenantId: string
  fileTexts: ReviewAdaptiveSourceText[]
}): Promise<ModelMatchResult> {
  const approvedModels = await db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.targetWorkflow, REVIEW_ADAPTIVE_TARGET_WORKFLOW),
      eq(adaptiveStructureModel.status, 'approved'),
    ))

  const matches: Array<{ model: ApprovedModelRow; contract: ReviewAdaptiveModelContract }> = []
  for (const model of approvedModels) {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(model.modelJson)
    } catch {
      continue
    }
    const parsedContract = reviewAdaptiveModelContractSchema.safeParse(parsedJson)
    if (!parsedContract.success) continue

    const signatureMatch = matchReviewAdaptiveWorkbookSignature(parsedContract.data, params.fileTexts)
    if (signatureMatch.matched) matches.push({ model, contract: parsedContract.data })
  }

  if (matches.length === 0) return { kind: 'none' }
  if (matches.length > 1) return { kind: 'ambiguous', matchedModelIds: matches.map((m) => m.model.id) }
  return { kind: 'matched', model: matches[0]!.model, contract: matches[0]!.contract }
}

function isPositiveAmount(value: string | number | null | undefined): value is number {
  return typeof value === 'number' && value !== 0
}

// 사용자 결정: direction을 추측하지 않는다. 입금/출금 컬럼이 구조적으로 분리된 워크북만
// income/expense로 판단하고, 단일 금액 컬럼만 있으면 unknown으로 남겨 계정항목 정리
// 단계에서 사람/규칙이 판단하게 한다.
//
// 은행/정산 엑셀은 빈 칸 대신 0을 채우는 경우가 흔하다(입금액=0, 출금액=150,000 같은
// 행). 0을 "값 있음"으로 잘못 보면 입금액 컬럼이 먼저 매칭돼 방향과 금액이 둘 다
// 틀어진다. 그래서 0은 "값 없음"에 가깝게 취급하고, 한쪽만 양수면 그 컬럼을 쓰고,
// 둘 다 양수(모호함)거나 둘 다 0/빈 값이면 이 row는 적용하지 않는다(null).
function pickAmountAndDirection(
  values: Record<string, string | number | null>,
): { amountKrw: number; direction: TransactionCandidate['direction'] } | null {
  const hasIncomeExpenseSplit = 'incomeAmountKrw' in values || 'expenseAmountKrw' in values
  if (hasIncomeExpenseSplit) {
    const incomePositive = isPositiveAmount(values.incomeAmountKrw)
    const expensePositive = isPositiveAmount(values.expenseAmountKrw)

    if (incomePositive && !expensePositive) {
      return { amountKrw: values.incomeAmountKrw as number, direction: 'income' }
    }
    if (expensePositive && !incomePositive) {
      return { amountKrw: values.expenseAmountKrw as number, direction: 'expense' }
    }
    // 둘 다 양수(모호함) 또는 둘 다 0/빈 값 — 어느 쪽도 안전하게 단정할 수 없다.
    return null
  }

  if (typeof values.amountKrw === 'number') {
    return { amountKrw: values.amountKrw, direction: 'unknown' }
  }
  return null
}

function convertPreviewRowToTransactionCandidate(
  row: ReviewAdaptivePreviewRow,
  file: { id: string; originalFilename: string },
  model: { id: string; modelVersion: number },
): TransactionCandidate | null {
  const amount = pickAmountAndDirection(row.values)
  if (!amount) return null

  const { transactionDate, evidenceDate, counterparty, description } = row.values
  const candidate = {
    sourceFileId: file.id,
    sourceFilename: file.originalFilename,
    sourceType: 'other' as const,
    transactionDate: typeof transactionDate === 'string'
      ? transactionDate
      : (typeof evidenceDate === 'string' ? evidenceDate : undefined),
    merchantName: typeof counterparty === 'string' ? counterparty : undefined,
    description: [
      typeof description === 'string' ? description : null,
      `구조화 모델 적용 (model: ${model.id} v${model.modelVersion})`,
    ].filter((part): part is string => Boolean(part)).join(' · '),
    amountKrw: amount.amountKrw,
    direction: amount.direction,
    // 원본 셀이 아니라 엔진이 이미 마스킹·정규화한 구조화 값만 보존한다.
    rawRow: Object.entries(row.values)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .slice(0, 30),
  }

  const parsed = transactionCandidateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

async function recordAdaptiveModelRun(params: {
  tenantId: string
  modelId: string | null
  uploadSessionId: string
  status: 'needs_review' | 'extraction_blocked' | 'failed'
  engineVersion?: string
  matchedRowCount?: number
  blockedRowCount?: number
  warnings?: string[]
  blockers?: string[]
  errorMessage?: string
}): Promise<void> {
  await db.insert(adaptiveStructureModelRun).values({
    id: randomUUID(),
    tenantId: params.tenantId,
    modelId: params.modelId,
    uploadSessionId: params.uploadSessionId,
    status: params.status,
    engineVersion: params.engineVersion ?? null,
    matchedRowCount: params.matchedRowCount ?? 0,
    blockedRowCount: params.blockedRowCount ?? 0,
    warningsJson: JSON.stringify(params.warnings ?? []),
    blockersJson: JSON.stringify(params.blockers ?? []),
    errorMessage: params.errorMessage ?? null,
    createdAt: toDBString(now()),
  })
}

// 실행 우선순위: 규칙 기반 extractor(extractTransactionCandidates)가 이 파일에서 후보를
// 찾았으면 이 함수는 호출되지 않는다(중복 생성 방지는 호출부의 책임). 여기서도
// 실패하면(매칭 없음/모호함/필수 필드 누락) null을 반환해 "후보 없음"으로 그대로
// 남긴다 — 적용 실패가 곧 세션 실패가 되지는 않는다. 결과 row는 바로 확정되지 않고
// 기존 귀속기간 검토/계정항목 정리 흐름이 그대로 검토·분류한다.
export async function applyApprovedReviewAdaptiveModelForFile(params: {
  tenantId: string
  uploadSessionId: string
  file: { id: string; originalFilename: string }
  fileTexts: ReviewAdaptiveSourceText[]
}): Promise<TransactionCandidate[] | null> {
  const matchResult = await findApprovedReviewAdaptiveModelMatch({
    tenantId: params.tenantId,
    fileTexts: params.fileTexts,
  })

  if (matchResult.kind === 'none') return null

  if (matchResult.kind === 'ambiguous') {
    await recordAdaptiveModelRun({
      tenantId: params.tenantId,
      modelId: null,
      uploadSessionId: params.uploadSessionId,
      status: 'failed',
      errorMessage: 'ambiguous_model_match',
    })
    return null
  }

  const { model, contract } = matchResult
  const enginePreview = runReviewAdaptiveCommonEngine(contract, params.fileTexts)

  if (!enginePreview.matched) {
    await recordAdaptiveModelRun({
      tenantId: params.tenantId,
      modelId: model.id,
      uploadSessionId: params.uploadSessionId,
      status: 'extraction_blocked',
      engineVersion: model.engineVersion,
      blockedRowCount: enginePreview.blockedRowCount,
      warnings: enginePreview.warnings,
      blockers: enginePreview.blockers,
    })
    return null
  }

  const convertedCandidates = enginePreview.standardRows
    .map((row) => convertPreviewRowToTransactionCandidate(row, params.file, model))
    .filter((candidate): candidate is TransactionCandidate => candidate !== null)

  const skippedRowCount = enginePreview.standardRows.length - convertedCandidates.length

  if (convertedCandidates.length === 0) {
    await recordAdaptiveModelRun({
      tenantId: params.tenantId,
      modelId: model.id,
      uploadSessionId: params.uploadSessionId,
      status: 'extraction_blocked',
      engineVersion: model.engineVersion,
      blockedRowCount: enginePreview.blockedRowCount + skippedRowCount,
      warnings: enginePreview.warnings,
      blockers: enginePreview.blockers,
    })
    return null
  }

  await recordAdaptiveModelRun({
    tenantId: params.tenantId,
    modelId: model.id,
    uploadSessionId: params.uploadSessionId,
    status: 'needs_review',
    engineVersion: model.engineVersion,
    matchedRowCount: convertedCandidates.length,
    blockedRowCount: enginePreview.blockedRowCount + skippedRowCount,
    warnings: enginePreview.warnings,
    blockers: enginePreview.blockers,
  })

  return convertedCandidates
}

type UploadFileLike = { id: string; originalFilename: string; fileType: string }

// period-attribution-service.ts와 classification-service.ts가 공유하는 단일 진입점.
// 같은 로직을 두 곳에 복붙하면 한쪽만 고치고 다른 쪽을 잊는 drift가 난다(Slice 4의
// cross-workflow 격리 누락과 같은 종류의 사고).
//
// 규칙 기반 extractor가 이 파일에서 후보를 찾으면 그 결과를 그대로 쓰고 끝낸다 —
// 승인된 모델이 있어도 시도하지 않는다(같은 파일에 중복 후보가 생기지 않게 하는 장치).
// 규칙 기반 extractor가 0건일 때만 승인된 모델을 시도하고, 모델도 실패하면 빈 배열을
// 반환한다(현재 동작과 동일, 회귀 없음).
export async function collectTransactionCandidatesForFile(params: {
  tenantId: string
  uploadSessionId: string
  file: UploadFileLike
  buffer: ArrayBuffer
}): Promise<TransactionCandidate[]> {
  const ruleBasedCandidates = extractTransactionCandidates({ file: params.file, buffer: params.buffer })
  if (ruleBasedCandidates.length > 0) return ruleBasedCandidates

  const chunks = await extractDocumentTextChunks({
    fileBuffer: params.buffer,
    fileType: params.file.fileType as 'pdf' | 'excel' | 'image' | 'other',
    originalFilename: params.file.originalFilename,
    profile: 'review',
  })
  const fileTexts: ReviewAdaptiveSourceText[] = chunks
    .filter((chunk) => chunk.text)
    .map((chunk) => ({
      filename: params.file.originalFilename,
      text: chunk.text,
      summary: chunk.summary,
      chunkIndex: chunk.chunkIndex,
      chunkTotal: chunk.chunkTotal,
      sheetName: chunk.sheetName,
      rowStart: chunk.rowStart,
      rowEnd: chunk.rowEnd,
    }))

  if (fileTexts.length === 0) return []

  const applied = await applyApprovedReviewAdaptiveModelForFile({
    tenantId: params.tenantId,
    uploadSessionId: params.uploadSessionId,
    file: params.file,
    fileTexts,
  })

  return applied ?? []
}

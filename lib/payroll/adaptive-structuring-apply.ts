import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adaptiveStructureModel, adaptiveStructureModelRun } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import type { PayrollExtractedRow, PayrollExtractionResponse } from '@/lib/validations/payroll'
import { payrollExtractedRowSchema } from '@/lib/validations/payroll'
import {
  matchPayrollAdaptiveWorkbookSignature,
  runPayrollAdaptiveCommonEngine,
  type PayrollAdaptivePreviewRow,
} from './adaptive-structuring-common-engine'
import { payrollAdaptiveModelContractSchema, type PayrollAdaptiveModelContract } from './adaptive-structuring-model-contract'
import { PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS } from './adaptive-structuring-proposal-schema'

type ApprovedModelRow = typeof adaptiveStructureModel.$inferSelect

type ModelMatchResult =
  | { kind: 'none' }
  | { kind: 'ambiguous'; matchedModelIds: string[] }
  | { kind: 'matched'; model: ApprovedModelRow; contract: PayrollAdaptiveModelContract }

// 같은 워크북에 승인된 모델이 2개 이상 매칭되면 어떤 걸 골라야 할지 추측하지 않는다.
// fail closed: 적용하지 않고 기존 AI fallback으로 넘긴다.
export async function findApprovedPayrollAdaptiveModelMatch(params: {
  tenantId: string
  fileTexts: PayrollSourceText[]
}): Promise<ModelMatchResult> {
  const approvedModels = await db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.targetWorkflow, 'payroll'),
      eq(adaptiveStructureModel.status, 'approved'),
    ))

  const matches: Array<{ model: ApprovedModelRow; contract: PayrollAdaptiveModelContract }> = []
  for (const model of approvedModels) {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(model.modelJson)
    } catch {
      continue
    }
    const parsedContract = payrollAdaptiveModelContractSchema.safeParse(parsedJson)
    if (!parsedContract.success) continue

    const signatureMatch = matchPayrollAdaptiveWorkbookSignature(parsedContract.data, params.fileTexts)
    if (signatureMatch.matched) matches.push({ model, contract: parsedContract.data })
  }

  if (matches.length === 0) return { kind: 'none' }
  if (matches.length > 1) return { kind: 'ambiguous', matchedModelIds: matches.map((m) => m.model.id) }
  return { kind: 'matched', model: matches[0]!.model, contract: matches[0]!.contract }
}

const TARGET_FIELD_TO_ROW_FIELD: Partial<Record<string, keyof PayrollExtractedRow>> = {
  employeeCode: 'employeeCode',
  employeeName: 'employeeName',
  department: 'department',
  jobTitle: 'jobTitle',
  baseSalary: 'baseSalary',
  bonus: 'bonus',
  otherAllowance: 'otherAllowance',
  retroactivePay: 'retroactivePay',
  incomeTaxBasis: 'incomeTax',
  localIncomeTaxBasis: 'localIncomeTax',
  nationalPensionBasis: 'nationalPension',
  healthInsuranceBasis: 'healthInsurance',
  employmentInsuranceBasis: 'employmentInsurance',
  otherDeduction: 'otherDeduction',
}

// 직접 대응되는 row 컬럼이 없는 필드(예: residentOrInternalKey, fixedAllowance,
// overtimeHours, policyCandidate)는 row 컬럼으로 만들지 않고 memo로만 보존한다.
// 식별자 원본 값은 식별 여부 판단에만 쓰고 절대 memo에도 넣지 않는다.
const NEVER_PERSIST_TARGET_FIELDS = new Set(['residentOrInternalKey'])

function convertPreviewRowToExtractedRow(
  row: PayrollAdaptivePreviewRow,
  model: { id: string; modelVersion: number },
): PayrollExtractedRow | null {
  // 먼저 실제 row 컬럼으로 매핑한 뒤, "그 매핑 결과"를 기준으로 필수조건을 검사한다.
  // residentOrInternalKey/fixedAllowance/monthlyFixedPay처럼 row 컬럼이 없는 필드는
  // row.values에는 있어도 mapped에는 절대 안 남으므로, mapped 기준으로 봐야
  // "직원명/코드도 없고 금액도 없는 row"가 식별자·금액 조건을 통과하는 일이 없다.
  const mapped: Record<string, unknown> = {}
  const memoNotes: string[] = []
  for (const [targetField, value] of Object.entries(row.values)) {
    if (value == null || value === '') continue
    if (NEVER_PERSIST_TARGET_FIELDS.has(targetField)) continue

    const rowField = TARGET_FIELD_TO_ROW_FIELD[targetField]
    if (rowField) {
      mapped[rowField] = value
      continue
    }
    // 직접 매핑되지 않는 필드(시간/일수, fixedAllowance, policyCandidate 등)는
    // spec의 "preserve warnings about metadata/policy/result-only sections" 요구에 따라
    // 버리지 않고 memo로 남긴다.
    memoNotes.push(`${targetField}: ${value}`)
  }

  const hasIdentity = typeof mapped.employeeName === 'string' || typeof mapped.employeeCode === 'string'
  const hasPeriod = PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS.some((field) => row.values[field])
  const hasPayableOrDeductibleAmount = Object.values(mapped).some((value) => typeof value === 'number')
  if (!hasIdentity || !hasPeriod || !hasPayableOrDeductibleAmount) return null

  const candidate = {
    ...mapped,
    confidence: 'unknown' as const,
    // 항상 needs_review — 승인된 모델이라도 첫 적용 결과를 자동 pass로 승격하지 않는다.
    aiVerdict: 'fail' as const,
    aiVerdictReason: `구조화 모델 적용 결과는 항상 검토 대상입니다 (model: ${model.id} v${model.modelVersion})`,
    memo: [
      `구조화 모델 적용 (model: ${model.id} v${model.modelVersion})`,
      ...memoNotes,
    ].join('\n'),
    sourceReference: { sheetName: row.sheetName, sourceRowRef: row.sourceRowRef },
  }

  const parsed = payrollExtractedRowSchema.safeParse(candidate)
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

// 실행 우선순위(spec #2): 코드 extractor가 이미 성공했으면 이 함수는 호출되지 않는다.
// 여기서도 실패하면(매칭 없음/모호함/필수 필드 누락) null을 반환해 기존 AI fallback으로
// 그대로 흘러가게 한다 — 적용 실패가 곧 추출 실패가 되지는 않는다.
export async function applyApprovedPayrollAdaptiveModel(params: {
  tenantId: string
  uploadSessionId: string
  payrollPeriod: string
  fileTexts: PayrollSourceText[]
}): Promise<{ success: true; data: PayrollExtractionResponse } | null> {
  const matchResult = await findApprovedPayrollAdaptiveModelMatch({
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
  const enginePreview = runPayrollAdaptiveCommonEngine(contract, params.fileTexts)

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

  const convertedRows = enginePreview.standardRows
    .map((row) => convertPreviewRowToExtractedRow(row, model))
    .filter((row): row is PayrollExtractedRow => row !== null)

  const skippedRowCount = enginePreview.standardRows.length - convertedRows.length

  if (convertedRows.length === 0) {
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
    matchedRowCount: convertedRows.length,
    blockedRowCount: enginePreview.blockedRowCount + skippedRowCount,
    warnings: enginePreview.warnings,
    blockers: enginePreview.blockers,
  })

  return {
    success: true,
    data: {
      payrollPeriod: params.payrollPeriod,
      rows: convertedRows,
      warnings: enginePreview.warnings,
    },
  }
}

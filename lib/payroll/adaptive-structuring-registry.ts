import { randomUUID } from 'crypto'
import { get } from '@vercel/blob'
import { and, eq, inArray } from 'drizzle-orm'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import {
  generatePayrollAdaptiveStructuringProposal,
  PAYROLL_ADAPTIVE_STRUCTURING_PROMPT_VERSION,
} from '@/lib/ai/payroll-adaptive-structuring-propose'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import { db } from '@/lib/db'
import { adaptiveStructureModel } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { runPayrollAdaptiveCommonEngine } from './adaptive-structuring-common-engine'
import { loadPayrollAdaptiveStructuringEligibilityContext } from './adaptive-structuring-eligibility-context'
import { derivePayrollAdaptiveModelContractFromProposal } from './adaptive-structuring-proposal-to-contract'

export const PAYROLL_ADAPTIVE_ENGINE_VERSION = 'payroll-common-engine-v1'

export type CreateProposedPayrollAdaptiveModelResult =
  | { success: true; modelId: string }
  | { success: false; status: number; error: string }

async function loadReadablePayrollSourceTexts(
  sourceFiles: Array<{ originalFilename: string; storageKey: string; fileType: string }>,
): Promise<PayrollSourceText[]> {
  const fileTextGroups = await Promise.all(
    sourceFiles.map(async (file): Promise<PayrollSourceText[]> => {
      try {
        const blob = await get(file.storageKey, { access: 'private' })
        if (!blob || blob.statusCode !== 200) {
          return [{ filename: file.originalFilename, text: null, summary: 'Blob 접근 실패' }]
        }
        const buffer = await new Response(blob.stream).arrayBuffer()
        const chunks = await extractDocumentTextChunks({
          fileBuffer: buffer,
          fileType: file.fileType as 'pdf' | 'excel' | 'image' | 'other',
          originalFilename: file.originalFilename,
          profile: 'payroll',
        })
        return chunks.map((chunk) => ({
          filename: file.originalFilename,
          text: chunk.text,
          summary: chunk.summary,
          chunkIndex: chunk.chunkIndex,
          chunkTotal: chunk.chunkTotal,
          sheetName: chunk.sheetName,
          rowStart: chunk.rowStart,
          rowEnd: chunk.rowEnd,
        }))
      } catch {
        return [{ filename: file.originalFilename, text: null, summary: '파일 처리 중 오류 발생' }]
      }
    }),
  )

  return fileTextGroups.flat().filter((fileText) => fileText.text)
}

// 클라이언트가 만든 contract/eligibility를 신뢰하지 않는다. sessionId만 받아 서버가
// eligibility -> AI 제안 -> 결정론적 엔진 검증을 처음부터 다시 실행하고, 엔진이 실제로
// 같은 워크북에서 매칭에 성공한 결과만 'proposed' 상태로 저장한다.
export async function createProposedPayrollAdaptiveModel(params: {
  tenantId: string
  sessionId: string
  createdByStaffId: string
}): Promise<CreateProposedPayrollAdaptiveModelResult> {
  const { tenantId, sessionId, createdByStaffId } = params

  const context = await loadPayrollAdaptiveStructuringEligibilityContext({ sessionId, tenantId })
  if (!context) return { success: false, status: 404, error: '세션을 찾을 수 없습니다' }
  if (!context.eligibility.eligible) {
    return { success: false, status: 400, error: context.eligibility.reason }
  }

  // 같은 세션에 이미 proposed/approved 모델이 있으면 새로 만들지 않고 그 모델을 그대로
  // 반환한다(등록 버튼을 여러 번 눌러도 멱등). 그렇지 않으면 같은 워크북에 승인된 모델이
  // 2개 이상 생겨 Slice 5의 ambiguous_model_match로 자동 적용이 스스로 막힐 수 있다.
  const existingActiveModel = await db
    .select({ id: adaptiveStructureModel.id })
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, tenantId),
      eq(adaptiveStructureModel.sourceUploadSessionId, sessionId),
      inArray(adaptiveStructureModel.status, ['proposed', 'approved']),
    ))
    .limit(1)

  if (existingActiveModel[0]) {
    return { success: true, modelId: existingActiveModel[0].id }
  }

  const readableFileTexts = await loadReadablePayrollSourceTexts(context.sourceFiles)
  if (readableFileTexts.length === 0) {
    return { success: false, status: 400, error: '업로드 파일에서 텍스트를 읽지 못해 등록할 수 없습니다' }
  }

  const { data: proposal } = await generatePayrollAdaptiveStructuringProposal(readableFileTexts)
  if (proposal.status !== 'proposal_ready') {
    return { success: false, status: 400, error: proposal.reason }
  }

  const contract = derivePayrollAdaptiveModelContractFromProposal(proposal)
  if (!contract) {
    return { success: false, status: 400, error: '제안에서 구조화 모델을 만들 수 없습니다' }
  }

  const enginePreview = runPayrollAdaptiveCommonEngine(contract, readableFileTexts)
  if (!enginePreview.matched) {
    return {
      success: false,
      status: 400,
      error: enginePreview.blockers[0] ?? '제안이 같은 워크북에서 검증되지 않아 등록할 수 없습니다',
    }
  }

  const ts = toDBString(now())
  const modelId = randomUUID()
  const sheetNames = [...new Set(contract.fieldMappings.map((mapping) => mapping.sheetName))].join(', ')

  await db.insert(adaptiveStructureModel).values({
    id: modelId,
    tenantId,
    name: `${sheetNames} (${contract.payrollModelType})`,
    targetWorkflow: 'payroll',
    sourceClassification: 'business_data',
    status: 'proposed',
    engineVersion: PAYROLL_ADAPTIVE_ENGINE_VERSION,
    modelVersion: 1,
    modelJson: JSON.stringify(contract),
    sampleRowsPreviewJson: JSON.stringify(enginePreview.standardRows.slice(0, 5)),
    validationSummaryJson: JSON.stringify({
      matched: enginePreview.matched,
      blockedRowCount: enginePreview.blockedRowCount,
      blockers: enginePreview.blockers,
      warnings: enginePreview.warnings,
      evidence: enginePreview.evidence,
    }),
    promptVersion: PAYROLL_ADAPTIVE_STRUCTURING_PROMPT_VERSION,
    sourceUploadSessionId: sessionId,
    sourceUploadFileIds: JSON.stringify(context.sourceFiles.map((file) => file.id)),
    createdByStaffId,
    createdAt: ts,
    updatedAt: ts,
  })

  return { success: true, modelId }
}

export type PayrollAdaptiveModelTransitionResult =
  | { success: true }
  | { success: false; status: number; error: string }

async function transitionPayrollAdaptiveModel(params: {
  tenantId: string
  modelId: string
  fromStatus: 'proposed' | 'approved'
  toStatus: 'approved' | 'rejected' | 'retired'
  timestampColumn: 'approvedAt' | 'rejectedAt' | 'retiredAt'
  approvedByStaffId?: string
}): Promise<PayrollAdaptiveModelTransitionResult> {
  const rows = await db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.id, params.modelId),
      eq(adaptiveStructureModel.tenantId, params.tenantId),
    ))
    .limit(1)

  const model = rows[0]
  if (!model) return { success: false, status: 404, error: '모델을 찾을 수 없습니다' }
  if (model.status !== params.fromStatus) {
    return {
      success: false,
      status: 409,
      error: `현재 상태(${model.status})에서는 이 작업을 할 수 없습니다`,
    }
  }

  const ts = toDBString(now())
  // 동시에 approve/reject가 들어오는 경합을 막기 위해, UPDATE의 WHERE에도 직접
  // fromStatus 조건을 걸어 원자적으로 처리한다. 두 요청이 동시에 SELECT에서
  // 같은 fromStatus를 봤더라도, 이 UPDATE는 둘 중 하나만 실제로 행을 바꾼다.
  const result = await db.update(adaptiveStructureModel)
    .set({
      status: params.toStatus,
      updatedAt: ts,
      [params.timestampColumn]: ts,
      ...(params.approvedByStaffId ? { approvedByStaffId: params.approvedByStaffId } : {}),
    })
    .where(and(
      eq(adaptiveStructureModel.id, params.modelId),
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.status, params.fromStatus),
    ))

  if (result.rowsAffected === 0) {
    return {
      success: false,
      status: 409,
      error: '다른 요청이 먼저 이 모델의 상태를 변경했습니다. 새로고침 후 다시 시도해 주세요.',
    }
  }

  return { success: true }
}

// 승인은 TENANT_ADMIN만 가능 — 호출부(API route)에서 role을 먼저 확인한다.
export async function approvePayrollAdaptiveModel(params: {
  tenantId: string
  modelId: string
  approvedByStaffId: string
}): Promise<PayrollAdaptiveModelTransitionResult> {
  return transitionPayrollAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'proposed',
    toStatus: 'approved',
    timestampColumn: 'approvedAt',
    approvedByStaffId: params.approvedByStaffId,
  })
}

export async function rejectPayrollAdaptiveModel(params: {
  tenantId: string
  modelId: string
}): Promise<PayrollAdaptiveModelTransitionResult> {
  return transitionPayrollAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'proposed',
    toStatus: 'rejected',
    timestampColumn: 'rejectedAt',
  })
}

// retire도 승인 해제와 동급 위험도라 TENANT_ADMIN만 — 호출부에서 role을 먼저 확인한다.
export async function retirePayrollAdaptiveModel(params: {
  tenantId: string
  modelId: string
}): Promise<PayrollAdaptiveModelTransitionResult> {
  return transitionPayrollAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'approved',
    toStatus: 'retired',
    timestampColumn: 'retiredAt',
  })
}

export async function listPayrollAdaptiveModels(params: {
  tenantId: string
}): Promise<Array<typeof adaptiveStructureModel.$inferSelect>> {
  return db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.targetWorkflow, 'payroll'),
    ))
}

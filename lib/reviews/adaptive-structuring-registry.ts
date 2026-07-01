import { randomUUID } from 'crypto'
import { get } from '@vercel/blob'
import { and, eq, inArray } from 'drizzle-orm'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import {
  generateReviewAdaptiveStructuringProposal,
  REVIEW_ADAPTIVE_STRUCTURING_PROMPT_VERSION,
} from '@/lib/ai/review-adaptive-structuring-propose'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import { db } from '@/lib/db'
import { adaptiveStructureModel } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { runReviewAdaptiveCommonEngine } from './adaptive-structuring-common-engine'
import { loadReviewAdaptiveStructuringEligibilityContext } from '@/lib/reviews/adaptive-structuring-eligibility-context'
import { deriveReviewAdaptiveModelContractFromProposal } from './adaptive-structuring-proposal-to-contract'

export const REVIEW_ADAPTIVE_ENGINE_VERSION = 'review-common-engine-v1'

// adaptive_structure_model 테이블은 payroll/review(자료검토)가 공유한다(target_workflow
// 컬럼으로 구분). modelId만으로 다른 워크플로의 모델을 조작할 수 없도록, 이 파일의 모든
// 조회/변경은 예외 없이 targetWorkflow:'bookkeeping' 조건을 함께 건다. tenantId만으로는
// 같은 tenant의 payroll 모델 id를 review API가 잘못 approve/reject/retire할 수 있다.
export const REVIEW_ADAPTIVE_TARGET_WORKFLOW = 'bookkeeping' as const

export type CreateProposedReviewAdaptiveModelResult =
  | { success: true; modelId: string }
  | { success: false; status: number; error: string }

async function loadReadableReviewSourceTexts(
  sourceFiles: Array<{ originalFilename: string; storageKey: string; fileType: string }>,
): Promise<ReviewAdaptiveSourceText[]> {
  const fileTextGroups = await Promise.all(
    sourceFiles.map(async (file): Promise<ReviewAdaptiveSourceText[]> => {
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
          profile: 'review',
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
export async function createProposedReviewAdaptiveModel(params: {
  tenantId: string
  sessionId: string
  createdByStaffId: string
}): Promise<CreateProposedReviewAdaptiveModelResult> {
  const { tenantId, sessionId, createdByStaffId } = params

  const context = await loadReviewAdaptiveStructuringEligibilityContext({ sessionId, tenantId })
  if (!context) return { success: false, status: 404, error: '세션을 찾을 수 없습니다' }
  if (!context.eligibility.eligible) {
    return { success: false, status: 400, error: context.eligibility.reason }
  }

  // 같은 세션에 이미 proposed/approved 모델이 있으면 새로 만들지 않고 그 모델을 그대로
  // 반환한다(등록 버튼을 여러 번 눌러도 멱등). targetWorkflow 조건이 없으면 같은
  // sourceUploadSessionId를 쓰는 다른 워크플로 모델과 혼동될 수 있다(이 테이블에서는
  // 이론상 발생하지 않지만, 조건을 빠짐없이 명시한다).
  const existingActiveModel = await db
    .select({ id: adaptiveStructureModel.id })
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, tenantId),
      eq(adaptiveStructureModel.targetWorkflow, REVIEW_ADAPTIVE_TARGET_WORKFLOW),
      eq(adaptiveStructureModel.sourceUploadSessionId, sessionId),
      inArray(adaptiveStructureModel.status, ['proposed', 'approved']),
    ))
    .limit(1)

  if (existingActiveModel[0]) {
    return { success: true, modelId: existingActiveModel[0].id }
  }

  const readableFileTexts = await loadReadableReviewSourceTexts(context.sourceFiles)
  if (readableFileTexts.length === 0) {
    return { success: false, status: 400, error: '업로드 파일에서 텍스트를 읽지 못해 등록할 수 없습니다' }
  }

  const { data: proposal } = await generateReviewAdaptiveStructuringProposal(readableFileTexts)
  if (proposal.status !== 'proposal_ready') {
    return { success: false, status: 400, error: proposal.reason }
  }

  const contract = deriveReviewAdaptiveModelContractFromProposal(proposal)
  if (!contract) {
    return { success: false, status: 400, error: '제안에서 구조화 모델을 만들 수 없습니다' }
  }

  const enginePreview = runReviewAdaptiveCommonEngine(contract, readableFileTexts)
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
    name: `${sheetNames} (${contract.reviewModelType})`,
    targetWorkflow: REVIEW_ADAPTIVE_TARGET_WORKFLOW,
    sourceClassification: 'business_data',
    status: 'proposed',
    engineVersion: REVIEW_ADAPTIVE_ENGINE_VERSION,
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
    promptVersion: REVIEW_ADAPTIVE_STRUCTURING_PROMPT_VERSION,
    sourceUploadSessionId: sessionId,
    sourceUploadFileIds: JSON.stringify(context.sourceFiles.map((file) => file.id)),
    createdByStaffId,
    createdAt: ts,
    updatedAt: ts,
  })

  return { success: true, modelId }
}

export type ReviewAdaptiveModelTransitionResult =
  | { success: true }
  | { success: false; status: number; error: string }

async function transitionReviewAdaptiveModel(params: {
  tenantId: string
  modelId: string
  fromStatus: 'proposed' | 'approved'
  toStatus: 'approved' | 'rejected' | 'retired'
  timestampColumn: 'approvedAt' | 'rejectedAt' | 'retiredAt'
  approvedByStaffId?: string
}): Promise<ReviewAdaptiveModelTransitionResult> {
  const rows = await db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.id, params.modelId),
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.targetWorkflow, REVIEW_ADAPTIVE_TARGET_WORKFLOW),
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
  // fromStatus 조건을 걸어 원자적으로 처리한다. targetWorkflow 조건도 SELECT와
  // 동일하게 다시 걸어, 다른 워크플로 모델이 우연히 같은 조건을 만족해 바뀌지 않게 한다.
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
      eq(adaptiveStructureModel.targetWorkflow, REVIEW_ADAPTIVE_TARGET_WORKFLOW),
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
export async function approveReviewAdaptiveModel(params: {
  tenantId: string
  modelId: string
  approvedByStaffId: string
}): Promise<ReviewAdaptiveModelTransitionResult> {
  return transitionReviewAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'proposed',
    toStatus: 'approved',
    timestampColumn: 'approvedAt',
    approvedByStaffId: params.approvedByStaffId,
  })
}

export async function rejectReviewAdaptiveModel(params: {
  tenantId: string
  modelId: string
}): Promise<ReviewAdaptiveModelTransitionResult> {
  return transitionReviewAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'proposed',
    toStatus: 'rejected',
    timestampColumn: 'rejectedAt',
  })
}

// retire도 승인 해제와 동급 위험도라 TENANT_ADMIN만 — 호출부에서 role을 먼저 확인한다.
export async function retireReviewAdaptiveModel(params: {
  tenantId: string
  modelId: string
}): Promise<ReviewAdaptiveModelTransitionResult> {
  return transitionReviewAdaptiveModel({
    tenantId: params.tenantId,
    modelId: params.modelId,
    fromStatus: 'approved',
    toStatus: 'retired',
    timestampColumn: 'retiredAt',
  })
}

export async function listReviewAdaptiveModels(params: {
  tenantId: string
}): Promise<Array<typeof adaptiveStructureModel.$inferSelect>> {
  return db
    .select()
    .from(adaptiveStructureModel)
    .where(and(
      eq(adaptiveStructureModel.tenantId, params.tenantId),
      eq(adaptiveStructureModel.targetWorkflow, REVIEW_ADAPTIVE_TARGET_WORKFLOW),
    ))
}

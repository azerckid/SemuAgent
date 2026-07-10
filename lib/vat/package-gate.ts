import type { DateTime } from 'luxon'
import { z } from 'zod'
import {
  loadReconciliationPath1Gate,
  type ReconciliationPath1Gate,
} from '@/lib/bookkeeping-review/reconciliation-path1-gate'
import type { SourceCollectionCompleteness } from '@/lib/source-collection/summary'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import type { VatPackagePreview } from './summary'

const VAT_ROUTE = '/dashboard/vat' as const
const SOURCE_COLLECTION_ROUTE = '/dashboard/direct-upload' as const

export const vatPackageGateReasonCodeSchema = z.enum([
  'vat_summary_missing',
  'source_collection_missing',
  'source_collection_normalization_pending',
  'reconciliation_incomplete',
  'vat_deduction_incomplete',
  'confirmed_ledger_provenance_unverified',
])

export const vatPackageGateReasonSchema = z.object({
  code: vatPackageGateReasonCodeSchema,
  count: z.number().int().positive(),
  message: z.string().min(1),
  targetRoute: z.string().startsWith('/dashboard/'),
})

export const vatPackageGateSchema = z.object({
  periodKey: z.string().min(1),
  isReady: z.boolean(),
  blockerCount: z.number().int().nonnegative(),
  summaryReady: z.boolean(),
  sourceCollection: z.object({
    status: z.enum(['ready', 'not_applicable', 'blocked']),
    isReady: z.boolean(),
    missingCount: z.number().int().nonnegative(),
    normalizationPendingCount: z.number().int().nonnegative(),
  }),
  reconciliation: z.object({
    isReady: z.boolean(),
    blockerCount: z.number().int().nonnegative(),
  }),
  deductionReview: z.object({
    isReady: z.boolean(),
    pendingCount: z.number().int().nonnegative(),
  }),
  provenance: z.object({
    status: z.enum(['verified', 'unverified']),
    isReady: z.boolean(),
  }),
  reasons: z.array(vatPackageGateReasonSchema),
})

export type VatPackageGate = z.infer<typeof vatPackageGateSchema>
export type VatPackageGateReason = z.infer<typeof vatPackageGateReasonSchema>

type BuildVatPackageGateParams = {
  periodKey: string
  hasSummary: boolean
  sourceCompleteness: Pick<
    SourceCollectionCompleteness,
    'requiredCount' | 'missingCount' | 'normalizationPendingCount'
  >
  reconciliationGate: Pick<ReconciliationPath1Gate, 'isReady' | 'blockerCount' | 'targetRoute'>
  pendingDeductionCount: number
  provenanceVerified: boolean
}

function periodRoute(route: string, periodKey: string) {
  return `${route}?period=${encodeURIComponent(periodKey)}`
}

export function buildVatPackageGate(params: BuildVatPackageGateParams): VatPackageGate {
  const sourceBlockerCount = params.sourceCompleteness.missingCount
    + params.sourceCompleteness.normalizationPendingCount
  const sourceStatus = sourceBlockerCount > 0
    ? 'blocked'
    : params.sourceCompleteness.requiredCount === 0
      ? 'not_applicable'
      : 'ready'
  const sourceReady = sourceStatus !== 'blocked'
  const deductionReady = params.pendingDeductionCount === 0
  const reasons: VatPackageGateReason[] = []

  if (!params.hasSummary) {
    reasons.push({
      code: 'vat_summary_missing',
      count: 1,
      message: '부가세 기간 요약이 아직 준비되지 않았습니다.',
      targetRoute: periodRoute(VAT_ROUTE, params.periodKey),
    })
  }
  if (params.sourceCompleteness.missingCount > 0) {
    reasons.push({
      code: 'source_collection_missing',
      count: params.sourceCompleteness.missingCount,
      message: `자료수집 미수집 ${params.sourceCompleteness.missingCount}건을 처리해야 합니다.`,
      targetRoute: periodRoute(SOURCE_COLLECTION_ROUTE, params.periodKey),
    })
  }
  if (params.sourceCompleteness.normalizationPendingCount > 0) {
    reasons.push({
      code: 'source_collection_normalization_pending',
      count: params.sourceCompleteness.normalizationPendingCount,
      message: `자료 정규화 대기 ${params.sourceCompleteness.normalizationPendingCount}건을 확인해야 합니다.`,
      targetRoute: periodRoute(SOURCE_COLLECTION_ROUTE, params.periodKey),
    })
  }
  if (!params.reconciliationGate.isReady) {
    reasons.push({
      code: 'reconciliation_incomplete',
      count: Math.max(1, params.reconciliationGate.blockerCount),
      message: `자료대조원장 미해결 ${params.reconciliationGate.blockerCount}건을 처리해야 합니다.`,
      targetRoute: periodRoute(params.reconciliationGate.targetRoute, params.periodKey),
    })
  }
  if (!deductionReady) {
    reasons.push({
      code: 'vat_deduction_incomplete',
      count: params.pendingDeductionCount,
      message: `부가세 공제 검토 ${params.pendingDeductionCount}건을 완료해야 합니다.`,
      targetRoute: periodRoute(VAT_ROUTE, params.periodKey),
    })
  }
  if (!params.provenanceVerified) {
    reasons.push({
      code: 'confirmed_ledger_provenance_unverified',
      count: 1,
      message: '패키지 값의 확정 원장 출처 검증이 아직 완료되지 않았습니다.',
      targetRoute: periodRoute(VAT_ROUTE, params.periodKey),
    })
  }

  const isReady = params.hasSummary
    && sourceReady
    && params.reconciliationGate.isReady
    && deductionReady
    && params.provenanceVerified

  return vatPackageGateSchema.parse({
    periodKey: params.periodKey,
    isReady,
    blockerCount: reasons.reduce((sum, reason) => sum + reason.count, 0),
    summaryReady: params.hasSummary,
    sourceCollection: {
      status: sourceStatus,
      isReady: sourceReady,
      missingCount: params.sourceCompleteness.missingCount,
      normalizationPendingCount: params.sourceCompleteness.normalizationPendingCount,
    },
    reconciliation: {
      isReady: params.reconciliationGate.isReady,
      blockerCount: params.reconciliationGate.blockerCount,
    },
    deductionReview: {
      isReady: deductionReady,
      pendingCount: params.pendingDeductionCount,
    },
    provenance: {
      status: params.provenanceVerified ? 'verified' : 'unverified',
      isReady: params.provenanceVerified,
    },
    reasons,
  })
}

export function applyVatPackageGateToPreview(
  preview: VatPackagePreview,
  gate: VatPackageGate,
): VatPackagePreview {
  if (gate.isReady) return preview

  return {
    ...preview,
    description: '자료수집·자료대조·공제검토·확정 원장 출처 확인 후 생성할 수 있습니다.',
    locked: true,
    lockReason: `${gate.reasons.length}개 생성 조건을 먼저 완료해 주세요.`,
    canGenerate: false,
  }
}

export async function loadVatPackageGate({
  tenantId,
  periodKey,
  hasSummary,
  pendingDeductionCount,
  today,
}: {
  tenantId: string
  periodKey: string
  hasSummary: boolean
  pendingDeductionCount: number
  today?: DateTime
}): Promise<VatPackageGate> {
  const [sourceSummary, reconciliationGate] = await Promise.all([
    loadSourceCollectionSummary({ tenantId, periodKey, today }),
    loadReconciliationPath1Gate({ tenantId, periodKey, today }),
  ])

  return buildVatPackageGate({
    periodKey,
    hasSummary,
    sourceCompleteness: sourceSummary.completeness,
    reconciliationGate,
    pendingDeductionCount,
    // vat_period_summary is still a stored snapshot. Slice 2d-3 must prove
    // confirmed-ledger provenance or replace it with a deterministic rebuild.
    provenanceVerified: false,
  })
}

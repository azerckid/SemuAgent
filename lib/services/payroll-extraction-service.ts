import { randomUUID } from 'crypto'
import { and, desc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { db } from '@/lib/db'
import {
  uploadSession,
  uploadFile,
  payrollExtractionBatch,
  payrollExtractionRow,
  payrollRuleProfileApplication,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import {
  extractPayrollWithProviderFallbackInBatches,
  getPayrollAiModelChainLabel,
} from '@/lib/ai/payroll-extract'
import { reviewPayrollPolicyCandidatesWithProviderFallback } from '@/lib/ai/payroll-policy-review'
import { collectPayrollPolicyReviewCandidatesFromWarnings } from '@/lib/payroll/internal-policy-notes'
import { extractStructuredPayrollFromSourceTexts } from '@/lib/payroll/structured-calculation'
import { applyApprovedPayrollAdaptiveModel } from '@/lib/payroll/adaptive-structuring-apply'
import { getActiveClientPayrollRuleProfile } from '@/lib/payroll/rule-profile-registry'
import { parseClientPayrollRuleProfile } from '@/lib/validations/payroll-rule-profile'
import {
  applyClientPayrollRuleProfileToRows,
  markConflictRowsForReview,
  type ApplyRuleProfileResult,
} from '@/lib/payroll/rule-profile-apply'
import {
  resolvePayrollStoredVerdict,
  sanitizePayrollExtractedRows,
} from '@/lib/payroll/payroll-row-sanitization'
import type { PayrollExtractedRow } from '@/lib/validations/payroll'
import {
  buildPayrollExtractionBatchMessage,
  formatPayrollExtractionMessageForDisplay,
} from '@/lib/payroll/extraction-message'
import { PAYROLL_RUNNING_BATCH_STALE_MINUTES } from '@/lib/payroll/extraction-status'
import { sourceBatchIdForLegacyUploadSession } from '@/lib/source-batch/scope'

export type PayrollExtractionServiceResult =
  | { success: true; batchId: string; rowCount: number; warnings: string[] }
  | { success: false; status: number; error: string }

type ExecutePayrollExtractionInput = {
  sessionId: string
  tenantId: string
  createdByStaffId: string
}

const DEDUCTION_COMPONENT_FIELDS = [
  'nationalPension',
  'healthInsurance',
  'longTermCare',
  'employmentInsurance',
  'incomeTax',
  'localIncomeTax',
  'otherDeduction',
] as const

function buildPayrollRowSourceReference(row: PayrollExtractedRow): string | null {
  const base = row.sourceReference && typeof row.sourceReference === 'object'
    ? { ...row.sourceReference }
    : {}
  const deductionComponents = Object.fromEntries(
    DEDUCTION_COMPONENT_FIELDS
      .map((field) => [field, row[field]])
      .filter((entry): entry is [typeof DEDUCTION_COMPONENT_FIELDS[number], number] => typeof entry[1] === 'number'),
  )

  const merged = Object.keys(deductionComponents).length > 0
    ? { ...base, deductionComponents }
    : base

  return Object.keys(merged).length > 0 ? JSON.stringify(merged) : null
}

function normalizeExtractionError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err
  return '급여 추출 처리 중 알 수 없는 오류가 발생했습니다'
}

async function markPayrollBatchFailed(params: {
  batchId: string
  tenantId: string
  errorMessage: string
}): Promise<void> {
  await db.update(payrollExtractionBatch)
    .set({
      status: 'failed',
      errorMessage: params.errorMessage,
      completedAt: toDBString(now()),
    })
    .where(and(
      eq(payrollExtractionBatch.id, params.batchId),
      eq(payrollExtractionBatch.tenantId, params.tenantId),
      eq(payrollExtractionBatch.status, 'running'),
    ))
}

async function isPayrollBatchStillRunning(params: {
  batchId: string
  tenantId: string
}): Promise<boolean> {
  const rows = await db
    .select({ id: payrollExtractionBatch.id })
    .from(payrollExtractionBatch)
    .where(and(
      eq(payrollExtractionBatch.id, params.batchId),
      eq(payrollExtractionBatch.tenantId, params.tenantId),
      eq(payrollExtractionBatch.status, 'running'),
    ))
    .limit(1)

  return rows.length > 0
}

export async function cancelRunningPayrollExtractionBatch(params: {
  tenantId: string
  sessionId: string
  referenceTime?: ReturnType<typeof now>
}): Promise<{ cancelled: boolean; batchId: string | null }> {
  const runningRows = await db
    .select({ id: payrollExtractionBatch.id })
    .from(payrollExtractionBatch)
    .where(and(
      eq(payrollExtractionBatch.uploadSessionId, params.sessionId),
      eq(payrollExtractionBatch.tenantId, params.tenantId),
      eq(payrollExtractionBatch.status, 'running'),
    ))
    .orderBy(desc(payrollExtractionBatch.createdAt))
    .limit(1)

  const runningBatch = runningRows[0]
  if (!runningBatch) return { cancelled: false, batchId: null }

  const referenceTime = params.referenceTime ?? now()
  await db.update(payrollExtractionBatch)
    .set({
      status: 'failed',
      errorMessage: [
        '담당자가 급여 추출을 중단했습니다.',
        '파일을 확인한 뒤 다시 추출해 주세요.',
      ].join('\n'),
      completedAt: toDBString(referenceTime),
    })
    .where(and(
      eq(payrollExtractionBatch.id, runningBatch.id),
      eq(payrollExtractionBatch.tenantId, params.tenantId),
      eq(payrollExtractionBatch.status, 'running'),
    ))

  return { cancelled: true, batchId: runningBatch.id }
}

export async function cleanupStalePayrollExtractionBatches(params: {
  tenantId: string
  sessionId?: string
  referenceTime?: ReturnType<typeof now>
}): Promise<number> {
  const referenceTime = params.referenceTime ?? now()
  const staleBefore = toDBString(referenceTime.minus({ minutes: PAYROLL_RUNNING_BATCH_STALE_MINUTES }))
  const conditions = [
    eq(payrollExtractionBatch.tenantId, params.tenantId),
    eq(payrollExtractionBatch.status, 'running' as const),
    lte(payrollExtractionBatch.createdAt, staleBefore),
  ]
  if (params.sessionId) {
    conditions.push(eq(payrollExtractionBatch.uploadSessionId, params.sessionId))
  }

  const staleRows = await db
    .select({ id: payrollExtractionBatch.id })
    .from(payrollExtractionBatch)
    .where(and(...conditions))

  if (staleRows.length === 0) return 0

  await db.update(payrollExtractionBatch)
    .set({
      status: 'failed',
      errorMessage: [
        `급여 추출이 ${PAYROLL_RUNNING_BATCH_STALE_MINUTES}분 이상 완료되지 않아 중단된 것으로 처리했습니다.`,
        '파일을 확인한 뒤 다시 추출해 주세요.',
      ].join('\n'),
      completedAt: toDBString(referenceTime),
    })
    .where(inArray(payrollExtractionBatch.id, staleRows.map((row) => row.id)))

  return staleRows.length
}

type RuleProfileApplicationOutcome =
  | { status: 'corrupt' }
  | {
      status: 'applied'
      rows: PayrollExtractedRow[]
      profileId: string
      profileVersion: number
      application: ApplyRuleProfileResult
      snapshotJson: string
    }

/**
 * 승인된 고객사 급여기준 프로필을 추출 행에 적용한다.
 *
 * - active 프로필이 없으면 `null` → 기존(규정 미적용) 동작을 유지한다.
 * - active 프로필이 있는데 JSON이 손상돼 파싱 실패하면 `{ status: 'corrupt' }`를
 *   반환한다. 담당자는 승인된 기준이 적용됐다고 믿으므로 "없는 것처럼" 진행하면
 *   안 된다(fail closed). 호출부가 batch를 실패시킨다.
 * - 정상 적용 시 `{ status: 'applied', ... }`.
 *
 * 스냅샷 JSON에는 적용된 규칙 근거만 담고 직원 원자료는 담지 않는다(불변 감사).
 */
async function applyActiveRuleProfileToPayrollRows(params: {
  tenantId: string
  clientId: string
  payrollPeriod: string
  rows: PayrollExtractedRow[]
}): Promise<RuleProfileApplicationOutcome | null> {
  const profileRow = await getActiveClientPayrollRuleProfile({
    tenantId: params.tenantId,
    clientId: params.clientId,
    payrollPeriod: params.payrollPeriod,
  })
  if (!profileRow) return null

  const profile = parseClientPayrollRuleProfile(profileRow.profileJson)
  if (!profile) return { status: 'corrupt' }

  const application = applyClientPayrollRuleProfileToRows({ profile, rows: params.rows })
  const snapshotJson = JSON.stringify({
    schemaVersion: profile.schemaVersion,
    profileVersion: profileRow.version,
    effectiveFrom: profile.effectiveFrom,
    effectiveTo: profile.effectiveTo ?? null,
    appliedRules: application.appliedRules,
    appliedFields: application.appliedFields,
    filledCount: application.filledCount,
    conflictCount: application.conflicts.length,
    skippedRules: application.skippedRules,
  })

  return {
    status: 'applied',
    rows: application.rows,
    profileId: profileRow.id,
    profileVersion: profileRow.version,
    application,
    snapshotJson,
  }
}

export async function executePayrollExtraction(
  input: ExecutePayrollExtractionInput,
): Promise<PayrollExtractionServiceResult> {
  const { sessionId, tenantId, createdByStaffId } = input

  // 세션 조회 및 payroll 여부 확인
  const sessionRows = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  const session = sessionRows[0]
  if (!session) {
    return { success: false, status: 404, error: '세션을 찾을 수 없습니다' }
  }
  if (session.requestKind !== 'payroll') {
    return { success: false, status: 400, error: '급여정산 세션이 아닙니다' }
  }

  await cleanupStalePayrollExtractionBatches({ sessionId, tenantId })

  // 중복 실행 보호: 이미 추출이 실행 중이면 새 batch를 만들지 않는다.
  const runningBatch = await db
    .select({ id: payrollExtractionBatch.id })
    .from(payrollExtractionBatch)
    .where(
      and(
        eq(payrollExtractionBatch.uploadSessionId, sessionId),
        eq(payrollExtractionBatch.tenantId, tenantId),
        eq(payrollExtractionBatch.status, 'running'),
      ),
    )
    .limit(1)

  if (runningBatch[0]) {
    return { success: false, status: 409, error: '급여자료 추출이 이미 실행 중입니다' }
  }

  // 업로드 파일 목록 조회
  const files = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  if (files.length === 0) {
    return { success: false, status: 400, error: '업로드된 파일이 없습니다' }
  }

  const ts = toDBString(now())
  const batchId = randomUUID()
  const sourceBatchId = sourceBatchIdForLegacyUploadSession(sessionId)

  // batch 생성 (running 상태)
  // 위 SELECT 검사 후 INSERT 사이 race condition은 partial unique index
  // (payroll_batch_running_uidx)가 두 번째 INSERT를 거부해 DB 레벨에서 차단함.
  try {
    await db.insert(payrollExtractionBatch).values({
      id: batchId,
      tenantId,
      uploadSessionId: sessionId,
      sourceBatchId,
      requestEventId: session.requestEventId ?? null,
      status: 'running',
      sourceUploadFileIds: JSON.stringify(files.map((f) => f.id)),
      model: getPayrollAiModelChainLabel(),
      createdByStaffId,
      createdAt: ts,
    })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (msg.includes('UNIQUE') || msg.includes('payroll_batch_running_uidx')) {
      return { success: false, status: 409, error: '급여자료 추출이 이미 실행 중입니다' }
    }
    throw err
  }

  try {
    // 각 파일에서 텍스트 추출 (Blob fetch -> extract). payroll Excel은 sheet/row chunk로 분할될 수 있다.
    const fileTextGroups = await Promise.all(
      files.map(async (f) => {
        try {
          const blob = await get(f.storageKey, { access: 'private' })
          if (!blob || blob.statusCode !== 200) {
            return [{ filename: f.originalFilename, text: null, summary: 'Blob 접근 실패' }]
          }
          const buffer = await new Response(blob.stream).arrayBuffer()
          const chunks = await extractDocumentTextChunks({
            fileBuffer: buffer,
            fileType: f.fileType as 'pdf' | 'excel' | 'image' | 'other',
            originalFilename: f.originalFilename,
            profile: 'payroll',
          })
          return chunks.map((chunk) => ({
            filename: f.originalFilename,
            text: chunk.text,
            summary: chunk.summary,
            chunkIndex: chunk.chunkIndex,
            chunkTotal: chunk.chunkTotal,
            sheetName: chunk.sheetName,
            rowStart: chunk.rowStart,
            rowEnd: chunk.rowEnd,
          }))
        } catch {
          return [{ filename: f.originalFilename, text: null, summary: '파일 처리 중 오류 발생' }]
        }
      }),
    )

    const fileTexts = fileTextGroups.flat()
    if (!(await isPayrollBatchStillRunning({ batchId, tenantId }))) {
      return { success: false, status: 409, error: '급여 추출이 중단되었습니다' }
    }

    const payrollPeriod = session.accountingPeriod
    const structuredExtractResult = extractStructuredPayrollFromSourceTexts(fileTexts, payrollPeriod)
    // 실행 우선순위(spec #2): 코드 extractor 성공 → 승인된 구조화 모델 → AI fallback.
    // 코드 extractor가 이미 성공했으면 구조화 모델은 시도조차 하지 않는다(덮어쓰지 않음).
    const adaptiveExtractResult = structuredExtractResult
      ? null
      : await applyApprovedPayrollAdaptiveModel({ tenantId, uploadSessionId: sessionId, payrollPeriod, fileTexts })
    const extractResult = structuredExtractResult
      ?? adaptiveExtractResult
      ?? await extractPayrollWithProviderFallbackInBatches(fileTexts, payrollPeriod)

    if (!extractResult.success) {
      const errorMessage = formatPayrollExtractionMessageForDisplay(extractResult.error) ?? extractResult.error
      await markPayrollBatchFailed({ batchId, tenantId, errorMessage })
      return { success: false, status: 500, error: `AI 추출 실패: ${errorMessage}` }
    }

    // 고객사 자료의 합계·이상 행이 직원으로 흘러드는 것을 막는 정제 단계.
    // L2: 라벨형 집계행은 제외(삭제), L3: 구조적 이상행은 needs_review로 강등,
    // L4: 원본 명시 인원수와 실제 직원 수가 다르면 모순을 warning으로 표면화.
    const sanitization = sanitizePayrollExtractedRows(extractResult.data.rows)
    const rows = sanitization.rows
    const warnings = [...extractResult.data.warnings]
    if (structuredExtractResult?.success && warnings.length > 0) {
      const policyReviewCandidates = collectPayrollPolicyReviewCandidatesFromWarnings(warnings)
      if (policyReviewCandidates.length > 0) {
        if (!(await isPayrollBatchStillRunning({ batchId, tenantId }))) {
          return { success: false, status: 409, error: '급여 추출이 중단되었습니다' }
        }
        const policyReview = await reviewPayrollPolicyCandidatesWithProviderFallback(
          policyReviewCandidates,
          payrollPeriod,
        )
        warnings.unshift(...policyReview.warnings)
      }
    }
    if (!(await isPayrollBatchStillRunning({ batchId, tenantId }))) {
      return { success: false, status: 409, error: '급여 추출이 중단되었습니다' }
    }

    warnings.push(...sanitization.warnings)

    // 승인된 고객사 급여기준 프로필을 적용해 지급(F~T) 항목을 규정대로 채운다.
    // 프로필이 없으면 null → 기존(규정 미적용) 동작 그대로. 적용 시 행 값(F~T)만 바뀐다.
    let ruleApplication: Extract<RuleProfileApplicationOutcome, { status: 'applied' }> | null = null
    if (rows.length > 0) {
      const outcome = await applyActiveRuleProfileToPayrollRows({
        tenantId,
        clientId: session.clientId,
        payrollPeriod,
        rows: rows.map((item) => item.row),
      })
      if (outcome?.status === 'corrupt') {
        // active 프로필이 있는데 읽지 못함: 잘못된 기준이 적용된 것처럼 진행하지 않고 차단(fail closed).
        const message = [
          '승인된 급여기준 프로필을 읽지 못했습니다(기준 데이터 손상).',
          '잘못된 기준이 적용될 수 있어 급여 추출을 중단했습니다. 급여기준 프로필을 확인해 주세요.',
        ].join('\n')
        await markPayrollBatchFailed({ batchId, tenantId, errorMessage: message })
        return { success: false, status: 500, error: message }
      }
      if (outcome?.status === 'applied') {
        ruleApplication = outcome
        outcome.rows.forEach((appliedRow, index) => {
          rows[index].row = appliedRow
        })
        // 승인 규칙 금액과 업로드 데이터가 충돌한 행은 결과 엑셀 안전 게이트(전 행 pass)를
        // 통과하지 못하도록 needs_review(fail)로 강등한다. 기존 reviewReason은 보존.
        markConflictRowsForReview(rows, outcome.application.conflicts)
        warnings.push(...outcome.application.warnings)
      }
    }

    // payroll_extraction_row 저장
    if (rows.length > 0) {
      const rowTs = toDBString(now())
      await db.insert(payrollExtractionRow).values(
        rows.map(({ row: r, reviewReason }) => {
          // 최종 판정: needs_review 강등 사유가 있으면 fail로 덮어쓴다.
          // (Tool schema가 aiVerdict를 required로 강제하므로 정상 경로에서는
          // 값이 있고, fallback은 'high' confidence만 보수적으로 pass 인정.)
          const { aiVerdict, aiVerdictReason } = resolvePayrollStoredVerdict(r, reviewReason)
          return {
            id: randomUUID(),
            tenantId,
            batchId,
            uploadSessionId: sessionId,
            sourceBatchId,
            payrollPeriod,
            employeeCode: r.employeeCode ?? null,
            employeeName: r.employeeName ?? null,
            department: r.department ?? null,
            jobTitle: r.jobTitle ?? null,
            jobType: r.jobType ?? null,
            baseSalary: r.baseSalary ?? null,
            bonus: r.bonus ?? null,
            mealAllowance: r.mealAllowance ?? null,
            transportationAllowance: r.transportationAllowance ?? null,
            holidayWorkAllowance: r.holidayWorkAllowance ?? null,
            domesticTravelAllowance: r.domesticTravelAllowance ?? null,
            annualLeaveAllowance: r.annualLeaveAllowance ?? null,
            rndAllowance: r.rndAllowance ?? null,
            otherAllowance: r.otherAllowance ?? null,
            performanceIncentive: r.performanceIncentive ?? null,
            nightWorkAllowance: r.nightWorkAllowance ?? null,
            vehicleMaintenanceAllowance: r.vehicleMaintenanceAllowance ?? null,
            retroactivePay: r.retroactivePay ?? null,
            overtimeAllowance: r.overtimeAllowance ?? null,
            childcareAllowance: r.childcareAllowance ?? null,
            deductionAmount: r.deductionAmount ?? null,
            memo: r.memo ?? null,
            confidence: (r.confidence ?? 'unknown') as 'high' | 'medium' | 'low' | 'unknown',
            aiVerdict,
            aiVerdictReason,
            // payroll 업무 판정은 aiVerdict(pass/fail) 두 가지가 기준이다.
            // reviewStatus는 기존 DB 호환용으로만 유지하고 화면/출력 조건에는 사용하지 않는다.
            reviewStatus: 'needs_review' as const,
            sourceReference: buildPayrollRowSourceReference(r),
            createdAt: rowTs,
            updatedAt: rowTs,
          }
        }),
      )
    }

    // batch 완료
    const finalStatus = rows.length === 0 ? 'failed' : 'completed'
    const errorMessage = buildPayrollExtractionBatchMessage({
      rowCount: rows.length,
      warnings,
      payrollPeriod,
    })
    await db.update(payrollExtractionBatch)
      .set({
        status: finalStatus,
        completedAt: toDBString(now()),
        errorMessage,
      })
      .where(and(
        eq(payrollExtractionBatch.id, batchId),
        eq(payrollExtractionBatch.tenantId, tenantId),
        eq(payrollExtractionBatch.status, 'running'),
      ))

    // 적용 스냅샷 저장(실행당 불변 감사). 규정을 실제 적용했고 행이 저장된 경우만.
    if (ruleApplication && finalStatus === 'completed') {
      const snapshotTs = toDBString(now())
      await db.insert(payrollRuleProfileApplication).values({
        id: randomUUID(),
        tenantId,
        clientId: session.clientId,
        profileId: ruleApplication.profileId,
        profileVersion: ruleApplication.profileVersion,
        uploadSessionId: sessionId,
        sourceBatchId,
        batchId,
        snapshotJson: ruleApplication.snapshotJson,
        appliedAt: snapshotTs,
        createdAt: snapshotTs,
      })
    }

    return { success: true, batchId, rowCount: rows.length, warnings }
  } catch (err) {
    const rawErrorMessage = normalizeExtractionError(err)
    const errorMessage = formatPayrollExtractionMessageForDisplay(rawErrorMessage) ?? rawErrorMessage
    await markPayrollBatchFailed({ batchId, tenantId, errorMessage })
    console.error(`[payroll-extraction] batch 실패 (${batchId}):`, err)
    return { success: false, status: 500, error: `급여 추출 실패: ${errorMessage}` }
  }
}

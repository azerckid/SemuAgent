import { createHash } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingJournalEntryRun,
  bookkeepingJournalEntryVoucher,
  bookkeepingJournalEntryVoucherLine,
  bookkeepingTransactionClassification,
  client,
  employeeProfile,
  tenant,
  filingChecklistItem,
  filingItem,
  internalReminderRule,
  internalReminderSendLog,
  payrollEmployeeLine,
  payrollExtractionBatch,
  payrollExtractionRow,
  payrollPeriodSummary,
  requestItemValidation,
  requestItemValidationFile,
  sampleDataset,
  sampleEntityRef,
  sourceBatch,
  staff,
  uploadFile,
  uploadSession,
  vatDeductionReview,
  vatPeriodSummary,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

export const FIRST_RUN_SAMPLE_SEED_VERSION = '2026-07-04.v1'
export const FIRST_RUN_SAMPLE_PERIOD_KEY = '2026-H1'
export const FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY = '2026-06'

export type FirstRunSampleSource = 'first_run_onboarding' | 'manual_retry'
export type FirstRunSampleSeedResult = {
  datasetId: string | null
  clientId: string | null
  status: 'active' | 'creating' | 'delete_pending' | 'deleted' | 'failed'
  created: boolean
  errorMessage?: string
}

type ExistingSampleDatasetRow = {
  id: string
  clientId: string
  status: FirstRunSampleSeedResult['status']
  errorMessage?: string | null
}

export function resolveExistingFirstRunSampleDataset(
  datasets: ExistingSampleDatasetRow[],
  source: FirstRunSampleSource,
): FirstRunSampleSeedResult | null {
  const visible = datasets.find((dataset) => (
    dataset.status === 'active' || dataset.status === 'creating' || dataset.status === 'delete_pending'
  ))
  if (visible) {
    return { datasetId: visible.id, clientId: visible.clientId, status: visible.status, created: false }
  }

  const deleted = datasets.find((dataset) => dataset.status === 'deleted')
  if (deleted) {
    return { datasetId: deleted.id, clientId: deleted.clientId, status: 'deleted', created: false }
  }

  const failed = datasets.find((dataset) => dataset.status === 'failed')
  if (failed && source !== 'manual_retry') {
    return {
      datasetId: failed.id,
      clientId: failed.clientId,
      status: 'failed',
      created: false,
      errorMessage: failed.errorMessage ?? undefined,
    }
  }

  return null
}

type SeedParams = {
  tenantId: string
  clientId: string
  staffId: string
  userId: string
  datasetId: string
  timestamp: string
  createdClient: boolean
  businessEntityName?: string | null
}

type SampleRefPlan = {
  entityTable: string
  entityId: string
  deleteOrder: number
}

function hashPart(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export function firstRunSampleId(tenantId: string, suffix: string) {
  return `sample_${hashPart(tenantId)}_${suffix}`
}

function addRef(refs: SampleRefPlan[], entityTable: string, entityId: string, deleteOrder: number) {
  refs.push({ entityTable, entityId, deleteOrder })
}

function buildSampleValidationRows(params: SeedParams, sessionId: string) {
  const rows: Array<typeof requestItemValidation.$inferInsert> = []
  const push = (suffix: string, itemGroup: string, validationStatus: 'satisfied' | 'missing' | 'uncertain', itemName: string, requestedAction: string | null = null) => {
    rows.push({
      id: firstRunSampleId(params.tenantId, `riv_${suffix}`),
      tenantId: params.tenantId,
      uploadSessionId: sessionId,
      requestEventId: null,
      itemName,
      itemGroup,
      criterionType: 'material',
      requiredness: 'required',
      conditionText: null,
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      validationStatus,
      reviewStatus: validationStatus === 'satisfied' ? 'confirmed' : 'ai_suggested',
      aiReasoning: '첫 가입 샘플 데이터 기준으로 생성된 자료 상태입니다.',
      requestedAction,
      staffNote: null,
      reviewedByStaffId: validationStatus === 'satisfied' ? params.staffId : null,
      reviewedAt: validationStatus === 'satisfied' ? params.timestamp : null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    })
  }

  for (let i = 1; i <= 4; i += 1) push(`sales_tax_${i}`, 'sales_tax_invoice', 'satisfied', `매출 세금계산서 ${i}`)
  for (let i = 1; i <= 4; i += 1) push(`purchase_tax_${i}`, 'purchase_tax_invoice', 'satisfied', `매입 세금계산서 ${i}`)
  for (let i = 1; i <= 4; i += 1) push(`bank_${i}`, 'bank_statement', 'satisfied', `보통예금 거래내역 ${i}`)
  push('card_1', 'card_statement', 'satisfied', '신한카드 법인 매입내역 4월')
  push('card_2', 'card_statement', 'satisfied', '신한카드 법인 매입내역 6월')
  push('card_missing', 'card_statement', 'missing', '5월 카드매입 자료 1건', '신한카드 법인 매입내역의 5월 파일이 아직 업로드되지 않았습니다.')
  for (let i = 1; i <= 6; i += 1) push(`receipt_${i}`, 'other_evidence', 'satisfied', `영수증 묶음 ${i}`)
  for (let i = 1; i <= 3; i += 1) push(`receipt_uncertain_${i}`, 'other_evidence', 'uncertain', `영수증 정규화 확인 ${i}`, '자동 분류 신뢰도가 낮아 확인이 필요합니다.')

  return rows
}

function buildSampleUploadFiles(params: SeedParams, sessionId: string, sourceBatchId: string) {
  const rows: Array<typeof uploadFile.$inferInsert> = [
    {
      id: firstRunSampleId(params.tenantId, 'file_tax_invoice'),
      uploadSessionId: sessionId,
      sourceBatchId,
      tenantId: params.tenantId,
      originalFilename: 'sample-tax-invoice.pdf',
      storageKey: 'sample://first-run/tax-invoice',
      fileType: 'pdf',
      fileSize: 820_000,
      contentHash: firstRunSampleId(params.tenantId, 'hash_tax_invoice'),
      status: 'matched',
      passwordStatus: 'none',
      uploadedAt: '2026-06-28T09:30:00.000+09:00',
      staffReviewStatus: 'none',
    },
    {
      id: firstRunSampleId(params.tenantId, 'file_bank'),
      uploadSessionId: sessionId,
      sourceBatchId,
      tenantId: params.tenantId,
      originalFilename: 'sample-bank.xlsx',
      storageKey: 'sample://first-run/bank-statement',
      fileType: 'excel',
      fileSize: 540_000,
      contentHash: firstRunSampleId(params.tenantId, 'hash_bank'),
      status: 'matched',
      passwordStatus: 'none',
      uploadedAt: '2026-06-28T10:10:00.000+09:00',
      staffReviewStatus: 'none',
    },
    {
      id: firstRunSampleId(params.tenantId, 'file_receipts_pending'),
      uploadSessionId: sessionId,
      sourceBatchId,
      tenantId: params.tenantId,
      originalFilename: 'sample-receipts.zip',
      storageKey: 'sample://first-run/receipts-pending',
      fileType: 'other',
      fileSize: 1_240_000,
      contentHash: firstRunSampleId(params.tenantId, 'hash_receipts_pending'),
      status: 'analyzing',
      passwordStatus: 'none',
      uploadedAt: '2026-06-28T10:35:00.000+09:00',
      staffReviewStatus: 'none',
    },
    {
      id: firstRunSampleId(params.tenantId, 'file_receipts_failed'),
      uploadSessionId: sessionId,
      tenantId: params.tenantId,
      originalFilename: 'sample-receipts-failed.pdf',
      storageKey: 'sample://first-run/receipts-failed',
      fileType: 'pdf',
      fileSize: 380_000,
      contentHash: firstRunSampleId(params.tenantId, 'hash_receipts_failed'),
      status: 'failed',
      passwordStatus: 'none',
      uploadedAt: '2026-06-28T10:50:00.000+09:00',
      staffReviewStatus: 'none',
      staffReviewNote: '샘플 파싱 오류 상태입니다.',
    },
  ]
  return rows
}

function buildValidationFileLinks(params: SeedParams, validationRows: Array<typeof requestItemValidation.$inferInsert>, fileRows: Array<typeof uploadFile.$inferInsert>) {
  const findValidation = (suffix: string) => validationRows.find((row) => row.id === firstRunSampleId(params.tenantId, suffix))?.id
  const links: Array<typeof requestItemValidationFile.$inferInsert> = []
  const push = (suffix: string, validationSuffix: string, fileSuffix: string, contribution: 'satisfied' | 'partial' | 'uncertain' | 'non_compliant') => {
    const validationId = findValidation(validationSuffix)
    const uploadFileId = fileRows.find((row) => row.id === firstRunSampleId(params.tenantId, fileSuffix))?.id
    if (!validationId || !uploadFileId) return
    links.push({
      id: firstRunSampleId(params.tenantId, `rivf_${suffix}`),
      tenantId: params.tenantId,
      validationId,
      uploadFileId,
      contribution,
      createdAt: params.timestamp,
    })
  }
  push('tax', 'riv_sales_tax_1', 'file_tax_invoice', 'satisfied')
  push('bank', 'riv_bank_1', 'file_bank', 'satisfied')
  push('receipt_pending', 'riv_receipt_uncertain_1', 'file_receipts_pending', 'uncertain')
  push('receipt_failed', 'riv_receipt_uncertain_2', 'file_receipts_failed', 'non_compliant')
  return links
}

function buildSampleBookkeepingRows(params: SeedParams, sessionId: string, runId: string) {
  const rows: Array<typeof bookkeepingTransactionClassification.$inferInsert> = []
  const accounts = ['지급수수료', '소모품비', '여비교통비', '접대비', '통신비', '매출']
  for (let i = 1; i <= 342; i += 1) {
    const isConfirmed = i <= 324
    const isLowPending = i > 337
    const id = firstRunSampleId(params.tenantId, `bk_tx_${String(i).padStart(3, '0')}`)
    const amount = i % 7 === 0 ? 320_000 : 48_000 + (i % 12) * 7_500
    rows.push({
      id,
      tenantId: params.tenantId,
      classificationRunId: runId,
      uploadSessionId: sessionId,
      uploadFileId: null,
      sourceType: i % 4 === 0 ? 'card' : i % 4 === 1 ? 'bank' : i % 4 === 2 ? 'tax_invoice' : 'receipt',
      transactionDate: `2026-06-${String((i % 27) + 1).padStart(2, '0')}`,
      merchantName: isConfirmed ? `샘플거래처 ${i}` : i % 2 === 0 ? '카페 샘플' : '문구 샘플',
      description: isConfirmed ? '계정과목 확정 샘플 거래' : '검토가 필요한 샘플 거래',
      amountKrw: amount,
      direction: i % 6 === 0 ? 'income' : 'expense',
      recommendedAccount: accounts[i % accounts.length],
      recommendationConfidence: isConfirmed ? 'high' : isLowPending ? 'low' : 'medium',
      recommendationReason: '승인 Preview 재현을 위한 샘플 분류 결과입니다.',
      evidenceJson: null,
      finalAccount: isConfirmed ? accounts[i % accounts.length] : null,
      staffMemo: null,
      status: isConfirmed ? 'confirmed' : isLowPending ? 'needs_decision' : 'suggested',
      confirmedByStaffId: isConfirmed ? params.staffId : null,
      confirmedAt: isConfirmed ? params.timestamp : null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    })
  }
  return rows
}

function buildSamplePayrollLines(params: SeedParams, periodSummaryId: string) {
  const names = ['김대표', '이수민', '박지훈', '최민준', '정하늘', '오세린', '한유진', '서도윤', '문가람', '장서우', '윤태오', '강하린']
  const rows: Array<typeof payrollEmployeeLine.$inferInsert> = []
  for (let i = 0; i < names.length; i += 1) {
    const gross = i < 10 ? 3_500_000 : 3_800_000
    const withholding = 175_000
    const incomeTax = 159_100
    const localIncomeTax = 15_900
    const social = i < 8 ? 312_000 : 311_000
    const national = i < 8 ? 135_000 : 134_500
    const health = 120_000
    const care = 15_000
    const employment = social - national - health - care
    const deduction = withholding + social
    rows.push({
      id: firstRunSampleId(params.tenantId, `payroll_line_${String(i + 1).padStart(2, '0')}`),
      tenantId: params.tenantId,
      clientId: params.clientId,
      periodSummaryId,
      sourceBatchId: null,
      sourceRowId: null,
      uploadSessionId: null,
      employeeCode: `E${String(i + 1).padStart(3, '0')}`,
      employeeName: names[i],
      department: i === 0 ? '경영' : i % 3 === 0 ? '영업' : i % 3 === 1 ? '운영' : '제품',
      jobTitle: i === 0 ? '대표' : '매니저',
      jobType: '정규직',
      baseSalaryKrw: gross - (i % 3 === 0 ? 200_000 : 100_000),
      allowanceKrw: i % 3 === 0 ? 200_000 : 100_000,
      grossPayKrw: gross,
      incomeTaxKrw: incomeTax,
      localIncomeTaxKrw: localIncomeTax,
      nationalPensionKrw: national,
      healthInsuranceKrw: health,
      longTermCareKrw: care,
      employmentInsuranceKrw: employment,
      socialInsuranceKrw: social,
      otherDeductionKrw: 0,
      deductionTotalKrw: deduction,
      netPayKrw: gross - deduction,
      noticeMatchStatus: i === 0 ? 'missing_notice' : 'matched',
      status: i === 0 ? 'needs_review' : 'ready',
      issueCode: i === 0 ? 'insurance_start_date_missing' : null,
      issueMessage: i === 0 ? '신규 입사자 4대보험 취득일 확인 필요' : null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    })
  }
  return rows
}

function buildSampleEmployees(params: SeedParams) {
  const baseNames = ['김대표', '이수민', '박지훈', '최민준', '정하늘', '오세린', '한유진', '서도윤', '문가람', '장서우', '윤태오', '강하린', '백은서', '남지호']
  return baseNames.map((displayName, index): typeof employeeProfile.$inferInsert => {
    const terminated = index >= 12
    return {
      id: firstRunSampleId(params.tenantId, `employee_${String(index + 1).padStart(2, '0')}`),
      tenantId: params.tenantId,
      clientId: params.clientId,
      employeeCode: `E${String(index + 1).padStart(3, '0')}`,
      displayName,
      department: index === 0 ? '경영' : index % 3 === 0 ? '영업' : index % 3 === 1 ? '운영' : '제품',
      jobTitle: index === 0 ? '대표' : '매니저',
      employeeStatus: terminated ? 'terminated' : 'active',
      payrollEligibility: index === 11 || terminated ? 'excluded' : 'eligible',
      insuranceEnrollmentStatus: index === 0 ? 'needs_review' : terminated ? 'not_applicable' : 'enrolled',
      hireDate: `2025-${String((index % 12) + 1).padStart(2, '0')}-01`,
      terminationDate: terminated ? '2026-05-31' : null,
      workEmail: `sample.employee${index + 1}@example.invalid`,
      notificationEnabled: index < 2,
      createdByStaffId: params.staffId,
      updatedByStaffId: params.staffId,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    }
  })
}

function buildSampleReminderRules(params: SeedParams) {
  const rule = (suffix: string, domain: typeof internalReminderRule.$inferInsert.domain, triggerType: typeof internalReminderRule.$inferInsert.triggerType, offsetDays: number | null, enabled: boolean, subjectTemplate: string, bodyTemplate: string): typeof internalReminderRule.$inferInsert => ({
    id: firstRunSampleId(params.tenantId, `reminder_rule_${suffix}`),
    tenantId: params.tenantId,
    clientId: params.clientId,
    domain,
    triggerType,
    offsetDays,
    enabled,
    recipientSource: 'staff',
    subjectTemplate,
    bodyTemplate,
    createdByStaffId: params.staffId,
    updatedByStaffId: params.staffId,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  })
  return [
    rule('vat', 'vat', 'deadline_offset', 3, true, '부가세 {{periodLabel}} 마감 D-{{dDay}} · 공제 검토 {{attentionCount}}건 남음', '공제 검토와 신고 패키지를 확인해 주세요.'),
    rule('payroll', 'payroll', 'daily_digest', null, true, '{{payrollLabel}} 급여 확인 필요 {{attentionCount}}건', '급여 확인 필요 직원과 4대보험 고지액을 확인해 주세요.'),
    rule('source', 'source_collection', 'daily_digest', null, true, '신고 기간 미수집 자료 {{attentionCount}}건 확인', '미수집 자료와 정규화 대기 자료를 확인해 주세요.'),
    rule('filing', 'filing_support', 'manual', null, false, '제출 접수증 보관·사후 체크리스트 확인', '신고지원 화면에서 접수증 보관 상태를 확인해 주세요.'),
  ]
}

export function buildFirstRunSampleSeedPlan(params: SeedParams) {
  const refs: SampleRefPlan[] = []
  const sessionId = firstRunSampleId(params.tenantId, 'upload_session_2026h1')
  const payrollSessionId = firstRunSampleId(params.tenantId, 'payroll_session_202606')
  const sourceBatchId = firstRunSampleId(params.tenantId, 'source_batch_2026h1')
  const payrollSourceBatchId = firstRunSampleId(params.tenantId, 'source_batch_payroll_202606')
  const runId = firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1')
  const journalRunId = firstRunSampleId(params.tenantId, 'journal_run_2026h1')
  const firstPendingTxId = firstRunSampleId(params.tenantId, 'bk_tx_325')
  const voucherId = firstRunSampleId(params.tenantId, 'journal_voucher_001')
  const payrollSummaryId = firstRunSampleId(params.tenantId, 'payroll_summary_202606')
  const payrollBatchId = firstRunSampleId(params.tenantId, 'payroll_batch_202606')

  const clientRow: typeof client.$inferInsert | null = params.createdClient
    ? {
        id: params.clientId,
        tenantId: params.tenantId,
        staffId: params.staffId,
        email: `sample-${hashPart(params.tenantId)}@example.invalid`,
        contactName: '김대표',
        name: params.businessEntityName?.trim() || '샘플컴퍼니(주)',
        address: '서울특별시 중구 샘플로 10',
        phone: null,
        analysisNotes: '첫 가입 샘플 사업장입니다. 실제 사용 전 샘플 데이터를 삭제하세요.',
        createdAt: params.timestamp,
      }
    : null

  const uploadSessions: Array<typeof uploadSession.$inferInsert> = [
    {
      id: sessionId,
      tenantId: params.tenantId,
      clientId: params.clientId,
      createdByStaffId: params.staffId,
      accountingPeriod: '2026-06',
      bookkeepingPeriodType: 'monthly',
      bookkeepingPeriodStart: '2026-01',
      bookkeepingPeriodEnd: '2026-06',
      tokenHash: firstRunSampleId(params.tenantId, 'token_source'),
      uploadUrl: null,
      expiresAt: '2026-07-25T23:59:59.000+09:00',
      status: 'ready_for_accountant',
      analysisNotes: '첫 가입 자료수집 샘플 세션입니다.',
      requestKind: 'general',
      source: 'staff_direct',
      staffDirectLabel: '2026년 부가세 1기 샘플 자료수집',
      createdAt: params.timestamp,
    },
    {
      id: payrollSessionId,
      tenantId: params.tenantId,
      clientId: params.clientId,
      createdByStaffId: params.staffId,
      accountingPeriod: '2026-06',
      bookkeepingPeriodType: 'monthly',
      bookkeepingPeriodStart: '2026-06',
      bookkeepingPeriodEnd: '2026-06',
      tokenHash: firstRunSampleId(params.tenantId, 'token_payroll'),
      uploadUrl: null,
      expiresAt: '2026-07-10T23:59:59.000+09:00',
      status: 'ready_for_accountant',
      analysisNotes: '첫 가입 급여 샘플 세션입니다.',
      requestKind: 'payroll',
      source: 'staff_direct',
      staffDirectLabel: '2026년 6월 급여 샘플',
      createdAt: params.timestamp,
    },
  ]

  const sourceBatches: Array<typeof sourceBatch.$inferInsert> = [
    {
      id: sourceBatchId,
      tenantId: params.tenantId,
      clientId: params.clientId,
      createdByStaffId: params.staffId,
      sourceKind: 'sample_data',
      accountingPeriod: '2026-06',
      bookkeepingPeriodType: 'monthly',
      bookkeepingPeriodStart: '2026-01',
      bookkeepingPeriodEnd: '2026-06',
      displayLabel: '2026년 부가세 1기 샘플 자료수집',
      legacyUploadSessionId: sessionId,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: payrollSourceBatchId,
      tenantId: params.tenantId,
      clientId: params.clientId,
      createdByStaffId: params.staffId,
      sourceKind: 'sample_data',
      accountingPeriod: '2026-06',
      bookkeepingPeriodType: 'monthly',
      bookkeepingPeriodStart: '2026-06',
      bookkeepingPeriodEnd: '2026-06',
      displayLabel: '2026년 6월 급여 샘플',
      legacyUploadSessionId: payrollSessionId,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  ]

  const validationRows = buildSampleValidationRows(params, sessionId)
  const uploadFiles = buildSampleUploadFiles(params, sessionId, sourceBatchId)
  const validationFileLinks = buildValidationFileLinks(params, validationRows, uploadFiles)
  const bookkeepingRows = buildSampleBookkeepingRows(params, sessionId, runId)
  const payrollLines = buildSamplePayrollLines(params, payrollSummaryId)
  const employeeRows = buildSampleEmployees(params)
  const reminderRules = buildSampleReminderRules(params)

  const classificationRunRows: Array<typeof bookkeepingClassificationRun.$inferInsert> = [{
    id: runId,
    tenantId: params.tenantId,
    uploadSessionId: sessionId,
    status: 'completed',
    sourceFileCount: uploadFiles.length,
    extractedRowCount: 342,
    confirmedRowCount: 324,
    unclassifiedRowCount: 18,
    modelProvider: 'sample',
    modelName: 'first-run-preview',
    appliedCategoryNotes: '승인 Preview 기준 샘플 계정과목 분류입니다.',
    createdByStaffId: params.staffId,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const journalRuns: Array<typeof bookkeepingJournalEntryRun.$inferInsert> = [{
    id: journalRunId,
    tenantId: params.tenantId,
    uploadSessionId: sessionId,
    classificationRunId: runId,
    status: 'completed',
    rowCount: 1,
    unresolvedRowCount: 0,
    appliedRulesSnapshot: '{"source":"first_run_sample"}',
    createdByStaffId: params.staffId,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const vouchers: Array<typeof bookkeepingJournalEntryVoucher.$inferInsert> = [{
    id: voucherId,
    tenantId: params.tenantId,
    journalEntryRunId: journalRunId,
    uploadSessionId: sessionId,
    classificationRowId: firstPendingTxId,
    sourceClassificationRowIds: JSON.stringify([firstPendingTxId]),
    voucherNumber: 'SAMPLE-001',
    entryDate: '2026-06-18',
    requestedPeriod: '2026-06',
    attributedPeriod: '2026-06',
    closePeriod: '2026-06',
    status: 'draft',
    reason: '샘플 분개 미리보기',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const voucherLines: Array<typeof bookkeepingJournalEntryVoucherLine.$inferInsert> = [
    {
      id: firstRunSampleId(params.tenantId, 'journal_voucher_001_debit'),
      tenantId: params.tenantId,
      voucherId,
      lineSequence: 1,
      side: 'debit',
      accountName: '소모품비',
      accountCode: '831',
      amountKrw: 120_000,
      counterparty: '문구 샘플',
      memo: '샘플 거래 차변',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'journal_voucher_001_credit'),
      tenantId: params.tenantId,
      voucherId,
      lineSequence: 2,
      side: 'credit',
      accountName: '보통예금',
      accountCode: '103',
      amountKrw: 120_000,
      counterparty: '문구 샘플',
      memo: '샘플 거래 대변',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  ]

  const vatSummaries: Array<typeof vatPeriodSummary.$inferInsert> = [{
    id: firstRunSampleId(params.tenantId, 'vat_summary_2026h1'),
    tenantId: params.tenantId,
    clientId: params.clientId,
    periodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
    periodStartMonth: '2026-01',
    periodEndMonth: '2026-06',
    filingType: 'final',
    taxableSupplyKrw: 320_000_000,
    taxableOutputTaxKrw: 32_000_000,
    zeroRatedSupplyKrw: 40_000_000,
    exemptSupplyKrw: 15_000_000,
    outputTaxKrw: 32_000_000,
    inputTaxKrw: 18_000_000,
    inputTaxDeductibleKrw: 18_000_000,
    payableTaxKrw: 14_000_000,
    pendingDeductionCount: 3,
    isFinal: false,
    packageStatus: 'locked',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const vatReviews: Array<typeof vatDeductionReview.$inferInsert> = [
    ['proration', '공통매입 안분 필요', '공용 SaaS 구독료', 2_000_000, 200_000, 'proration_required', 'pending', '과세·면세 공통매입 안분율 확인 필요'],
    ['entertainment', '접대비 불공제 후보', '거래처 식대', 1_200_000, 120_000, 'non_deductible_candidate', 'pending', '접대비 성격 여부 확인 필요'],
    ['vehicle', '비영업용 승용차 후보', '차량 유지비', 900_000, 90_000, 'non_deductible_candidate', 'pending', '업무용 승용차 여부 확인 필요'],
    ['confirmed', '공제 확정 매입세액', '사무용 소모품', 3_124_000, 312_400, 'deductible', 'deductible', '전자세금계산서와 거래내역 일치'],
  ].map(([suffix, description, counterparty, supply, inputTax, kind, decision, reason]) => ({
    id: firstRunSampleId(params.tenantId, `vat_review_${suffix}`),
    tenantId: params.tenantId,
    clientId: params.clientId,
    periodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
    description: String(description),
    counterparty: String(counterparty),
    supplyAmountKrw: Number(supply),
    inputTaxKrw: Number(inputTax),
    kind: kind as 'deductible' | 'non_deductible_candidate' | 'proration_required',
    decision: decision as 'pending' | 'deductible' | 'non_deductible' | 'prorated',
    reason: String(reason),
    prorationRateBps: suffix === 'proration' ? 5000 : null,
    confirmedByStaffId: decision === 'deductible' ? params.staffId : null,
    confirmedAt: decision === 'deductible' ? params.timestamp : null,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }))

  const payrollSummaries: Array<typeof payrollPeriodSummary.$inferInsert> = [{
    id: payrollSummaryId,
    tenantId: params.tenantId,
    clientId: params.clientId,
    payrollPeriod: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
    paymentDate: '2026-06-25',
    employeeCount: 12,
    issueCount: 1,
    grossPayKrw: 42_600_000,
    withholdingTaxKrw: 2_100_000,
    socialInsuranceKrw: 3_740_000,
    deductionTotalKrw: 5_840_000,
    netPayKrw: 36_760_000,
    noticeImportStatus: 'partial',
    closeStatus: 'blocked',
    payslipStatus: 'ready',
    withholdingStatementStatus: 'ready',
    insuranceStatementStatus: 'not_generated',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const payrollBatches: Array<typeof payrollExtractionBatch.$inferInsert> = [{
    id: payrollBatchId,
    tenantId: params.tenantId,
    uploadSessionId: payrollSessionId,
    requestEventId: null,
    status: 'needs_review',
    sourceUploadFileIds: '[]',
    model: 'first-run-sample',
    createdByStaffId: params.staffId,
    createdAt: params.timestamp,
    completedAt: params.timestamp,
  }]

  const payrollExtractionRows: Array<typeof payrollExtractionRow.$inferInsert> = [{
    id: firstRunSampleId(params.tenantId, 'payroll_extraction_issue_001'),
    tenantId: params.tenantId,
    batchId: payrollBatchId,
    uploadSessionId: payrollSessionId,
    payrollPeriod: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
    employeeCode: 'E001',
    employeeName: '김대표',
    department: '경영',
    jobTitle: '대표',
    jobType: '정규직',
    baseSalary: 4_000_000,
    bonus: 0,
    mealAllowance: 200_000,
    deductionAmount: 700_000,
    memo: '4대보험 취득일 확인 필요',
    sourceReference: JSON.stringify({ source: 'first_run_sample' }),
    confidence: 'medium',
    aiVerdict: 'fail',
    aiVerdictReason: '신규 입사자 4대보험 취득일이 없어 확인이 필요합니다.',
    reviewStatus: 'needs_review',
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }]

  const filingItems: Array<typeof filingItem.$inferInsert> = [
    {
      id: firstRunSampleId(params.tenantId, 'filing_item_vat'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      filingPeriodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
      payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
      itemType: 'vat',
      sourceModule: 'vat',
      sourceRefId: vatSummaries[0].id,
      title: '부가세 확정 신고 패키지',
      description: '공제 검토 3건 완료 전까지 패키지 생성이 잠겨 있습니다.',
      status: 'locked',
      packageStatus: 'locked',
      lockReason: '공제 검토 3건 완료 후 활성화',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'filing_item_withholding'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      filingPeriodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
      payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
      itemType: 'withholding',
      sourceModule: 'payroll',
      sourceRefId: payrollSummaryId,
      title: '원천세 신고 입력 가이드',
      description: '급여대장 기준 원천세 입력 값이 준비되었습니다.',
      status: 'ready',
      packageStatus: 'ready',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'filing_item_social_insurance'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      filingPeriodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
      payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
      itemType: 'social_insurance',
      sourceModule: 'payroll',
      sourceRefId: payrollSummaryId,
      title: '4대보험 확인',
      description: '고지내역 확인 후 보관하세요.',
      status: 'needs_review',
      packageStatus: 'locked',
      lockReason: '4대보험 고지내역 확인 필요',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  ]

  const checklistItems: Array<typeof filingChecklistItem.$inferInsert> = [
    {
      id: firstRunSampleId(params.tenantId, 'filing_checklist_pay_vat'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      filingPeriodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
      filingItemId: filingItems[0].id,
      code: 'pay_vat_tax',
      label: '부가세 납부 확인',
      description: '홈택스에서 회사가 직접 납부한 뒤 확인합니다.',
      sortOrder: 10,
      completed: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'filing_checklist_store_receipt'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      filingPeriodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
      filingItemId: null,
      code: 'store_receipts',
      label: '접수증 보관',
      description: '제출 후 접수증을 업로드해 보관합니다.',
      sortOrder: 20,
      completed: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  ]

  const reminderLogs: Array<typeof internalReminderSendLog.$inferInsert> = [
    {
      id: firstRunSampleId(params.tenantId, 'reminder_log_sent'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      ruleId: reminderRules[0].id,
      domain: 'vat',
      contextKey: `${FIRST_RUN_SAMPLE_PERIOD_KEY}:vat:deadline`,
      recipientType: 'staff',
      recipientRefId: params.staffId,
      recipientLabel: '담당자 본인',
      idempotencyKey: firstRunSampleId(params.tenantId, 'reminder_idempotency_sent'),
      status: 'sent',
      providerMessageId: 'sample-message-id',
      queuedAt: '2026-07-01T09:00:00.000+09:00',
      sentAt: '2026-07-01T09:00:02.000+09:00',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'reminder_log_failed'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      ruleId: reminderRules[1].id,
      domain: 'payroll',
      contextKey: `${FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY}:payroll:daily`,
      recipientType: 'staff',
      recipientRefId: params.staffId,
      recipientLabel: '담당자 본인',
      idempotencyKey: firstRunSampleId(params.tenantId, 'reminder_idempotency_failed'),
      status: 'failed',
      errorMessage: '샘플 실패 로그입니다. 실제 발송 오류가 아닙니다.',
      queuedAt: '2026-07-01T09:05:00.000+09:00',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    {
      id: firstRunSampleId(params.tenantId, 'reminder_log_skipped'),
      tenantId: params.tenantId,
      clientId: params.clientId,
      ruleId: reminderRules[3].id,
      domain: 'filing_support',
      contextKey: `${FIRST_RUN_SAMPLE_PERIOD_KEY}:disabled`,
      recipientType: 'staff',
      recipientRefId: params.staffId,
      recipientLabel: '수신 제외',
      idempotencyKey: firstRunSampleId(params.tenantId, 'reminder_idempotency_skipped'),
      status: 'skipped',
      queuedAt: '2026-07-01T09:10:00.000+09:00',
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  ]

  const groups = [
    ['upload_session', uploadSessions, 600],
    ['source_batch', sourceBatches, 650],
    ['upload_file', uploadFiles, 700],
    ['request_item_validation', validationRows, 650],
    ['request_item_validation_file', validationFileLinks, 950],
    ['bookkeeping_classification_run', classificationRunRows, 800],
    ['bookkeeping_transaction_classification', bookkeepingRows, 810],
    ['bookkeeping_journal_entry_run', journalRuns, 820],
    ['bookkeeping_journal_entry_voucher', vouchers, 830],
    ['bookkeeping_journal_entry_voucher_line', voucherLines, 840],
    ['vat_period_summary', vatSummaries, 500],
    ['vat_deduction_review', vatReviews, 850],
    ['payroll_period_summary', payrollSummaries, 500],
    ['payroll_employee_line', payrollLines, 850],
    ['payroll_extraction_batch', payrollBatches, 770],
    ['payroll_extraction_row', payrollExtractionRows, 780],
    ['filing_item', filingItems, 500],
    ['filing_checklist_item', checklistItems, 900],
    ['employee_profile', employeeRows, 400],
    ['internal_reminder_rule', reminderRules, 400],
    ['internal_reminder_send_log', reminderLogs, 900],
  ] as const

  for (const [tableName, rows, deleteOrder] of groups) {
    for (const row of rows) addRef(refs, tableName, row.id, deleteOrder)
  }

  return {
    clientRow,
    uploadSessions,
    sourceBatches,
    uploadFiles,
    validationRows,
    validationFileLinks,
    classificationRunRows,
    bookkeepingRows,
    journalRuns,
    vouchers,
    voucherLines,
    vatSummaries,
    vatReviews,
    payrollSummaries,
    payrollLines,
    payrollBatches,
    payrollExtractionRows,
    filingItems,
    checklistItems,
    employeeRows,
    reminderRules,
    reminderLogs,
    refs,
  }
}

async function findFirstStaff(tenantId: string, userId: string) {
  const [ownStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, userId), eq(staff.active, true)))
    .limit(1)
  if (ownStaff) return ownStaff

  const [fallbackStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.active, true)))
    .orderBy(asc(staff.createdAt))
    .limit(1)
  return fallbackStaff ?? null
}

export async function ensureFirstRunSampleDataset({
  tenantId,
  userId,
  source = 'first_run_onboarding',
}: {
  tenantId: string
  userId: string
  source?: FirstRunSampleSource
}): Promise<FirstRunSampleSeedResult> {
  const existingDatasets = await db
    .select({
      id: sampleDataset.id,
      clientId: sampleDataset.clientId,
      status: sampleDataset.status,
      errorMessage: sampleDataset.errorMessage,
      createdAt: sampleDataset.createdAt,
    })
    .from(sampleDataset)
    .where(eq(sampleDataset.tenantId, tenantId))
    .orderBy(asc(sampleDataset.createdAt), asc(sampleDataset.id))

  const existingResult = resolveExistingFirstRunSampleDataset(existingDatasets, source)
  if (existingResult) return existingResult

  const failed = existingDatasets.find((dataset) => dataset.status === 'failed')

  const staffRecord = await findFirstStaff(tenantId, userId)
  if (!staffRecord) {
    return { datasetId: null, clientId: null, status: 'failed', created: false, errorMessage: '담당자 정보를 찾을 수 없습니다.' }
  }

  const [businessEntity] = await db
    .select({ id: client.id })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)

  const createdClient = !businessEntity
  const clientId = businessEntity?.id ?? firstRunSampleId(tenantId, 'client')
  const datasetId = failed?.id ?? firstRunSampleId(tenantId, 'dataset')
  const [tenantRow] = createdClient
    ? await db.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, tenantId)).limit(1)
    : []
  const timestamp = toDBString(now())
  const plan = buildFirstRunSampleSeedPlan({
    tenantId,
    clientId,
    staffId: staffRecord.id,
    userId,
    datasetId,
    timestamp,
    createdClient,
    businessEntityName: tenantRow?.name ?? null,
  })

  try {
    await db.transaction(async (tx) => {
      if (plan.clientRow) await tx.insert(client).values(plan.clientRow)

      if (failed) {
        await tx
          .update(sampleDataset)
          .set({
            clientId,
            source,
            status: 'creating',
            seedVersion: FIRST_RUN_SAMPLE_SEED_VERSION,
            periodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
            payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
            createdByUserId: userId,
            createdByStaffId: staffRecord.id,
            errorMessage: null,
            updatedAt: timestamp,
            deletedAt: null,
          })
          .where(and(eq(sampleDataset.id, datasetId), eq(sampleDataset.tenantId, tenantId)))
      } else {
        await tx.insert(sampleDataset).values({
          id: datasetId,
          tenantId,
          clientId,
          source,
          status: 'creating',
          seedVersion: FIRST_RUN_SAMPLE_SEED_VERSION,
          periodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
          payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
          createdByUserId: userId,
          createdByStaffId: staffRecord.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }

      await tx.insert(uploadSession).values(plan.uploadSessions)
      await tx.insert(sourceBatch).values(plan.sourceBatches)
      await tx.insert(uploadFile).values(plan.uploadFiles)
      await tx.insert(requestItemValidation).values(plan.validationRows)
      await tx.insert(requestItemValidationFile).values(plan.validationFileLinks)
      await tx.insert(bookkeepingClassificationRun).values(plan.classificationRunRows)
      await tx.insert(bookkeepingTransactionClassification).values(plan.bookkeepingRows)
      await tx.insert(bookkeepingJournalEntryRun).values(plan.journalRuns)
      await tx.insert(bookkeepingJournalEntryVoucher).values(plan.vouchers)
      await tx.insert(bookkeepingJournalEntryVoucherLine).values(plan.voucherLines)
      await tx.insert(vatPeriodSummary).values(plan.vatSummaries)
      await tx.insert(vatDeductionReview).values(plan.vatReviews)
      await tx.insert(payrollPeriodSummary).values(plan.payrollSummaries)
      await tx.insert(payrollEmployeeLine).values(plan.payrollLines)
      await tx.insert(payrollExtractionBatch).values(plan.payrollBatches)
      await tx.insert(payrollExtractionRow).values(plan.payrollExtractionRows)
      await tx.insert(filingItem).values(plan.filingItems)
      await tx.insert(filingChecklistItem).values(plan.checklistItems)
      await tx.insert(employeeProfile).values(plan.employeeRows)
      await tx.insert(internalReminderRule).values(plan.reminderRules)
      await tx.insert(internalReminderSendLog).values(plan.reminderLogs)
      await tx.insert(sampleEntityRef).values(plan.refs.map((ref) => ({
        id: firstRunSampleId(tenantId, `ref_${ref.entityTable}_${ref.entityId}`),
        tenantId,
        clientId,
        sampleDatasetId: datasetId,
        entityTable: ref.entityTable,
        entityId: ref.entityId,
        deleteOrder: ref.deleteOrder,
        createdAt: timestamp,
      })))

      await tx
        .update(sampleDataset)
        .set({ status: 'active', updatedAt: timestamp, errorMessage: null })
        .where(and(eq(sampleDataset.id, datasetId), eq(sampleDataset.tenantId, tenantId)))
    })

    return { datasetId, clientId, status: 'active', created: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '샘플 데이터 생성 중 오류가 발생했습니다.'
    try {
      await db.insert(sampleDataset).values({
        id: datasetId,
        tenantId,
        clientId,
        source,
        status: 'failed',
        seedVersion: FIRST_RUN_SAMPLE_SEED_VERSION,
        periodKey: FIRST_RUN_SAMPLE_PERIOD_KEY,
        payrollPeriodKey: FIRST_RUN_SAMPLE_PAYROLL_PERIOD_KEY,
        createdByUserId: userId,
        createdByStaffId: staffRecord.id,
        errorMessage: message,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).onConflictDoNothing()
      await db
        .update(sampleDataset)
        .set({ status: 'failed', errorMessage: message, updatedAt: timestamp })
        .where(and(eq(sampleDataset.id, datasetId), eq(sampleDataset.tenantId, tenantId)))
    } catch (recordError) {
      console.error('[first-run-sample] failed to persist seed error', recordError)
    }
    console.error('[first-run-sample] seed failed', err)
    return { datasetId, clientId, status: 'failed', created: false, errorMessage: message }
  }
}

export function summarizeSeedPlanForTests(plan: ReturnType<typeof buildFirstRunSampleSeedPlan>) {
  const validationRows = plan.validationRows
  const bookkeepingRows = plan.bookkeepingRows
  const payrollLines = plan.payrollLines
  return {
    material: {
      total: validationRows.length,
      missing: validationRows.filter((row) => row.validationStatus === 'missing').length,
      uncertain: validationRows.filter((row) => row.validationStatus === 'uncertain').length,
    },
    bookkeeping: {
      total: bookkeepingRows.length,
      confirmed: bookkeepingRows.filter((row) => row.status === 'confirmed').length,
      pending: bookkeepingRows.filter((row) => row.status !== 'confirmed' && row.status !== 'excluded').length,
      lowConfidence: bookkeepingRows.filter((row) => row.recommendationConfidence === 'low' && row.status !== 'confirmed').length,
    },
    vat: {
      outputTaxKrw: plan.vatSummaries[0]?.outputTaxKrw ?? 0,
      inputTaxDeductibleKrw: plan.vatSummaries[0]?.inputTaxDeductibleKrw ?? 0,
      payableTaxKrw: plan.vatSummaries[0]?.payableTaxKrw ?? 0,
      pendingDeductionCount: plan.vatReviews.filter((row) => row.decision === 'pending').length,
    },
    payroll: {
      employeeCount: payrollLines.length,
      grossPayKrw: payrollLines.reduce((sum, row) => sum + (row.grossPayKrw ?? 0), 0),
      deductionTotalKrw: payrollLines.reduce((sum, row) => sum + (row.deductionTotalKrw ?? 0), 0),
      netPayKrw: payrollLines.reduce((sum, row) => sum + (row.netPayKrw ?? 0), 0),
      issueCount: payrollLines.filter((row) => row.status === 'needs_review').length,
    },
    employees: {
      total: plan.employeeRows.length,
      active: plan.employeeRows.filter((row) => row.employeeStatus === 'active').length,
      terminated: plan.employeeRows.filter((row) => row.employeeStatus === 'terminated').length,
      payrollEligible: plan.employeeRows.filter((row) => row.employeeStatus !== 'terminated' && row.payrollEligibility === 'eligible').length,
      insuranceNeedsReview: plan.employeeRows.filter((row) => row.employeeStatus !== 'terminated' && row.insuranceEnrollmentStatus === 'needs_review').length,
    },
    refs: plan.refs.length,
    storageKeys: plan.uploadFiles.map((row) => row.storageKey),
  }
}

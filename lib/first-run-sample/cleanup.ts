import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingJournalEntryRun,
  bookkeepingJournalEntryVoucher,
  bookkeepingJournalEntryVoucherLine,
  bookkeepingTransactionClassification,
  employeeProfile,
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
  tenantBillingProfile,
  uploadFile,
  uploadSession,
  vatDeductionReview,
  vatPeriodSummary,
  vatTaxTreatmentEvidenceAttestation,
  vatTaxTreatmentReview,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

export const FIRST_RUN_SAMPLE_DELETE_TABLES = [
  'request_item_validation_file',
  'filing_checklist_item',
  'internal_reminder_send_log',
  'payroll_employee_line',
  'vat_deduction_review',
  'bookkeeping_journal_entry_voucher_line',
  'bookkeeping_journal_entry_voucher',
  'bookkeeping_journal_entry_run',
  'bookkeeping_transaction_classification',
  'bookkeeping_classification_run',
  'payroll_extraction_row',
  'payroll_extraction_batch',
  'upload_file',
  'request_item_validation',
  'source_batch',
  'upload_session',
  'filing_item',
  'vat_period_summary',
  'payroll_period_summary',
  'employee_profile',
  'internal_reminder_rule',
  'tenant_billing_profile',
] as const

export type FirstRunSampleDeleteTable = (typeof FIRST_RUN_SAMPLE_DELETE_TABLES)[number]

type DeleteResult = {
  datasetId: string | null
  deleted: boolean
  deletedRowCount: number
  skippedUnknownTableCount: number
}

function isAllowedDeleteTable(value: string): value is FirstRunSampleDeleteTable {
  return FIRST_RUN_SAMPLE_DELETE_TABLES.includes(value as FirstRunSampleDeleteTable)
}

async function deleteWhitelistedRows(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  entityTable: string,
  entityIds: string[],
) {
  if (!isAllowedDeleteTable(entityTable)) return null

  switch (entityTable) {
    case 'request_item_validation_file':
      return (await tx.delete(requestItemValidationFile).where(and(eq(requestItemValidationFile.tenantId, tenantId), inArray(requestItemValidationFile.id, entityIds)))).rowsAffected
    case 'filing_checklist_item':
      return (await tx.delete(filingChecklistItem).where(and(eq(filingChecklistItem.tenantId, tenantId), inArray(filingChecklistItem.id, entityIds)))).rowsAffected
    case 'internal_reminder_send_log':
      return (await tx.delete(internalReminderSendLog).where(and(eq(internalReminderSendLog.tenantId, tenantId), inArray(internalReminderSendLog.id, entityIds)))).rowsAffected
    case 'payroll_employee_line':
      return (await tx.delete(payrollEmployeeLine).where(and(eq(payrollEmployeeLine.tenantId, tenantId), inArray(payrollEmployeeLine.id, entityIds)))).rowsAffected
    case 'vat_deduction_review':
      return (await tx.delete(vatDeductionReview).where(and(eq(vatDeductionReview.tenantId, tenantId), inArray(vatDeductionReview.id, entityIds)))).rowsAffected
    case 'bookkeeping_journal_entry_voucher_line':
      return (await tx.delete(bookkeepingJournalEntryVoucherLine).where(and(eq(bookkeepingJournalEntryVoucherLine.tenantId, tenantId), inArray(bookkeepingJournalEntryVoucherLine.id, entityIds)))).rowsAffected
    case 'bookkeeping_journal_entry_voucher':
      return (await tx.delete(bookkeepingJournalEntryVoucher).where(and(eq(bookkeepingJournalEntryVoucher.tenantId, tenantId), inArray(bookkeepingJournalEntryVoucher.id, entityIds)))).rowsAffected
    case 'bookkeeping_journal_entry_run':
      return (await tx.delete(bookkeepingJournalEntryRun).where(and(eq(bookkeepingJournalEntryRun.tenantId, tenantId), inArray(bookkeepingJournalEntryRun.id, entityIds)))).rowsAffected
    case 'bookkeeping_transaction_classification':
      return (await tx.delete(bookkeepingTransactionClassification).where(and(eq(bookkeepingTransactionClassification.tenantId, tenantId), inArray(bookkeepingTransactionClassification.id, entityIds)))).rowsAffected
    case 'bookkeeping_classification_run':
      return (await tx.delete(bookkeepingClassificationRun).where(and(eq(bookkeepingClassificationRun.tenantId, tenantId), inArray(bookkeepingClassificationRun.id, entityIds)))).rowsAffected
    case 'payroll_extraction_row':
      return (await tx.delete(payrollExtractionRow).where(and(eq(payrollExtractionRow.tenantId, tenantId), inArray(payrollExtractionRow.id, entityIds)))).rowsAffected
    case 'payroll_extraction_batch':
      return (await tx.delete(payrollExtractionBatch).where(and(eq(payrollExtractionBatch.tenantId, tenantId), inArray(payrollExtractionBatch.id, entityIds)))).rowsAffected
    case 'upload_file':
      return (await tx.delete(uploadFile).where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.id, entityIds)))).rowsAffected
    case 'request_item_validation':
      return (await tx.delete(requestItemValidation).where(and(eq(requestItemValidation.tenantId, tenantId), inArray(requestItemValidation.id, entityIds)))).rowsAffected
    case 'source_batch':
      return (await tx.delete(sourceBatch).where(and(eq(sourceBatch.tenantId, tenantId), inArray(sourceBatch.id, entityIds)))).rowsAffected
    case 'upload_session':
      return (await tx.delete(uploadSession).where(and(eq(uploadSession.tenantId, tenantId), inArray(uploadSession.id, entityIds)))).rowsAffected
    case 'filing_item':
      return (await tx.delete(filingItem).where(and(eq(filingItem.tenantId, tenantId), inArray(filingItem.id, entityIds)))).rowsAffected
    case 'vat_period_summary':
      return (await tx.delete(vatPeriodSummary).where(and(eq(vatPeriodSummary.tenantId, tenantId), inArray(vatPeriodSummary.id, entityIds)))).rowsAffected
    case 'payroll_period_summary':
      return (await tx.delete(payrollPeriodSummary).where(and(eq(payrollPeriodSummary.tenantId, tenantId), inArray(payrollPeriodSummary.id, entityIds)))).rowsAffected
    case 'employee_profile':
      return (await tx.delete(employeeProfile).where(and(eq(employeeProfile.tenantId, tenantId), inArray(employeeProfile.id, entityIds)))).rowsAffected
    case 'internal_reminder_rule':
      return (await tx.delete(internalReminderRule).where(and(eq(internalReminderRule.tenantId, tenantId), inArray(internalReminderRule.id, entityIds)))).rowsAffected
    case 'tenant_billing_profile':
      return (await tx.delete(tenantBillingProfile).where(and(eq(tenantBillingProfile.tenantId, tenantId), inArray(tenantBillingProfile.id, entityIds)))).rowsAffected
    default:
      return null
  }
}

export async function deleteFirstRunSampleDataset({ tenantId }: { tenantId: string }): Promise<DeleteResult> {
  const [activeDataset] = await db
    .select({ id: sampleDataset.id, clientId: sampleDataset.clientId, status: sampleDataset.status })
    .from(sampleDataset)
    .where(and(eq(sampleDataset.tenantId, tenantId), eq(sampleDataset.status, 'active')))
    .orderBy(desc(sampleDataset.updatedAt), desc(sampleDataset.id))
    .limit(1)

  if (!activeDataset) {
    const [deletedDataset] = await db
      .select({ id: sampleDataset.id })
      .from(sampleDataset)
      .where(and(eq(sampleDataset.tenantId, tenantId), eq(sampleDataset.status, 'deleted')))
      .orderBy(desc(sampleDataset.updatedAt), desc(sampleDataset.id))
      .limit(1)
    return { datasetId: deletedDataset?.id ?? null, deleted: false, deletedRowCount: 0, skippedUnknownTableCount: 0 }
  }

  const timestamp = toDBString(now())

  await db
    .update(sampleDataset)
    .set({ status: 'deleted', updatedAt: timestamp, deletedAt: timestamp })
    .where(and(eq(sampleDataset.id, activeDataset.id), eq(sampleDataset.tenantId, tenantId)))

  return { datasetId: activeDataset.id, deleted: true, deletedRowCount: 0, skippedUnknownTableCount: 0 }
}

export async function purgeFirstRunSampleDataset({ tenantId, datasetId }: { tenantId: string; datasetId: string }): Promise<DeleteResult> {
  const [deletedDataset] = await db
    .select({ id: sampleDataset.id, clientId: sampleDataset.clientId })
    .from(sampleDataset)
    .where(and(
      eq(sampleDataset.id, datasetId),
      eq(sampleDataset.tenantId, tenantId),
      eq(sampleDataset.status, 'deleted'),
    ))
    .limit(1)

  if (!deletedDataset) {
    return { datasetId, deleted: false, deletedRowCount: 0, skippedUnknownTableCount: 0 }
  }

  let deletedRowCount = 0
  let skippedUnknownTableCount = 0

  await db.transaction(async (tx) => {
    const refs = await tx
      .select({ entityTable: sampleEntityRef.entityTable, entityId: sampleEntityRef.entityId })
      .from(sampleEntityRef)
      .where(and(
        eq(sampleEntityRef.tenantId, tenantId),
        eq(sampleEntityRef.clientId, deletedDataset.clientId),
        eq(sampleEntityRef.sampleDatasetId, deletedDataset.id),
      ))
      .orderBy(desc(sampleEntityRef.deleteOrder), desc(sampleEntityRef.createdAt), desc(sampleEntityRef.id))

    const sampleClassificationRowIds = refs
      .filter((ref) => ref.entityTable === 'bookkeeping_transaction_classification')
      .map((ref) => ref.entityId)
    if (sampleClassificationRowIds.length > 0) {
      const deductionResult = await tx
        .delete(vatDeductionReview)
        .where(and(
          eq(vatDeductionReview.tenantId, tenantId),
          eq(vatDeductionReview.clientId, deletedDataset.clientId),
          inArray(vatDeductionReview.classificationRowId, sampleClassificationRowIds),
        ))
      deletedRowCount += deductionResult.rowsAffected

      const evidenceResult = await tx
        .delete(vatTaxTreatmentEvidenceAttestation)
        .where(and(
          eq(vatTaxTreatmentEvidenceAttestation.tenantId, tenantId),
          eq(vatTaxTreatmentEvidenceAttestation.clientId, deletedDataset.clientId),
          inArray(vatTaxTreatmentEvidenceAttestation.classificationRowId, sampleClassificationRowIds),
        ))
      deletedRowCount += evidenceResult.rowsAffected

      const result = await tx
        .delete(vatTaxTreatmentReview)
        .where(and(
          eq(vatTaxTreatmentReview.tenantId, tenantId),
          eq(vatTaxTreatmentReview.clientId, deletedDataset.clientId),
          inArray(vatTaxTreatmentReview.classificationRowId, sampleClassificationRowIds),
        ))
      deletedRowCount += result.rowsAffected
    }

    const refsByTable = new Map<string, string[]>()
    for (const ref of refs) {
      const entityIds = refsByTable.get(ref.entityTable) ?? []
      entityIds.push(ref.entityId)
      refsByTable.set(ref.entityTable, entityIds)
    }

    for (const [entityTable, entityIds] of refsByTable) {
      if (entityTable === 'vat_deduction_review') continue

      // source_batch는 seed registry에 없을 수 있지만, sample upload_session을
      // 기준으로 런타임에 함께 만들어진다. upload_session을 지우기 전에 반드시
      // 제거해야 외래키로 인해 실제 삭제가 중단되지 않는다.
      if (entityTable === 'upload_session') {
        const sourceBatchResult = await tx
          .delete(sourceBatch)
          .where(and(
            eq(sourceBatch.tenantId, tenantId),
            eq(sourceBatch.clientId, deletedDataset.clientId),
            inArray(sourceBatch.legacyUploadSessionId, entityIds),
          ))
        deletedRowCount += sourceBatchResult.rowsAffected
      }

      const deletedRowCountForTable = await deleteWhitelistedRows(tx, tenantId, entityTable, entityIds)
      if (deletedRowCountForTable === null) skippedUnknownTableCount += entityIds.length
      else deletedRowCount += deletedRowCountForTable
    }

    if (skippedUnknownTableCount > 0) {
      throw new Error(`Unknown sample cleanup table: ${skippedUnknownTableCount} registry rows skipped`)
    }

    // 전체 물리 삭제가 성공한 경우에만 registry를 제거한다. 실패하면 registry를
    // 남겨 다음 요청에서 같은 삭제 작업을 안전하게 재시도할 수 있다.
    await tx
      .delete(sampleEntityRef)
      .where(and(
        eq(sampleEntityRef.tenantId, tenantId),
        eq(sampleEntityRef.clientId, deletedDataset.clientId),
        eq(sampleEntityRef.sampleDatasetId, deletedDataset.id),
      ))

  })

  return { datasetId: deletedDataset.id, deleted: true, deletedRowCount, skippedUnknownTableCount }
}

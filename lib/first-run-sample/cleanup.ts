import { and, desc, eq } from 'drizzle-orm'
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
  uploadFile,
  uploadSession,
  vatDeductionReview,
  vatPeriodSummary,
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
] as const

export type FirstRunSampleDeleteTable = (typeof FIRST_RUN_SAMPLE_DELETE_TABLES)[number]

type DeleteRef = {
  entityTable: string
  entityId: string
}

type DeleteResult = {
  datasetId: string | null
  deleted: boolean
  deletedRowCount: number
  skippedUnknownTableCount: number
}

function isAllowedDeleteTable(value: string): value is FirstRunSampleDeleteTable {
  return FIRST_RUN_SAMPLE_DELETE_TABLES.includes(value as FirstRunSampleDeleteTable)
}

async function deleteWhitelistedRow(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], tenantId: string, ref: DeleteRef) {
  if (!isAllowedDeleteTable(ref.entityTable)) return false

  switch (ref.entityTable) {
    case 'request_item_validation_file':
      await tx.delete(requestItemValidationFile).where(and(eq(requestItemValidationFile.tenantId, tenantId), eq(requestItemValidationFile.id, ref.entityId)))
      return true
    case 'filing_checklist_item':
      await tx.delete(filingChecklistItem).where(and(eq(filingChecklistItem.tenantId, tenantId), eq(filingChecklistItem.id, ref.entityId)))
      return true
    case 'internal_reminder_send_log':
      await tx.delete(internalReminderSendLog).where(and(eq(internalReminderSendLog.tenantId, tenantId), eq(internalReminderSendLog.id, ref.entityId)))
      return true
    case 'payroll_employee_line':
      await tx.delete(payrollEmployeeLine).where(and(eq(payrollEmployeeLine.tenantId, tenantId), eq(payrollEmployeeLine.id, ref.entityId)))
      return true
    case 'vat_deduction_review':
      await tx.delete(vatDeductionReview).where(and(eq(vatDeductionReview.tenantId, tenantId), eq(vatDeductionReview.id, ref.entityId)))
      return true
    case 'bookkeeping_journal_entry_voucher_line':
      await tx.delete(bookkeepingJournalEntryVoucherLine).where(and(eq(bookkeepingJournalEntryVoucherLine.tenantId, tenantId), eq(bookkeepingJournalEntryVoucherLine.id, ref.entityId)))
      return true
    case 'bookkeeping_journal_entry_voucher':
      await tx.delete(bookkeepingJournalEntryVoucher).where(and(eq(bookkeepingJournalEntryVoucher.tenantId, tenantId), eq(bookkeepingJournalEntryVoucher.id, ref.entityId)))
      return true
    case 'bookkeeping_journal_entry_run':
      await tx.delete(bookkeepingJournalEntryRun).where(and(eq(bookkeepingJournalEntryRun.tenantId, tenantId), eq(bookkeepingJournalEntryRun.id, ref.entityId)))
      return true
    case 'bookkeeping_transaction_classification':
      await tx.delete(bookkeepingTransactionClassification).where(and(eq(bookkeepingTransactionClassification.tenantId, tenantId), eq(bookkeepingTransactionClassification.id, ref.entityId)))
      return true
    case 'bookkeeping_classification_run':
      await tx.delete(bookkeepingClassificationRun).where(and(eq(bookkeepingClassificationRun.tenantId, tenantId), eq(bookkeepingClassificationRun.id, ref.entityId)))
      return true
    case 'payroll_extraction_row':
      await tx.delete(payrollExtractionRow).where(and(eq(payrollExtractionRow.tenantId, tenantId), eq(payrollExtractionRow.id, ref.entityId)))
      return true
    case 'payroll_extraction_batch':
      await tx.delete(payrollExtractionBatch).where(and(eq(payrollExtractionBatch.tenantId, tenantId), eq(payrollExtractionBatch.id, ref.entityId)))
      return true
    case 'upload_file':
      await tx.delete(uploadFile).where(and(eq(uploadFile.tenantId, tenantId), eq(uploadFile.id, ref.entityId)))
      return true
    case 'request_item_validation':
      await tx.delete(requestItemValidation).where(and(eq(requestItemValidation.tenantId, tenantId), eq(requestItemValidation.id, ref.entityId)))
      return true
    case 'source_batch':
      await tx.delete(sourceBatch).where(and(eq(sourceBatch.tenantId, tenantId), eq(sourceBatch.id, ref.entityId)))
      return true
    case 'upload_session':
      await tx.delete(uploadSession).where(and(eq(uploadSession.tenantId, tenantId), eq(uploadSession.id, ref.entityId)))
      return true
    case 'filing_item':
      await tx.delete(filingItem).where(and(eq(filingItem.tenantId, tenantId), eq(filingItem.id, ref.entityId)))
      return true
    case 'vat_period_summary':
      await tx.delete(vatPeriodSummary).where(and(eq(vatPeriodSummary.tenantId, tenantId), eq(vatPeriodSummary.id, ref.entityId)))
      return true
    case 'payroll_period_summary':
      await tx.delete(payrollPeriodSummary).where(and(eq(payrollPeriodSummary.tenantId, tenantId), eq(payrollPeriodSummary.id, ref.entityId)))
      return true
    case 'employee_profile':
      await tx.delete(employeeProfile).where(and(eq(employeeProfile.tenantId, tenantId), eq(employeeProfile.id, ref.entityId)))
      return true
    case 'internal_reminder_rule':
      await tx.delete(internalReminderRule).where(and(eq(internalReminderRule.tenantId, tenantId), eq(internalReminderRule.id, ref.entityId)))
      return true
    default:
      return false
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
  let deletedRowCount = 0
  let skippedUnknownTableCount = 0

  await db.transaction(async (tx) => {
    await tx
      .update(sampleDataset)
      .set({ status: 'delete_pending', updatedAt: timestamp })
      .where(and(eq(sampleDataset.id, activeDataset.id), eq(sampleDataset.tenantId, tenantId)))

    const refs = await tx
      .select({ entityTable: sampleEntityRef.entityTable, entityId: sampleEntityRef.entityId })
      .from(sampleEntityRef)
      .where(and(
        eq(sampleEntityRef.tenantId, tenantId),
        eq(sampleEntityRef.clientId, activeDataset.clientId),
        eq(sampleEntityRef.sampleDatasetId, activeDataset.id),
      ))
      .orderBy(desc(sampleEntityRef.deleteOrder), desc(sampleEntityRef.createdAt), desc(sampleEntityRef.id))

    for (const ref of refs) {
      const deleted = await deleteWhitelistedRow(tx, tenantId, ref)
      if (deleted) deletedRowCount += 1
      else skippedUnknownTableCount += 1
    }

    await tx
      .update(sampleDataset)
      .set({ status: 'deleted', updatedAt: timestamp, deletedAt: timestamp })
      .where(and(eq(sampleDataset.id, activeDataset.id), eq(sampleDataset.tenantId, tenantId)))
  })

  return { datasetId: activeDataset.id, deleted: true, deletedRowCount, skippedUnknownTableCount }
}

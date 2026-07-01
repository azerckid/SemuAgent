import { fromISO, now, type DateTime } from '@/lib/time'

export const PAYROLL_RUNNING_BATCH_STALE_MINUTES = 10

export type PayrollExtractionBatchStatus =
  | 'pending'
  | 'running'
  | 'needs_review'
  | 'completed'
  | 'failed'

type PayrollBatchStatusInput = {
  status: string | null | undefined
  createdAt: string | null | undefined
}

export function isPayrollExtractionFinalStatus(status: string | null | undefined): boolean {
  return Boolean(status && status !== 'pending' && status !== 'running')
}

export function isPayrollRunningBatchStale(
  batch: PayrollBatchStatusInput | null | undefined,
  referenceTime: DateTime = now(),
): boolean {
  if (batch?.status !== 'running') return false

  const createdAt = batch.createdAt ? fromISO(batch.createdAt) : null
  if (!createdAt?.isValid) return false

  return referenceTime.diff(createdAt, 'minutes').minutes >= PAYROLL_RUNNING_BATCH_STALE_MINUTES
}

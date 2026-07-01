import { fromISO, now, type DateTime } from '@/lib/time'

export const CLASSIFICATION_RUNNING_STALE_MINUTES = 30

type ClassificationRunStatusInput = {
  status: string | null | undefined
  updatedAt: string | null | undefined
  createdAt: string | null | undefined
}

export function isClassificationRunningRunStale(
  run: ClassificationRunStatusInput | null | undefined,
  referenceTime: DateTime = now(),
): boolean {
  if (run?.status !== 'running') return false

  const heartbeatAt = run.updatedAt ? fromISO(run.updatedAt) : fromISO(run.createdAt ?? '')
  if (!heartbeatAt?.isValid) return false

  return referenceTime.diff(heartbeatAt, 'minutes').minutes >= CLASSIFICATION_RUNNING_STALE_MINUTES
}

export function isFreshClassificationRunningRun(
  run: ClassificationRunStatusInput | null | undefined,
  referenceTime: DateTime = now(),
): boolean {
  return run?.status === 'running' && !isClassificationRunningRunStale(run, referenceTime)
}

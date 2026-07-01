import { formatRequestItemName } from '@/lib/reviews/review-submission-status'

export function normalizeMissingTargetName(name: string): string {
  return formatRequestItemName(name)
}

export function selectUndeclaredMissingTargets<T extends { itemName: string }>(
  missingTargets: T[],
  declaredItemNames: Iterable<string>,
): T[] {
  const declared = new Set(
    [...declaredItemNames].map((name) => normalizeMissingTargetName(name)),
  )

  return missingTargets.filter(
    (target) => !declared.has(normalizeMissingTargetName(target.itemName)),
  )
}

export function selectGenuineMissingTargets<T extends { id: string; itemName: string }>(
  missingTargets: T[],
  submittedValidationIds: ReadonlySet<string>,
  declaredItemNames: Iterable<string>,
): T[] {
  return selectUndeclaredMissingTargets(
    missingTargets.filter((target) => !submittedValidationIds.has(target.id)),
    declaredItemNames,
  )
}

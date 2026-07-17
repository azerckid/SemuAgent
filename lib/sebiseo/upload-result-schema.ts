import { z } from 'zod'
import {
  formatSebiseoPeriodLabel,
  resolveSebiseoPeriodKeyFromAccountingPeriod,
} from '@/lib/sebiseo/period-options'

export const sebiseoUploadResultCardSchema = z.object({
  sessionId: z.string().min(1),
  periodKey: z.string().min(1),
  periodLabel: z.string().min(1),
  totalCount: z.number().int().nonnegative(),
  okCount: z.number().int().nonnegative(),
  needsReviewCount: z.number().int().nonnegative(),
  inProgressCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  excludedCount: z.number().int().nonnegative(),
  ctaHref: z.string().startsWith('/dashboard/direct-upload'),
  ctaLabel: z.string().min(1),
})

export type SebiseoUploadResultCard = z.infer<typeof sebiseoUploadResultCardSchema>

export type SebiseoUploadResultCardOrNull = SebiseoUploadResultCard | null

type FileStatusCountInput = {
  readonly status: string
}

/** Pure status bucketing for unit tests and read model. */
export function countSebiseoUploadFileStatuses(files: readonly FileStatusCountInput[]) {
  let okCount = 0
  let needsReviewCount = 0
  let inProgressCount = 0
  let failedCount = 0
  let excludedCount = 0

  for (const file of files) {
    switch (file.status) {
      case 'matched':
        okCount += 1
        break
      case 'needs_review':
        needsReviewCount += 1
        break
      case 'uploaded':
      case 'analyzing':
        inProgressCount += 1
        break
      case 'failed':
        failedCount += 1
        break
      case 'rejected':
        excludedCount += 1
        break
      default:
        break
    }
  }

  const totalCount = okCount + needsReviewCount + inProgressCount + failedCount + excludedCount
  return {
    totalCount,
    okCount,
    needsReviewCount,
    inProgressCount,
    failedCount,
    excludedCount,
  }
}

export function buildSebiseoUploadResultCtaLabel(needsReviewCount: number) {
  if (needsReviewCount > 0) return `확인 필요 ${needsReviewCount}건 보기`
  return '자료수집에서 보기'
}

export function buildSebiseoUploadResultCtaHref(periodKey: string, sessionId: string) {
  const params = new URLSearchParams({
    period: periodKey,
    sessionId,
  })
  return `/dashboard/direct-upload?${params.toString()}`
}

export function buildSebiseoUploadResultCardFromCounts(params: {
  sessionId: string
  accountingPeriod: string
  files: readonly FileStatusCountInput[]
}): SebiseoUploadResultCardOrNull {
  const periodKey = resolveSebiseoPeriodKeyFromAccountingPeriod(params.accountingPeriod)
  if (!periodKey) return null
  const periodLabel = formatSebiseoPeriodLabel(periodKey)
  if (!periodLabel) return null

  const counts = countSebiseoUploadFileStatuses(params.files)
  if (counts.totalCount === 0) return null

  return sebiseoUploadResultCardSchema.parse({
    sessionId: params.sessionId,
    periodKey,
    periodLabel,
    ...counts,
    ctaHref: buildSebiseoUploadResultCtaHref(periodKey, params.sessionId),
    ctaLabel: buildSebiseoUploadResultCtaLabel(counts.needsReviewCount),
  })
}

'use client'

import type { DisplayStatus } from '@/lib/status-tone'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { BookkeepingPeriodAttributionPanel } from './bookkeeping-period-attribution-panel'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function ReviewPeriodAttributionPopup({
  status,
  displayClientName,
  accountingPeriod,
  session,
}: {
  status: DisplayStatus
  displayClientName: string
  accountingPeriod: string
  session: ReviewSession
}) {
  return (
    <StatusModal
      status={status}
      title="귀속기간"
      subtitle={`${displayClientName} · ${accountingPeriod} · 현재 세션 active files 기준`}
      wide
    >
      <BookkeepingPeriodAttributionPanel session={session} />
    </StatusModal>
  )
}

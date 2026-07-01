'use client'

import type { DisplayStatus } from '@/lib/status-tone'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { AccountClassificationEntry } from './account-classification-entry'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function ReviewAccountClassificationPopup({
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
      title="계정항목"
      subtitle={`${displayClientName} · ${accountingPeriod} · fiscal-year ledger 누적 + 이번 세션 반영분 기준`}
    >
      <AccountClassificationEntry session={session} />
    </StatusModal>
  )
}

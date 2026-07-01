'use client'

import type { DisplayStatus } from '@/lib/status-tone'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { JournalEntryEntry } from './journal-entry-entry'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function ReviewJournalEntryPopup({
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
      title="전표분개"
      subtitle={`${displayClientName} · ${accountingPeriod} · fiscal-year ledger 누적 기준`}
    >
      <JournalEntryEntry session={session} />
    </StatusModal>
  )
}

'use client'

import type { DisplayStatus } from '@/lib/status-tone'
import { STATUS_TONE_CLASS } from '@/lib/status-tone'
import { cn } from '@/lib/utils'

export function ReviewDeactivatedLedgerStatusChip({ status }: { status: DisplayStatus }) {
  return (
    <span
      title={status.detail}
      className={cn(
        'inline-flex cursor-not-allowed items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold opacity-70',
        STATUS_TONE_CLASS[status.tone],
      )}
    >
      {status.label}
    </span>
  )
}

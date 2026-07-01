'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { canStaffExcludeUnlinkedFile, isStaffExcludedUnlinkedFile } from '@/lib/reviews/unlinked-file-review'
import type { ReviewFileClassification } from '@/lib/reviews/review-file-classification'
import type { ReviewFile } from '@/lib/reviews/review-workspace-types'

export function UnlinkedFileExcludeControl({
  sessionId,
  file,
  classification,
  compact = false,
}: {
  sessionId: string
  file: ReviewFile
  classification: ReviewFileClassification
  compact?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const excluded = isStaffExcludedUnlinkedFile(file)
  const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null)
  const checked = optimisticChecked ?? excluded
  const canExclude = canStaffExcludeUnlinkedFile(file, classification)

  const submit = (nextChecked: boolean) => {
    setOptimisticChecked(nextChecked)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/files/${file.id}/review`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffReviewStatus: nextChecked ? 'excluded' : 'none',
          }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          setOptimisticChecked(null)
          toast.error(body?.error ?? '검토 제외 상태를 저장하지 못했습니다.')
          return
        }

        setOptimisticChecked(null)
        toast.success(nextChecked ? '검토 제외를 확인했습니다.' : '검토 제외를 해제했습니다.')
        router.refresh()
      } catch {
        setOptimisticChecked(null)
        toast.error('검토 제외 상태를 저장하지 못했습니다.')
      }
    })
  }

  if (!excluded && !canExclude) {
    return (
      <span className="text-[11px] text-muted-foreground" title="분석·비밀번호 처리 후 제외할 수 있습니다.">
        처리 필요
      </span>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium',
        compact ? 'whitespace-nowrap' : 'rounded-md border border-border bg-background px-2 py-1.5',
        checked ? 'text-emerald-800' : 'text-foreground',
        isPending && 'opacity-70',
      )}
    >
      <input
        type="checkbox"
        className="size-4 rounded border-border accent-primary"
        checked={checked}
        disabled={isPending}
        onChange={(event) => submit(event.target.checked)}
      />
      <span>{checked ? '제외 확인됨' : '검토 제외'}</span>
    </label>
  )
}

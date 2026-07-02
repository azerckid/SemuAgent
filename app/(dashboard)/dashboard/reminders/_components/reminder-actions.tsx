'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ReminderRuleToggle({
  ruleId,
  enabled,
}: {
  readonly ruleId: string
  readonly enabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-pressed={enabled}
      disabled={isPending}
      className={cn(
        'relative h-5 w-[34px] rounded-full transition disabled:cursor-wait disabled:opacity-60',
        enabled ? 'bg-[#16a34a]' : 'bg-company-border-strong',
      )}
      title={enabled ? '활성' : '비활성'}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/internal-reminders/rules/${ruleId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: !enabled }),
          })
          const result = await parseReminderMutationResponse(response)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success(enabled ? '리마인드 규칙을 비활성화했습니다.' : '리마인드 규칙을 활성화했습니다.')
          router.refresh()
        })
      }}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white transition',
          enabled ? 'right-0.5' : 'left-0.5',
        )}
      />
    </button>
  )
}

export function ReminderTestSendButton({
  ruleId,
  disabled,
}: {
  readonly ruleId: string
  readonly disabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      aria-disabled={disabled || isPending}
      title={disabled ? '메일 발송 설정 후 사용할 수 있습니다.' : undefined}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-70',
        disabled
          ? 'border-company-border bg-[#f1f1f2] text-company-fg-subtle'
          : 'border-company-border-strong bg-company-surface text-foreground hover:bg-company-nav-hover',
      )}
      onClick={() => {
        if (disabled) return
        startTransition(async () => {
          const response = await fetch(`/api/internal-reminders/rules/${ruleId}/test-send`, { method: 'POST' })
          const result = await parseReminderMutationResponse(response)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('테스트 리마인드를 발송했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending ? '발송 중' : '테스트 발송'}
    </button>
  )
}

export function ReminderSendNowButton({ disabled }: { readonly disabled: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      aria-disabled={disabled || isPending}
      title={disabled ? '메일 발송 설정 후 사용할 수 있습니다.' : undefined}
      className={cn(
        'rounded-lg border px-3 py-2 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-70',
        disabled
          ? 'border-company-border bg-[#f1f1f2] text-company-fg-subtle'
          : 'border-company-border-strong bg-company-surface text-foreground hover:bg-company-nav-hover',
      )}
      onClick={() => {
        if (disabled) return
        startTransition(async () => {
          const response = await fetch('/api/internal-reminders/send-now', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          })
          const result = await parseReminderMutationResponse(response)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('활성 리마인드 발송을 요청했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending ? '발송 중' : '지금 발송'}
    </button>
  )
}

async function parseReminderMutationResponse(response: Response): Promise<{ ok: true } | { ok: false; message: string }> {
  const data = await response.json().catch(() => null) as { error?: unknown } | null

  if (!response.ok) {
    return {
      ok: false,
      message: typeof data?.error === 'string' ? data.error : '요청을 처리하지 못했습니다.',
    }
  }

  return { ok: true }
}

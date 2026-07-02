'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { FilingItemType, FilingReceiptRow } from '@/lib/filing-support/summary'
import { cn } from '@/lib/utils'

export function FilingGuideCopyButton({ payload }: { readonly payload: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="rounded-lg border border-[#18181b] bg-[#18181b] px-3 py-2 text-center text-[12px] font-semibold text-white"
      onClick={async () => {
        await navigator.clipboard.writeText(payload)
        setCopied(true)
        toast.success('가이드 값을 복사했습니다.')
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? '복사됨' : '가이드 값 복사'}
    </button>
  )
}

export function FilingReceiptUploadButton({
  filingPeriodKey,
  itemType,
  receiptType,
  compact = false,
}: {
  readonly filingPeriodKey: string
  readonly itemType: FilingItemType
  readonly receiptType: FilingReceiptRow['receiptType']
  readonly compact?: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return

          startTransition(async () => {
            const response = await fetch('/api/filing/receipts', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                filingPeriodKey,
                itemType,
                receiptType,
                originalFilename: file.name,
              }),
            })
            const result = await parseMutationResponse(response)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success('접수증 보관 기록을 추가했습니다.')
            router.refresh()
          })
        }}
      />
      <button
        type="button"
        disabled={isPending}
        className={cn(
          'rounded-lg border border-company-border-strong bg-company-surface font-semibold text-foreground disabled:cursor-wait disabled:opacity-70',
          compact ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-2 text-[12px]',
        )}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? '업로드 중' : '업로드'}
      </button>
    </>
  )
}

export function FilingReceiptDeleteButton({ receiptId }: { readonly receiptId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-[12px] font-semibold text-company-fg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70"
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/filing/receipts/${receiptId}`, { method: 'DELETE' })
          const result = await parseMutationResponse(response)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('접수증 보관 기록을 삭제했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending ? '삭제 중' : '삭제'}
    </button>
  )
}

export function FilingChecklistToggle({
  itemId,
  filingPeriodKey,
  code,
  completed,
}: {
  readonly itemId: string
  readonly filingPeriodKey: string
  readonly code: string
  readonly completed: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-pressed={completed}
      disabled={isPending}
      className={cn(
        'mt-0.5 size-[17px] shrink-0 rounded-[5px] border-[1.5px] text-[11px] leading-none disabled:cursor-wait disabled:opacity-70',
        completed
          ? 'border-[#16a34a] bg-[#16a34a] text-white'
          : 'border-company-border-strong bg-company-surface text-transparent',
      )}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/filing/checklist-items/${itemId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              filingPeriodKey,
              code,
              completed: !completed,
            }),
          })
          const result = await parseMutationResponse(response)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          router.refresh()
        })
      }}
    >
      {completed ? '✓' : '·'}
    </button>
  )
}

async function parseMutationResponse(response: Response): Promise<{ ok: true } | { ok: false; message: string }> {
  const data = await response.json().catch(() => null) as { error?: unknown } | null

  if (!response.ok) {
    return {
      ok: false,
      message: typeof data?.error === 'string' ? data.error : '요청을 처리하지 못했습니다.',
    }
  }

  return { ok: true }
}

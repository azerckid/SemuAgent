'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { sampleStatusLabel, type FirstRunSampleState } from '@/lib/first-run-sample/shared'

interface SampleDataBannerProps {
  state: FirstRunSampleState
}

export function SampleDataBanner({ state }: Readonly<SampleDataBannerProps>) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const visible = state.visible

  if (!visible) return null

  const isFailed = state.status === 'failed'
  const isBusy = state.status === 'creating' || state.status === 'delete_pending' || isPending

  const retry = () => {
    startTransition(async () => {
      const res = await fetch('/api/first-run-sample', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? '샘플 데이터를 다시 만들지 못했습니다.')
        router.refresh()
        return
      }
      toast.success('샘플 데이터를 다시 만들었습니다.')
      router.refresh()
    })
  }

  const remove = () => {
    startTransition(async () => {
      const res = await fetch('/api/first-run-sample', { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? '샘플 데이터를 삭제하지 못했습니다.')
        router.refresh()
        return
      }
      toast.success('샘플 데이터를 삭제했습니다. 이제 회사 자료로 시작하세요.')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="border-b border-company-border bg-[#fff7ed] px-4 py-3 text-[13px] text-[#7c2d12] sm:px-7">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#ea580c] ring-1 ring-[#fed7aa]">
            {isFailed ? <AlertTriangle className="size-4" /> : <Sparkles className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[#431407]">샘플 데이터로 보는 화면입니다</p>
              <span className="rounded-full border border-[#fed7aa] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">
                {sampleStatusLabel(state.status)}
              </span>
              {state.clientName && <span className="text-[12px] text-[#9a3412]">{state.clientName}</span>}
            </div>
            <p className="mt-0.5 text-[#9a3412]">
              실제 신고 전에 샘플을 삭제하고 회사 자료를 업로드하세요. 삭제 후에는 자동으로 다시 생성되지 않습니다.
            </p>
            {isFailed && state.errorMessage && (
              <p className="mt-1 text-[12px] text-[#b91c1c]">{state.errorMessage}</p>
            )}
            {confirmOpen ? (
              <div className="mt-2 space-y-2 rounded-lg border border-[#fed7aa] bg-white p-3 text-[13px] text-[#9a3412]">
                <p className="font-semibold text-[#431407]">샘플 데이터를 삭제할까요?</p>
                <p>삭제 대상은 첫 가입 안내를 위해 만든 샘플 데이터뿐입니다.</p>
                <p>샘플 업로드, 기장검토, 부가세, 급여, 신고지원, 직원 명부, 리마인드 데이터가 삭제됩니다.</p>
                <p>사용자가 직접 올린 실제 데이터는 registry에 없으면 삭제하지 않습니다.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setConfirmOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isBusy}
                    onClick={remove}
                  >
                    <Trash2 className="size-3.5" />
                    {isBusy ? '삭제 중' : '샘플 삭제'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isFailed ? (
            <Button type="button" variant="outline" size="sm" onClick={retry} disabled={isBusy}>
              <RefreshCw className="size-3.5" />
              샘플 데이터 다시 만들기
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy || confirmOpen}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              샘플 데이터 삭제하고 실제 사용 시작
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

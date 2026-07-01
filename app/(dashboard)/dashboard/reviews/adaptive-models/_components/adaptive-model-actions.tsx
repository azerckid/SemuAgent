'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const ADMIN_ONLY_TITLE = '관리자(TENANT_ADMIN)만 가능합니다'

async function postAction(path: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(path, { method: 'POST' })
  if (response.ok) return { ok: true }
  const data = await response.json().catch(() => null)
  return { ok: false, error: data?.error ?? '요청을 처리하지 못했습니다' }
}

export function AdaptiveModelActions({
  modelId,
  modelName,
  status,
  isTenantAdmin,
  mappingSummary,
  sampleRowCount,
  warnings,
}: {
  modelId: string
  modelName: string
  status: string
  isTenantAdmin: boolean
  mappingSummary: string[]
  sampleRowCount: number
  warnings: string[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    const result = await postAction(`/api/review/adaptive-models/${modelId}/approve`)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error ?? '승인하지 못했습니다')
      return
    }
    toast.success('모델을 승인했습니다. 다음 추출부터 같은 형식의 거래자료에 자동 재사용됩니다.')
    router.refresh()
  }

  const handleReject = async () => {
    setLoading(true)
    const result = await postAction(`/api/review/adaptive-models/${modelId}/reject`)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error ?? '거부하지 못했습니다')
      return
    }
    toast.success('제안을 거부했습니다.')
    router.refresh()
  }

  const handleRetire = async () => {
    setLoading(true)
    const result = await postAction(`/api/review/adaptive-models/${modelId}/retire`)
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error ?? '폐기하지 못했습니다')
      return
    }
    toast.success('모델을 폐기했습니다. 더 이상 자동 재사용되지 않습니다.')
    router.refresh()
  }

  if (status === 'proposed') {
    return (
      <div className="flex flex-wrap gap-2">
        {isTenantAdmin ? (
          <Sheet>
            <SheetTrigger className={buttonVariants({ size: 'sm' })}>
              승인
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>모델 승인 확인</SheetTitle>
                <SheetDescription>
                  승인하면 같은 형식의 거래자료를 처리할 때 이 모델이 자동으로 재사용됩니다.
                  적용된 row는 항상 검토 대상(needs_review)으로 표시되며, 귀속기간 검토·계정항목 정리 화면에서
                  그대로 검토·분류됩니다.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4">
                <p className="text-sm font-medium text-foreground">{modelName}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">주요 매핑</p>
                  <ul className="space-y-1 text-sm">
                    {mappingSummary.slice(0, 6).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">샘플 row {sampleRowCount}개 확인됨</p>
                {warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                  </div>
                )}
              </div>
              <div className="px-4">
                <Button type="button" onClick={handleApprove} disabled={loading}>
                  {loading ? '승인 중...' : '승인 확정'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <button
            type="button"
            disabled
            title={ADMIN_ONLY_TITLE}
            className={buttonVariants({ size: 'sm' })}
          >
            승인
          </button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleReject} disabled={loading}>
          거부
        </Button>
      </div>
    )
  }

  if (status === 'approved') {
    if (!isTenantAdmin) {
      return (
        <button
          type="button"
          disabled
          title={ADMIN_ONLY_TITLE}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          폐기
        </button>
      )
    }
    return (
      <Sheet>
        <SheetTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          폐기
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>모델 폐기 확인</SheetTitle>
            <SheetDescription>
              폐기하면 이 모델은 더 이상 자동으로 재사용되지 않습니다. 이미 만들어진 거래 row에는 영향을 주지 않습니다.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <p className="text-sm font-medium text-foreground">{modelName}</p>
          </div>
          <div className="px-4">
            <Button type="button" variant="destructive" onClick={handleRetire} disabled={loading}>
              {loading ? '폐기 중...' : '폐기 확정'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return null
}

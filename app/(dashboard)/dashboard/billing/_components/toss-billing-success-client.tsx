'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type TossBillingSuccessClientProps = {
  authKey?: string
  customerKey?: string
}

type CompletionState =
  | { status: 'loading' }
  | { status: 'success'; charged: boolean; nextBillingAt?: string | null }
  | { status: 'error'; message: string }

export function TossBillingSuccessClient({
  authKey,
  customerKey,
}: TossBillingSuccessClientProps) {
  const [state, setState] = useState<CompletionState>({ status: 'loading' })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true

    async function complete() {
      if (!authKey || !customerKey) {
        setState({ status: 'error', message: 'Toss 인증 결과가 올바르지 않습니다' })
        return
      }

      try {
        const response = await fetch('/api/billing/toss/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authKey, customerKey }),
        })
        const payload = await response.json() as {
          error?: string
          charged?: boolean
          nextBillingAt?: string | null
        }
        if (!response.ok) {
          throw new Error(payload.error ?? '빌링키 발급에 실패했습니다')
        }

        setState({
          status: 'success',
          charged: payload.charged === true,
          nextBillingAt: payload.nextBillingAt ?? null,
        })
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : '빌링키 발급에 실패했습니다',
        })
      }
    }

    void complete()
  }, [authKey, customerKey])

  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            {state.status === 'loading' && <Loader2 className="size-5 animate-spin text-blue-600" />}
            {state.status === 'success' && <CheckCircle2 className="size-5 text-emerald-600" />}
            {state.status === 'error' && <XCircle className="size-5 text-red-600" />}
            <CardTitle>Toss 정기결제 등록</CardTitle>
          </div>
          <CardDescription>
            카드 등록 결과를 확인하고 JARYO 구독 상태에 반영합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === 'loading' && (
            <p className="text-sm text-muted-foreground">빌링키를 발급하고 있습니다.</p>
          )}
          {state.status === 'success' && (
            <div className="space-y-3">
              <Badge variant="success">등록 완료</Badge>
              <p className="text-sm text-foreground">
                {state.charged
                  ? '첫 결제가 승인되었고 다음 결제일이 저장되었습니다.'
                  : '카드 등록과 빌링키 저장이 완료되었습니다. 자동 과금은 운영 env 승인 후 활성화됩니다.'}
              </p>
              {state.nextBillingAt && (
                <p className="text-xs text-muted-foreground">다음 결제 기준: {state.nextBillingAt}</p>
              )}
            </div>
          )}
          {state.status === 'error' && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          )}
          <Link
            href="/dashboard/billing"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          >
            Billing으로 돌아가기
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

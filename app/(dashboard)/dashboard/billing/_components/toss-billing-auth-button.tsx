'use client'

import { useState } from 'react'
import { z } from 'zod'
import { CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BillingPlanCode } from '@/lib/billing/plans'

type TossBillingAuthButtonProps = {
  planCode: BillingPlanCode
  disabled?: boolean
  disabledReason?: string
}

type TossPayment = {
  requestBillingAuth: (params: {
    method: 'CARD'
    successUrl: string
    failUrl: string
    customerName?: string
    customerEmail?: string
    windowTarget?: 'self' | 'iframe'
    selectableCardTypes?: Array<'CORPORATE' | 'PERSONAL'>
  }) => Promise<void>
  destroy?: () => void
}

type TossPaymentsInstance = {
  payment: (params: { customerKey: string }) => TossPayment
}

type TossPaymentsInitializer = (clientKey: string) => TossPaymentsInstance

declare global {
  interface Window {
    TossPayments?: TossPaymentsInitializer
  }
}

const tossStartResponseSchema = z.object({
  clientKey: z.string().min(1),
  customerKey: z.string().min(1),
  successUrl: z.string().url(),
  failUrl: z.string().url(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
})

let tossSdkPromise: Promise<TossPaymentsInitializer> | null = null

function loadTossSdk(): Promise<TossPaymentsInitializer> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저에서만 결제창을 열 수 있습니다'))
  }
  if (window.TossPayments) return Promise.resolve(window.TossPayments)
  if (tossSdkPromise) return tossSdkPromise

  tossSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('toss-payments-sdk')
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.TossPayments) resolve(window.TossPayments)
        else reject(new Error('Toss SDK를 불러오지 못했습니다'))
      }, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Toss SDK 로드 실패')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = 'toss-payments-sdk'
    script.src = 'https://js.tosspayments.com/v2/standard'
    script.async = true
    script.onload = () => {
      if (window.TossPayments) resolve(window.TossPayments)
      else reject(new Error('Toss SDK를 불러오지 못했습니다'))
    }
    script.onerror = () => reject(new Error('Toss SDK 로드 실패'))
    document.head.appendChild(script)
  })

  return tossSdkPromise
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (typeof payload.error === 'string') return payload.error
  } catch {
    // ignore
  }
  return '결제 등록을 시작하지 못했습니다'
}

export function TossBillingAuthButton({
  planCode,
  disabled = false,
  disabledReason,
}: TossBillingAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/billing/toss/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      })
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response))
      }

      const payload = tossStartResponseSchema.parse(await response.json())
      const TossPayments = await loadTossSdk()
      const tossPayments = TossPayments(payload.clientKey)
      const payment = tossPayments.payment({ customerKey: payload.customerKey })

      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: payload.successUrl,
        failUrl: payload.failUrl,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        windowTarget: 'self',
        selectableCardTypes: ['CORPORATE', 'PERSONAL'],
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '결제 등록을 시작하지 못했습니다')
      setLoading(false)
    }
  }

  const isDisabled = disabled || loading

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full gap-2" disabled={isDisabled} onClick={handleClick}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        Toss 카드 등록
      </Button>
      {disabledReason && disabled && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const examplePlaceholder = [
  '예) 식대는 월 20만원 비과세입니다.',
  '직책수당은 직책별 정액으로 과세 지급합니다.',
  '차량유지비는 월 20만원 비과세 지급합니다.',
  '연장근로수당은 통상시급의 1.5배입니다.',
  '(국민연금·건강보험 등 공제는 더존이 자동 계산하므로 적지 않아도 됩니다.)',
].join('\n')

/**
 * Slice 4a: 담당자가 사내 급여 규칙을 자연어로 설명하면 AI가 구조화해 draft를
 * 만든다. CSV가 아니라 말로 설명하는 통로. 민감정보(주민번호 등)가 섞이면 서버가
 * 일반 AI로 보내지 않고 차단한다.
 */
export function NlRuleDraftForm({
  clientId,
  defaultEffectiveFrom,
}: {
  clientId: string
  defaultEffectiveFrom: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom)
  const [naturalLanguage, setNaturalLanguage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function submit() {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/payroll-rule-profiles/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'natural_language', naturalLanguage, effectiveFrom }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (!response.ok) {
        setErrorMessage(formatApiError(payload?.error) ?? '사내급여기준 초안을 만들지 못했습니다')
        return
      }
      setSuccessMessage('사내급여기준 프로필 초안을 만들었습니다. 승인 전에는 급여 계산에 적용되지 않습니다.')
      setNaturalLanguage('')
      startTransition(() => router.refresh())
    } finally {
      setIsSubmitting(false)
    }
  }

  const busy = isSubmitting || isPending

  return (
    <div className="border-t border-gray-100 pt-4">
      <label className="block text-sm font-medium text-gray-700">
        유효 시작월
        <Input
          type="month"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          className="mt-1 w-44"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-gray-700">
        사내 급여 규칙 (자연어로 설명)
        <Textarea
          className="mt-1 min-h-32"
          value={naturalLanguage}
          onChange={(event) => setNaturalLanguage(event.target.value)}
          placeholder={examplePlaceholder}
        />
      </label>
      <p className="mt-1 text-xs text-gray-400">
        주민번호·계좌번호·연락처 같은 개인정보는 넣지 마세요(감지되면 차단됩니다). 규칙만 적으면 AI가 수당·공제·과세·계산식으로 정리합니다. AI 초안은 담당자 검토 대상으로 저장됩니다.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={busy || !naturalLanguage.trim() || !effectiveFrom}>
          {busy ? 'AI 정리 중…' : 'AI로 초안 만들기'}
        </Button>
        <span className="text-xs text-gray-400">초안은 담당자 승인 전에는 적용되지 않습니다.</span>
      </div>
      {errorMessage && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
      )}
    </div>
  )
}

function formatApiError(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'formErrors' in error) {
    const flattened = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    return flattened.formErrors?.[0] ?? Object.values(flattened.fieldErrors ?? {}).flat()[0] ?? null
  }
  return null
}

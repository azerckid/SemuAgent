'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { effectivePeriodsOverlap } from '@/lib/payroll/rule-profile-lifecycle'

function formatApiError(error: unknown): string | null {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'formErrors' in error) {
    const flattened = error as { formErrors?: string[] }
    if (flattened.formErrors?.[0]) return flattened.formErrors[0]
  }
  return null
}

type Props = {
  clientId: string
  profileId: string
  defaultEffectiveFrom: string
  defaultEffectiveTo?: string | null
  needsReviewCount: number
  conflictRowCount: number
  teeBlocked: boolean
  activeProfilePeriod: {
    effectiveFrom: string
    effectiveTo: string | null
  } | null
}

export function PayrollRuleProfileApprovalPanel({
  clientId,
  profileId,
  defaultEffectiveFrom,
  defaultEffectiveTo,
  needsReviewCount,
  conflictRowCount,
  teeBlocked,
  activeProfilePeriod,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom)
  const [effectiveTo, setEffectiveTo] = useState(defaultEffectiveTo ?? '')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [supersedeConfirmed, setSupersedeConfirmed] = useState(false)
  const [supersedePromptFrom409, setSupersedePromptFrom409] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const overlapWithActive = useMemo(() => {
    if (!activeProfilePeriod) return false
    return effectivePeriodsOverlap(
      effectiveFrom,
      effectiveTo.trim() || null,
      activeProfilePeriod.effectiveFrom,
      activeProfilePeriod.effectiveTo,
    )
  }, [activeProfilePeriod, effectiveFrom, effectiveTo])

  const showSupersedeCheckbox = overlapWithActive || supersedePromptFrom409
  const needsSupersedeConfirmation = showSupersedeCheckbox && !supersedeConfirmed

  const busy = isSubmitting || isPending
  const blockedReason = teeBlocked
    ? '민감정보 보안 처리 경로가 필요한 출처는 승인할 수 없습니다'
    : conflictRowCount > 0
      ? `미해결 충돌·범위외 항목 ${conflictRowCount}건이 있어 승인할 수 없습니다`
      : needsSupersedeConfirmation
        ? '기존 승인된 사내급여기준을 대체하려면 확인이 필요합니다'
        : null
  const canApprove = !blockedReason

  async function postLifecycle(
    path: 'approve' | 'reject',
    body?: Record<string, unknown>,
  ): Promise<{ ok: boolean; code?: string }> {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/clients/${clientId}/payroll-rule-profiles/${profileId}/${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        },
      )
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown
        code?: string
      } | null
      if (!response.ok) {
        setErrorMessage(formatApiError(payload?.error) ?? '요청을 처리하지 못했습니다')
        if (payload?.code === 'overlap_requires_supersede') {
          setSupersedePromptFrom409(true)
        }
        return { ok: false, code: payload?.code }
      }
      return { ok: true }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function approve() {
    const result = await postLifecycle('approve', {
      effectiveFrom,
      effectiveTo: effectiveTo.trim() || null,
      approvalNotes: approvalNotes.trim() || null,
      supersedeConfirmed: showSupersedeCheckbox ? supersedeConfirmed : undefined,
    })
    if (!result.ok) return
    setSuccessMessage('사내급여기준 프로필을 승인했습니다. 월 급여정산 적용은 다음 단계에서 연결됩니다.')
    startTransition(() => router.refresh())
  }

  async function rejectDraft() {
    const result = await postLifecycle('reject', {
      reason: approvalNotes.trim() || null,
    })
    if (!result.ok) return
    setSuccessMessage('프로필 초안을 거부했습니다.')
    startTransition(() => router.refresh())
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">승인 검토</h3>
          <p className="text-xs text-gray-500">
            승인하면 검토필요 row는 준비됨으로 반영되고, 이 기준이 active 프로필이 됩니다.
          </p>
        </div>
        <Badge variant="warning">승인 전 미적용</Badge>
      </div>

      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">검토필요 row</dt>
          <dd className="font-medium text-gray-900">{needsReviewCount}건 (승인 시 준비됨으로 반영)</dd>
        </div>
        <div>
          <dt className="text-gray-500">승인 차단 충돌</dt>
          <dd className="font-medium text-gray-900">{conflictRowCount}건</dd>
        </div>
        <div>
          <dt className="text-gray-500">보안 처리</dt>
          <dd className="font-medium text-gray-900">{teeBlocked ? 'TEE 필요 · 승인 불가' : '일반 경로'}</dd>
        </div>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor={`effective-from-${profileId}`}>
            유효 시작월 (YYYY-MM)
          </label>
          <Input
            id={`effective-from-${profileId}`}
            value={effectiveFrom}
            onChange={(event) => {
              setEffectiveFrom(event.target.value)
              setSupersedePromptFrom409(false)
              setSupersedeConfirmed(false)
            }}
            disabled={busy}
            placeholder="2026-06"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor={`effective-to-${profileId}`}>
            유효 종료월 (선택)
          </label>
          <Input
            id={`effective-to-${profileId}`}
            value={effectiveTo}
            onChange={(event) => {
              setEffectiveTo(event.target.value)
              setSupersedePromptFrom409(false)
              setSupersedeConfirmed(false)
            }}
            disabled={busy}
            placeholder="비우면 무제한"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor={`approval-notes-${profileId}`}>
          승인/거부 메모 (선택)
        </label>
        <Textarea
          id={`approval-notes-${profileId}`}
          value={approvalNotes}
          onChange={(event) => setApprovalNotes(event.target.value)}
          disabled={busy}
          rows={3}
          placeholder="승인 근거 또는 거부 사유"
        />
      </div>

      {showSupersedeCheckbox && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={supersedeConfirmed}
            onChange={(event) => setSupersedeConfirmed(event.target.checked)}
            disabled={busy}
          />
          <span>
            입력한 유효기간이 기존 승인된 사내급여기준과 겹칩니다. 기존 기준을 대체(supersede)합니다.
          </span>
        </label>
      )}

      {blockedReason && (
        <p className="mt-3 text-sm text-amber-800">{blockedReason}</p>
      )}

      {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
      {successMessage && <p className="mt-3 text-sm text-emerald-700">{successMessage}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !canApprove} onClick={() => void approve()}>
          {busy ? '처리 중…' : '프로필 승인'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void rejectDraft()}>
          초안 거부
        </Button>
      </div>
    </div>
  )
}

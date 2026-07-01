'use client'

import { useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatKRW, type BillingPlanCode } from '@/lib/billing/plans'
import type { BillingProfileStatus, BillingProfileView } from '@/lib/billing/profile-model'

type ManualSubscriptionSummary = {
  planCode: string
  status: string
  contractType: string
  provider: string
} | null

type BillingProfileSectionProps = {
  canManageBilling: boolean
  initialProfile: BillingProfileView | null
  initialStatus: BillingProfileStatus
  selectedPlanCode: BillingPlanCode
  selectedPlanName: string
  selectedPlanMonthlyPriceKrw: number | null
  manualSubscription: ManualSubscriptionSummary
}

type FormState = {
  businessRegistrationNumber: string
  businessName: string
  representativeName: string
  businessAddress: string
  businessType: string
  businessItem: string
  taxInvoiceEmail: string
  billingContactName: string
  billingContactPhone: string
  memo: string
}

const STATUS_LABEL: Record<BillingProfileStatus, string> = {
  missing: '미입력',
  needs_review: '확인 필요',
  complete: '등록됨',
}

const STATUS_VARIANT: Record<BillingProfileStatus, 'secondary' | 'warning' | 'success'> = {
  missing: 'secondary',
  needs_review: 'warning',
  complete: 'success',
}

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  pending_payment: '발행 요청됨',
  active: '활성',
  past_due: '결제 확인 필요',
  canceled: '해지',
}

const CONTRACT_LABEL: Record<string, string> = {
  manual_invoice: '세금계산서 청구',
  provider_auto_billing: 'Toss 자동결제',
}

function profileToForm(profile: BillingProfileView | null): FormState {
  return {
    businessRegistrationNumber: profile?.businessRegistrationNumber ?? '',
    businessName: profile?.businessName ?? '',
    representativeName: profile?.representativeName ?? '',
    businessAddress: profile?.businessAddress ?? '',
    businessType: profile?.businessType ?? '',
    businessItem: profile?.businessItem ?? '',
    taxInvoiceEmail: profile?.taxInvoiceEmail ?? '',
    billingContactName: profile?.billingContactName ?? '',
    billingContactPhone: profile?.billingContactPhone ?? '',
    memo: profile?.memo ?? '',
  }
}

function readOnlyValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-'
}

export function BillingProfileSection({
  canManageBilling,
  initialProfile,
  initialStatus,
  selectedPlanCode,
  selectedPlanName,
  selectedPlanMonthlyPriceKrw,
  manualSubscription,
}: BillingProfileSectionProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [status, setStatus] = useState(initialStatus)
  const [form, setForm] = useState<FormState>(() => profileToForm(initialProfile))
  const [isEditing, setIsEditing] = useState(initialStatus !== 'complete' && canManageBilling)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [manualState, setManualState] = useState(manualSubscription)
  const [isSaving, startSaveTransition] = useTransition()
  const [isUpdatingManual, startManualTransition] = useTransition()

  const profileComplete = status === 'complete'
  const selectedPlanSupported = selectedPlanCode !== 'enterprise' && selectedPlanMonthlyPriceKrw !== null
  const canUseManualActions = canManageBilling && profileComplete && selectedPlanSupported

  const readonlyRows = useMemo(() => [
    ['사업자등록번호', profile?.maskedBusinessRegistrationNumber ?? ''],
    ['상호명', profile?.businessName ?? ''],
    ['대표자명', profile?.representativeName ?? ''],
    ['사업장 주소', profile?.businessAddress ?? ''],
    ['업태/종목', [profile?.businessType, profile?.businessItem].filter(Boolean).join(' / ')],
    ['세금계산서 이메일', profile?.taxInvoiceEmail ?? ''],
    ['청구 담당자', [profile?.billingContactName, profile?.billingContactPhone].filter(Boolean).join(' · ')],
  ], [profile])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const saveProfile = () => {
    setError('')
    setMessage('')
    startSaveTransition(async () => {
      const response = await fetch('/api/billing/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : '청구정보 저장에 실패했습니다.')
        return
      }
      setProfile(data.profile)
      setStatus(data.status)
      setForm(profileToForm(data.profile))
      setIsEditing(false)
      setMessage('청구정보를 저장했습니다.')
    })
  }

  const requestTaxInvoice = () => {
    setError('')
    setMessage('')
    startManualTransition(async () => {
      const response = await fetch('/api/billing/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: selectedPlanCode, mode: 'manual_invoice' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : '세금계산서 청구 요청 저장에 실패했습니다.')
        return
      }
      setManualState({
        planCode: data.planCode,
        status: data.status,
        contractType: data.contractType,
        provider: 'manual',
      })
      setMessage('세금계산서 청구 요청을 저장했습니다.')
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>청구정보</CardTitle>
                <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
              </div>
              <CardDescription>
                세금계산서 청구에 사용할 사무소 청구 주체 정보입니다.
              </CardDescription>
            </div>
            {canManageBilling && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                수정
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManageBilling && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              청구정보 수정은 관리자 권한에서만 가능합니다.
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  <span>사업자등록번호</span>
                  <Input
                    value={form.businessRegistrationNumber}
                    onChange={(event) => updateField('businessRegistrationNumber', event.target.value)}
                    placeholder="123-45-67890"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>상호명</span>
                  <Input
                    value={form.businessName}
                    onChange={(event) => updateField('businessName', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>대표자명</span>
                  <Input
                    value={form.representativeName}
                    onChange={(event) => updateField('representativeName', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>세금계산서 이메일</span>
                  <Input
                    type="email"
                    value={form.taxInvoiceEmail}
                    onChange={(event) => updateField('taxInvoiceEmail', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium md:col-span-2">
                  <span>사업장 주소</span>
                  <Input
                    value={form.businessAddress}
                    onChange={(event) => updateField('businessAddress', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>업태</span>
                  <Input
                    value={form.businessType}
                    onChange={(event) => updateField('businessType', event.target.value)}
                    placeholder="선택 입력"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>종목</span>
                  <Input
                    value={form.businessItem}
                    onChange={(event) => updateField('businessItem', event.target.value)}
                    placeholder="선택 입력"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>청구 담당자명</span>
                  <Input
                    value={form.billingContactName}
                    onChange={(event) => updateField('billingContactName', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>청구 담당자 연락처</span>
                  <Input
                    value={form.billingContactPhone}
                    onChange={(event) => updateField('billingContactPhone', event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium md:col-span-2">
                  <span>메모</span>
                  <Textarea
                    value={form.memo}
                    onChange={(event) => updateField('memo', event.target.value)}
                    placeholder="계약·세금계산서 발행 참고사항"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveProfile} disabled={isSaving}>
                  {isSaving ? '저장 중' : '청구정보 저장'}
                </Button>
                {profile && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm(profileToForm(profile))
                      setIsEditing(false)
                      setError('')
                    }}
                  >
                    취소
                  </Button>
                )}
              </div>
            </div>
          ) : profile ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {readonlyRows.map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium text-foreground">{readOnlyValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              아직 청구정보가 없습니다. 세금계산서 청구 전에 입력해 주세요.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>세금계산서 청구 상태</CardTitle>
          <CardDescription>
            세금계산서 발행 요청 상태를 저장합니다. 실제 발행과 입금 확인은 JARYO 운영에서 처리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-blue-900">
            선택 플랜: {selectedPlanName} · {formatKRW(selectedPlanMonthlyPriceKrw)}/월
          </div>
          <div className="grid gap-2 text-muted-foreground">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs">현재 청구 상태</p>
              <p className="font-medium text-foreground">
                {manualState
                  ? `${CONTRACT_LABEL[manualState.contractType] ?? manualState.contractType} · ${SUBSCRIPTION_STATUS_LABEL[manualState.status] ?? manualState.status}`
                  : '미설정'}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs">청구정보 상태</p>
              <p className="font-medium text-foreground">{STATUS_LABEL[status]}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              disabled={!canUseManualActions || isUpdatingManual}
              onClick={requestTaxInvoice}
            >
              세금계산서 청구 요청
            </Button>
          </div>
          {!selectedPlanSupported && (
            <p className="text-xs text-amber-700">Enterprise는 별도 계약으로 처리합니다.</p>
          )}
          {!profileComplete && (
            <p className="text-xs text-muted-foreground">
              청구정보가 등록되면 세금계산서 청구를 요청할 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {(message || error) && (
        <div className="xl:col-span-2">
          <div className={error ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' : 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'}>
            {error || message}
          </div>
        </div>
      )}
    </div>
  )
}

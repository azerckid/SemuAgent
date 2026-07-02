'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { PayrollCloseAction } from '@/lib/payroll-workspace/summary'
import { cn } from '@/lib/utils'

export function PayrollResolveIssueButton({ lineId }: { readonly lineId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      className="rounded-lg border border-[#d97706] bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-[#d97706] disabled:cursor-wait disabled:opacity-70"
      onClick={() => {
        startTransition(async () => {
          const result = await postPayrollMutation(`/api/payroll/employee-lines/${lineId}/resolve`)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('확인 필요 상태를 처리했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending ? '처리 중' : '확인 완료'}
    </button>
  )
}

export function PayrollDocumentsButton({
  periodKey,
  locked,
}: {
  readonly periodKey: string
  readonly locked: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const disabled = locked || isPending

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        'w-full rounded-lg border px-3.5 py-2.5 text-center text-[12.5px] font-semibold',
        locked
          ? 'cursor-not-allowed border-company-border bg-[#f1f1f2] text-company-fg-subtle'
          : 'border-company-border-strong bg-company-surface text-foreground hover:bg-company-nav-hover',
      )}
      onClick={() => {
        if (locked) return
        startTransition(async () => {
          const result = await postPayrollMutation(`/api/payroll/periods/${periodKey}/documents`)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('급여 산출물을 생성 상태로 변경했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending ? '산출물 생성 중' : locked ? '산출물 생성 · 잠김' : '산출물 생성'}
    </button>
  )
}

export function PayrollCloseButton({
  periodKey,
  closeAction,
}: {
  readonly periodKey: string
  readonly closeAction: PayrollCloseAction
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const disabled = closeAction.locked || isPending

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        'w-full rounded-lg border px-3.5 py-2.5 text-center text-[12.5px] font-semibold',
        closeAction.canClose
          ? 'border-[#18181b] bg-[#18181b] text-white disabled:cursor-wait disabled:opacity-70'
          : 'cursor-not-allowed border-company-border bg-[#f1f1f2] text-company-fg-subtle',
      )}
      onClick={() => {
        if (!closeAction.canClose) return
        startTransition(async () => {
          const result = await postPayrollMutation(`/api/payroll/periods/${periodKey}/close`)
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          toast.success('급여를 마감했습니다.')
          router.refresh()
        })
      }}
    >
      {isPending
        ? '마감 처리 중'
        : closeAction.canClose
          ? '급여 마감·확정'
          : `급여 마감·확정 · 잠김 (${closeAction.lockReason ?? '확인 후 활성화'})`}
    </button>
  )
}

export function PayrollInsuranceNoticeForm({ periodKey }: { readonly periodKey: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const employeeName = String(formData.get('employeeName') ?? '').trim()
    const employeeCode = String(formData.get('employeeCode') ?? '').trim()

    if (!employeeName && !employeeCode) {
      toast.error('직원명 또는 직원코드를 입력해 주세요.')
      return
    }

    const line = {
      employeeName: employeeName || null,
      employeeCode: employeeCode || null,
      nationalPensionKrw: amountFromForm(formData, 'nationalPensionKrw'),
      healthInsuranceKrw: amountFromForm(formData, 'healthInsuranceKrw'),
      longTermCareKrw: amountFromForm(formData, 'longTermCareKrw'),
      employmentInsuranceKrw: amountFromForm(formData, 'employmentInsuranceKrw'),
    }

    startTransition(async () => {
      const response = await fetch(`/api/payroll/periods/${periodKey}/insurance-notices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceType: 'manual', lines: [line] }),
      })
      const result = await parsePayrollMutationResponse(response)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('4대보험 고지액을 반영했습니다.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="mt-3 rounded-[10px] border border-company-border bg-[#fafafa] p-3">
      <button
        type="button"
        className="text-[12.5px] font-semibold text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        4대보험 고지액 수동 입력
      </button>
      {open ? (
        <form className="mt-3 grid gap-2" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-2">
            <NoticeInput name="employeeName" label="직원명" placeholder="김민서" />
            <NoticeInput name="employeeCode" label="직원코드" placeholder="E-001" />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <NoticeInput name="nationalPensionKrw" label="국민연금" numeric />
            <NoticeInput name="healthInsuranceKrw" label="건강보험" numeric />
            <NoticeInput name="longTermCareKrw" label="장기요양" numeric />
            <NoticeInput name="employmentInsuranceKrw" label="고용보험" numeric />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-1 w-fit rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-foreground disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? '반영 중' : '고지액 반영'}
          </button>
        </form>
      ) : null}
    </div>
  )
}

async function postPayrollMutation(url: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(url, { method: 'POST' })
  return parsePayrollMutationResponse(response)
}

async function parsePayrollMutationResponse(response: Response): Promise<{ ok: true } | { ok: false; message: string }> {
  const data = await response.json().catch(() => null) as { error?: unknown } | null

  if (!response.ok) {
    return {
      ok: false,
      message: typeof data?.error === 'string' ? data.error : '요청을 처리하지 못했습니다.',
    }
  }

  return { ok: true }
}

function amountFromForm(formData: FormData, key: string) {
  const value = Number(String(formData.get(key) ?? '0').replaceAll(',', '').trim())
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function NoticeInput({
  name,
  label,
  placeholder,
  numeric = false,
}: {
  readonly name: string
  readonly label: string
  readonly placeholder?: string
  readonly numeric?: boolean
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold text-company-fg-muted">
      {label}
      <input
        name={name}
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'numeric' : undefined}
        min={numeric ? 0 : undefined}
        placeholder={placeholder ?? '0'}
        className="h-8 rounded-[7px] border border-company-border bg-company-surface px-2 text-[12px] font-medium text-foreground"
      />
    </label>
  )
}

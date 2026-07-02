'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EmployeeDirectoryRow } from '@/lib/employee-directory/summary'
import { cn } from '@/lib/utils'

type EmployeeFormState = {
  displayName: string
  employeeCode: string
  department: string
  jobTitle: string
  employeeStatus: EmployeeDirectoryRow['employeeStatus']
  payrollEligibility: EmployeeDirectoryRow['payrollEligibility']
  insuranceEnrollmentStatus: EmployeeDirectoryRow['insuranceEnrollmentStatus']
  hireDate: string
  workEmail: string
  notificationEnabled: boolean
}

function initialState(employee?: EmployeeDirectoryRow): EmployeeFormState {
  return {
    displayName: employee?.displayName ?? '',
    employeeCode: employee?.employeeCode ?? '',
    department: employee?.department ?? '',
    jobTitle: employee?.jobTitle ?? '',
    employeeStatus: employee?.employeeStatus ?? 'active',
    payrollEligibility: employee?.payrollEligibility ?? 'eligible',
    insuranceEnrollmentStatus: employee?.insuranceEnrollmentStatus ?? 'not_checked',
    hireDate: employee?.hireDate ?? '',
    workEmail: employee?.workEmail ?? '',
    notificationEnabled: employee?.notificationEnabled ?? true,
  }
}

export function EmployeeEditorButton({
  employee,
  label,
  variant = 'default',
}: {
  readonly employee?: EmployeeDirectoryRow
  readonly label: string
  readonly variant?: 'primary' | 'default'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={cn(
          'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold',
          variant === 'primary'
            ? 'border border-[#18181b] bg-[#18181b] text-white'
            : 'border border-company-border-strong bg-company-surface text-foreground',
        )}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <EmployeeEditorDialog employee={employee} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

function EmployeeEditorDialog({
  employee,
  onClose,
}: {
  readonly employee?: EmployeeDirectoryRow
  readonly onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<EmployeeFormState>(() => initialState(employee))
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(employee)

  function update<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.displayName.trim()) {
      toast.error('이름을 입력해 주세요.')
      return
    }

    const payload = {
      displayName: form.displayName.trim(),
      employeeCode: form.employeeCode.trim() || null,
      department: form.department.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      employeeStatus: form.employeeStatus,
      payrollEligibility: form.payrollEligibility,
      insuranceEnrollmentStatus: form.insuranceEnrollmentStatus,
      hireDate: form.hireDate.trim() || null,
      workEmail: form.workEmail.trim() || null,
      notificationEnabled: form.notificationEnabled,
    }

    startTransition(async () => {
      const response = await fetch(
        isEdit ? `/api/employees/${employee!.id}` : '/api/employees',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => null) as { error?: unknown } | null
      if (!response.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : '요청을 처리하지 못했습니다.')
        return
      }
      toast.success(isEdit ? '직원 정보를 수정했습니다.' : '직원을 추가했습니다.')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="w-full max-w-[520px] rounded-xl border border-company-border bg-company-surface p-5 shadow-lg"
      >
        <h2 className="text-sm font-semibold text-foreground">{isEdit ? '직원 수정' : '직원 추가'}</h2>
        <p className="mt-1 mb-3 text-[11.5px] text-company-fg-subtle">
          주민등록번호·계좌번호·전화번호 원문은 저장하지 않습니다. 이름·사번·부서·업무 이메일만 관리합니다.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="이름">
            <input className={inputClass} value={form.displayName} onChange={(e) => update('displayName', e.target.value)} maxLength={100} />
          </Field>
          <Field label="사번">
            <input className={inputClass} value={form.employeeCode} onChange={(e) => update('employeeCode', e.target.value)} maxLength={80} />
          </Field>
          <Field label="부서">
            <input className={inputClass} value={form.department} onChange={(e) => update('department', e.target.value)} maxLength={100} />
          </Field>
          <Field label="직책">
            <input className={inputClass} value={form.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} maxLength={100} />
          </Field>
          <Field label="재직 상태">
            <select className={inputClass} value={form.employeeStatus} onChange={(e) => update('employeeStatus', e.target.value as EmployeeFormState['employeeStatus'])}>
              <option value="active">재직</option>
              <option value="leave">휴직</option>
              <option value="terminated">퇴사</option>
            </select>
          </Field>
          <Field label="입사일">
            <input type="date" className={inputClass} value={form.hireDate} onChange={(e) => update('hireDate', e.target.value)} />
          </Field>
          <Field label="4대보험 확인">
            <select className={inputClass} value={form.insuranceEnrollmentStatus} onChange={(e) => update('insuranceEnrollmentStatus', e.target.value as EmployeeFormState['insuranceEnrollmentStatus'])}>
              <option value="not_checked">미확인</option>
              <option value="enrolled">가입 확인</option>
              <option value="needs_review">확인 필요</option>
              <option value="not_applicable">해당 없음</option>
            </select>
          </Field>
          <Field label="급여 대상">
            <select className={inputClass} value={form.payrollEligibility} onChange={(e) => update('payrollEligibility', e.target.value as EmployeeFormState['payrollEligibility'])}>
              <option value="eligible">대상</option>
              <option value="excluded">제외</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="업무 이메일">
              <input type="email" className={inputClass} value={form.workEmail} onChange={(e) => update('workEmail', e.target.value)} maxLength={255} />
            </Field>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-[12.5px] font-medium text-foreground">
            <input type="checkbox" checked={form.notificationEnabled} onChange={(e) => update('notificationEnabled', e.target.checked)} />
            내부 리마인드 수신 (업무 이메일)
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-company-border pt-4">
          <button type="button" disabled={isPending} className="rounded-lg border border-company-border-strong bg-company-surface px-3.5 py-2 text-[12.5px] font-semibold text-foreground disabled:opacity-60" onClick={onClose}>
            취소
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg border border-[#18181b] bg-[#18181b] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:cursor-wait disabled:opacity-70">
            {isPending ? '저장 중' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-company-border-strong bg-company-surface px-2.5 py-2 text-[13px] text-foreground'

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-company-fg-muted">{label}</span>
      {children}
    </label>
  )
}

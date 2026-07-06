'use client'

import { useState } from 'react'
import type { SimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'
import type { ValidationIssue } from '@/lib/efiling-simplified-wage/types'

type FormState = {
  taxOfficeCode: string
  contactDepartment: string
  contactName: string
  contactPhone: string
  hometaxId: string
  representativeId: string
  employeePii: Record<string, string>
}

type Props = {
  efiling: SimplifiedWageEfilingSummary
}

export function SimplifiedWageEfilingGenerateForm({ efiling }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([])
  const [form, setForm] = useState<FormState>(() => ({
    taxOfficeCode: '',
    contactDepartment: '',
    contactName: '',
    contactPhone: '',
    hometaxId: '',
    representativeId: '',
    employeePii: Object.fromEntries(efiling.readyEmployees.map((e) => [e.employeeKey, ''])),
  }))

  const needsCorpId = efiling.submitterKind === 'corporation'

  async function handleDownload() {
    setBusy(true)
    setFormError(null)
    setValidationErrors([])

    try {
      const employeePii = Object.fromEntries(
        efiling.readyEmployees.map((e) => [
          e.employeeKey,
          { residentId: form.employeePii[e.employeeKey] ?? '' },
        ]),
      )

      const payload = {
        year: efiling.context.year,
        half: efiling.context.half,
        taxOfficeCode: form.taxOfficeCode,
        contactDepartment: form.contactDepartment || undefined,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        hometaxId: form.hometaxId || undefined,
        representativeId: form.representativeId || undefined,
        employeePii,
      }

      const response = await fetch('/api/filing-preparation/simplified-wage-efiling/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string; errors?: ValidationIssue[]; fieldErrors?: Record<string, string[]> }
        if (data.errors) {
          setValidationErrors(data.errors)
        }
        setFormError(data.error ?? '파일 생성에 실패했습니다.')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/)
      const fileName = match
        ? decodeURIComponent(match[1] ?? match[2] ?? efiling.fileNamePreview ?? 'SC')
        : (efiling.fileNamePreview ?? 'SC')

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      setFormError('파일 생성 요청 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-[#e9e5ff] px-[18px] py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-[#7c3aed] bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white"
        >
          {open ? '입력 닫기' : '파일 생성 준비'}
        </button>
        {efiling.hasBlockingDataIssues && (
          <span className="text-[11.5px] text-[#d97706]">데이터·사전검증 오류를 먼저 해결하세요.</span>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-4 rounded-[10px] border border-company-border bg-company-surface p-4">
          <p className="text-[12px] text-company-fg-muted">
            식별정보·제출 메타는 이 요청에만 사용되며 서버·DB·로그에 저장되지 않습니다.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="세무서코드 (3자리)">
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={3}
                value={form.taxOfficeCode}
                onChange={(e) => setForm((f) => ({ ...f, taxOfficeCode: e.target.value.replace(/\D/g, '') }))}
              />
            </Field>
            <Field label="담당부서 (선택)">
              <input
                className={inputClass}
                maxLength={30}
                value={form.contactDepartment}
                onChange={(e) => setForm((f) => ({ ...f, contactDepartment: e.target.value }))}
              />
            </Field>
            <Field label="담당자 성명">
              <input
                className={inputClass}
                maxLength={30}
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </Field>
            <Field label="담당자 연락처">
              <input
                className={inputClass}
                maxLength={15}
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </Field>
            <Field label="홈택스 ID (선택)">
              <input
                className={inputClass}
                maxLength={20}
                value={form.hometaxId}
                onChange={(e) => setForm((f) => ({ ...f, hometaxId: e.target.value }))}
              />
            </Field>
            <Field label={needsCorpId ? '법인등록번호 (13자리)' : '대표자 주민번호 (13자리, 선택)'}>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={13}
                value={form.representativeId}
                onChange={(e) => setForm((f) => ({ ...f, representativeId: e.target.value.replace(/\D/g, '') }))}
              />
            </Field>
          </div>

          {efiling.readyEmployees.length > 0 && (
            <div>
              <h5 className="text-[12.5px] font-semibold">소득자 식별정보 (준비 완료 {efiling.readyEmployees.length}명)</h5>
              <div className="mt-2 space-y-2">
                {efiling.readyEmployees.map((emp) => (
                  <div key={emp.employeeKey} className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
                    <span className="text-[12px] font-medium">{emp.employeeName}</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={13}
                      placeholder="주민등록번호 13자리"
                      autoComplete="off"
                      value={form.employeePii[emp.employeeKey] ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          employeePii: {
                            ...f.employeePii,
                            [emp.employeeKey]: e.target.value.replace(/\D/g, ''),
                          },
                        }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <p className="text-[12px] font-medium text-[#dc2626]">{formError}</p>
          )}

          {validationErrors.length > 0 && (
            <ul className="space-y-1 text-[12px] text-[#dc2626]">
              {validationErrors.map((issue) => (
                <li key={`${issue.ruleId}:${issue.employeeKey ?? 'global'}:${issue.message}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy || efiling.readyEmployees.length === 0}
              onClick={() => void handleDownload()}
              className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '생성 중…' : 'plain 파일 다운로드'}
            </button>
            <span className="self-center text-[11px] text-company-fg-subtle">
              NTS-CRYPTO 암호화 파일은 슬라이스 2b에서 지원 예정입니다.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-company-border bg-company-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#7c3aed]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-company-fg-muted">{label}</span>
      {children}
    </label>
  )
}

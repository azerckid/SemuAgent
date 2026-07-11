'use client'

import { useMemo, useState } from 'react'
import type { EmployeeDirectoryRow, EmployeeTone } from '@/lib/employee-directory/summary'
import { cn } from '@/lib/utils'
import { EmployeeEditorButton } from './employee-actions'

const toneChipClass: Record<EmployeeTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  accent: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

type StatusFilter = 'all' | 'active' | 'leave' | 'terminated'
type EligibilityFilter = 'all' | 'eligible' | 'excluded'

function Chip({ tone, children }: { readonly tone: EmployeeTone; readonly children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', toneChipClass[tone])}>
      {children}
    </span>
  )
}

export function EmployeeTable({ employees }: { readonly employees: EmployeeDirectoryRow[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees.filter((emp) => {
      if (statusFilter !== 'all' && emp.employeeStatus !== statusFilter) return false
      if (eligibilityFilter !== 'all' && emp.payrollEligibility !== eligibilityFilter) return false
      if (!q) return true
      return [emp.displayName, emp.employeeCode, emp.department]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    })
  }, [employees, query, statusFilter, eligibilityFilter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·사번·부서로 검색"
          className="min-w-[220px] flex-1 rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[13px] text-foreground"
        />
        <Segment
          value={statusFilter}
          onChange={setStatusFilter}
          options={[['all', '전체'], ['active', '재직'], ['leave', '휴직'], ['terminated', '퇴사']]}
        />
        <Segment
          value={eligibilityFilter}
          onChange={setEligibilityFilter}
          options={[['all', '급여 전체'], ['eligible', '대상'], ['excluded', '제외']]}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-company-border bg-company-surface shadow-company-card">
        <table className="w-full min-w-[940px] border-collapse">
          <thead>
            <tr className="border-b border-company-border bg-company-nav-hover text-[11px] font-semibold tracking-[0.02em] text-company-fg-subtle uppercase">
              <th className="px-4 py-2.5 text-left">직원</th>
              <th className="px-4 py-2.5 text-left">부서 · 직책</th>
              <th className="px-4 py-2.5 text-left">재직 상태</th>
              <th className="px-4 py-2.5 text-left">급여 대상</th>
              <th className="px-4 py-2.5 text-left">4대보험 확인</th>
              <th className="px-4 py-2.5 text-left">입사일</th>
              <th className="px-4 py-2.5 text-left">최근 급여</th>
              <th className="px-4 py-2.5 text-left">업무 이메일</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-company-fg-subtle">
                  조건에 맞는 직원이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((emp) => (
                <tr
                  key={emp.id}
                  className={cn(
                    'border-b border-company-border text-[12.5px] last:border-b-0 hover:bg-company-nav-hover',
                    emp.issueLabel && 'bg-[#fffdf5]',
                    emp.employeeStatus === 'terminated' && 'text-company-fg-subtle',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{emp.displayName}</span>
                      {emp.issueLabel ? <span className="rounded border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10.5px] font-bold text-[#d97706]">확인 필요</span> : null}
                    </div>
                    <div className="text-[11px] text-company-fg-subtle">{emp.employeeCode ?? '사번 미지정'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-company-fg-muted">
                    {[emp.department, emp.jobTitle].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2.5"><Chip tone={emp.employeeStatusTone}>{emp.employeeStatusLabel}</Chip></td>
                  <td className="px-4 py-2.5"><Chip tone={emp.payrollEligibility === 'eligible' ? 'accent' : 'muted'}>{emp.payrollEligibilityLabel}</Chip></td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col items-start gap-0.5">
                      <Chip tone={emp.insuranceEnrollmentTone}>{emp.insuranceEnrollmentLabel}</Chip>
                      {emp.insuranceEnrollmentNote ? (
                        <span className="text-[10.5px] text-company-fg-subtle">{emp.insuranceEnrollmentNote}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-company-fg-muted">{emp.hireDate ?? '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-company-fg-muted">{emp.latestPayrollPeriod ?? '—'}</td>
                  <td className="px-4 py-2.5 text-company-fg-muted">{emp.workEmail ?? '이메일 없음'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <EmployeeEditorButton employee={emp} label="수정" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-company-fg-subtle">
        표시 {filtered.length}명 / 전체 {employees.length}명
      </p>
    </div>
  )
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  readonly value: T
  readonly onChange: (next: T) => void
  readonly options: Array<[T, string]>
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-company-border-strong">
      {options.map(([key, label], index) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 text-[12.5px] font-medium',
            index > 0 && 'border-l border-company-border',
            value === key ? 'bg-company-nav-hover font-semibold text-foreground' : 'bg-company-surface text-company-fg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

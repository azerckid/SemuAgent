'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { YearEndReasonCode, YearEndRow } from '@/lib/payment-statements/summary'
import {
  ReviewCell,
  ReviewChip,
  ReviewEmployeeCell,
} from '../../_components/statement-review-ui'

const KRW = new Intl.NumberFormat('ko-KR')

interface YearEndSettlementEmployeeRowProps {
  readonly row: YearEndRow
  readonly defaultExpanded?: boolean
}

export function YearEndSettlementEmployeeRow({ row, defaultExpanded = false }: YearEndSettlementEmployeeRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const detailId = `year-end-detail-${row.employeeKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <>
      <tr>
        <ReviewEmployeeCell name={row.employeeName} code={employeeMeta(row)} />
        <ReviewCell>
          <div className="font-medium text-foreground">{row.workPeriodLabel}</div>
          <div className="mt-0.5 text-[11px] text-company-fg-subtle">{row.workPeriodDetail}</div>
        </ReviewCell>
        <ReviewCell>
          <div className={row.annualGrossPayKrw === null ? 'font-medium text-company-fg-muted' : 'font-semibold tabular-nums text-foreground'}>
            {row.annualGrossPayKrw === null ? '지급합계 확정 전' : `지급 ${KRW.format(row.annualGrossPayKrw)}원`}
          </div>
          <div className="mt-0.5 max-w-[320px] truncate text-[11px] text-company-fg-subtle">{row.payrollSummaryLabel}</div>
        </ReviewCell>
        <ReviewCell>
          <div className="font-medium text-foreground">{row.hometaxCheckLabel}</div>
          <div className="mt-0.5 text-[11px] text-company-fg-subtle">{row.hometaxCheckDetail}</div>
        </ReviewCell>
        <ReviewCell><ReviewChip tone={row.tone}>{row.statusLabel}</ReviewChip></ReviewCell>
        <ReviewCell>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            title={expanded ? '상세 닫기' : '상세 보기'}
            className="inline-flex size-8 items-center justify-center rounded-md border border-company-border bg-company-surface text-company-fg-muted hover:bg-[#f4f4f5]"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            <span className="sr-only">{row.employeeName} {expanded ? '상세 닫기' : '상세 보기'}</span>
          </button>
        </ReviewCell>
      </tr>
      {expanded ? (
        <tr id={detailId}>
          <td colSpan={6} className="border-b border-company-border bg-[#fafafa] p-0">
            <div className="grid lg:grid-cols-3">
              <DetailSection title={row.status === 'payroll_action_required' ? '급여 보완' : '급여 입력값'}>
                {row.annualGrossPayKrw === null ? (
                  <IssueList row={row} />
                ) : (
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs">
                    <DetailAmount label="기본급" value={row.annualBaseSalaryKrw} />
                    <DetailAmount label="기타수당" value={row.annualAllowanceKrw} />
                    <DetailAmount label="비과세 식대" value={row.annualMealAllowanceKrw} />
                    <DetailAmount label="지급합계" value={row.annualGrossPayKrw} strong />
                  </dl>
                )}
              </DetailSection>

              <DetailSection title="보험·기납부세액">
                {row.annualGrossPayKrw === null ? (
                  <p className="text-xs leading-5 text-company-fg-muted">급여를 보완하면 확정 보험료와 기납부세액이 집계됩니다.</p>
                ) : (
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs">
                    <DetailAmount label="국민연금" value={row.annualNationalPensionKrw} />
                    <DetailAmount label="건강보험" value={row.annualHealthInsuranceKrw} />
                    <DetailAmount label="장기요양" value={row.annualLongTermCareKrw} />
                    <DetailAmount label="고용보험" value={row.annualEmploymentInsuranceKrw} />
                    <DetailAmount label="소득세" value={row.annualWithholdingTaxKrw} />
                    <DetailAmount label="지방소득세" value={row.annualLocalIncomeTaxKrw} />
                  </dl>
                )}
              </DetailSection>

              <DetailSection title="홈택스에서 직접 확인" last>
                <div className="space-y-2 text-xs">
                  <CheckRow label="주민등록번호" value="직접 확인" />
                  <CheckRow label="공제신고서" value="제출 여부 확인" />
                  <CheckRow
                    label="종전근무지"
                    value={row.reasonCodes.includes('mid_year_hire') ? '원천징수영수증 확인' : '직접 확인'}
                  />
                  <CheckRow
                    label="중도정산·기타 감면"
                    value={row.reasonCodes.includes('mid_year_termination') ? '최종 반영 확인' : '직접 확인'}
                  />
                </div>
              </DetailSection>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function employeeMeta(row: YearEndRow): string | null {
  const parts = [row.employeeCode, row.employeeStatusLabel]
  return parts.filter(Boolean).join(' · ') || null
}

interface DetailSectionProps {
  readonly title: string
  readonly children: React.ReactNode
  readonly last?: boolean
}

function DetailSection({ title, children, last }: DetailSectionProps) {
  return (
    <section className={`min-w-0 p-4 sm:p-[18px] ${last ? '' : 'border-b border-company-border lg:border-r lg:border-b-0'}`}>
      <h4 className="mb-3 text-xs font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  )
}

interface DetailAmountProps {
  readonly label: string
  readonly value: number | null
  readonly strong?: boolean
}

function DetailAmount({ label, value, strong }: DetailAmountProps) {
  return (
    <>
      <dt className={strong ? 'font-semibold text-foreground' : 'text-company-fg-muted'}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {value === null ? '확정 전' : `${KRW.format(value)}원`}
      </dd>
    </>
  )
}

function IssueList({ row }: { readonly row: YearEndRow }) {
  const employeeIssue = row.reasonCodes.some((code) => EMPLOYEE_REASON_CODES.has(code))
  return (
    <div>
      <ul className="space-y-1.5 text-xs text-company-fg-muted">
        {row.issueLabels.map((issue) => <li key={issue}>· {issue}</li>)}
      </ul>
      <Link
        href={employeeIssue ? '/dashboard/employees' : '/dashboard/payroll'}
        className="mt-3 inline-flex text-xs font-semibold text-[#2563eb] hover:underline"
      >
        {employeeIssue ? '직원 명부 열기' : '급여 열기'}
      </Link>
    </div>
  )
}

const EMPLOYEE_REASON_CODES = new Set<YearEndReasonCode>(['missing_profile', 'missing_hire_date'])

function CheckRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-company-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-company-fg-muted">{label}</span>
      <span className="text-right font-semibold text-[#2563eb]">{value}</span>
    </div>
  )
}

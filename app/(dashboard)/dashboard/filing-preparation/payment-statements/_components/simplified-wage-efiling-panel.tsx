import { ExternalLink } from 'lucide-react'
import {
  HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS,
  HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_URL,
} from '@/lib/efiling-simplified-wage/hometax-guide'
import type { SimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'

const LIST_TONE: Record<string, string> = {
  ok: 'text-[#16a34a]',
  warn: 'text-[#d97706]',
  danger: 'text-[#dc2626]',
  muted: 'text-company-fg-subtle',
}

export function SimplifiedWageEfilingPanel({ efiling }: { readonly efiling: SimplifiedWageEfilingSummary }) {
  const { stats, validationItems, directEntry } = efiling

  return (
    <section
      id="jc-030-direct-entry-panel"
      className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card"
      aria-label="홈택스 직접작성 값 정리"
    >
      <div className="flex flex-col gap-4 border-b border-company-border px-[18px] py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">홈택스 직접작성 값 정리</h3>
          </div>
          <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-company-fg-muted">
            현재 확인된 제출 경로는 홈택스 직접작성입니다. 아래 값은 확정 급여에서 집계했으며,
            SemuAgent가 홈택스에 로그인하거나 대신 입력·제출하지 않습니다.
          </p>
        </div>
        <a
          href={HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold"
        >
          홈택스 열기
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="grid gap-3 border-b border-company-border px-[18px] py-4 sm:grid-cols-2">
        <EfilingStat label="입력값 준비 완료" value={`${stats.readyCount}명`} sub="근무기간·월별 지급액·반기 합계" />
        <EfilingStat label="먼저 확인할 직원" value={`${stats.attentionCount}명`} sub="급여 누락·명부 매칭 확인" />
      </div>

      {stats.periodOpenCount > 0 ? (
        <div className="border-b border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-3 text-[12px] text-[#1e40af]">
          <b>{efiling.context.halfLabel}는 진행 중입니다.</b>{' '}
          아직 오지 않은 월은 누락으로 세지 않으며, 반기 종료 후 직접작성 값이 준비됩니다.
        </div>
      ) : null}

      <div className="border-b border-company-border bg-[#f8fafc] px-[18px] py-4">
        <h4 className="text-[12.5px] font-semibold">홈택스 입력 경로</h4>
        <ol className="mt-2.5 grid gap-2 lg:grid-cols-3">
          {HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS.map((step) => (
            <li key={step.order} className="flex gap-2.5 rounded-lg border border-company-border bg-company-surface px-3 py-2.5 text-[12px] leading-relaxed">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">
                {step.order}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-company-fg-subtle">
          홈택스 메뉴명은 개편될 수 있습니다. 최종 입력 전 현재 홈택스 화면의 항목명을 확인하세요.
        </p>
      </div>

      <div className="border-b border-company-border px-[18px] py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h4 className="text-[13px] font-semibold">사업자·신고기간 값</h4>
          <p className="text-[11.5px] text-company-fg-subtle">홈택스 기본정보 화면에서 확인할 값입니다.</p>
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-2 rounded-[10px] border border-company-border bg-[#fcfcfd] p-3.5 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
          {directEntry.overview.map((row) => (
            <div key={row.id} className="grid grid-cols-[100px_1fr] gap-2">
              <dt className="text-company-fg-subtle">{row.label}</dt>
              <dd className="font-medium text-foreground">
                {row.value}
                {row.note ? <span className="ml-1 font-normal text-company-fg-subtle">({row.note})</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="px-[18px] py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h4 className="text-[13px] font-semibold">소득자별 직접작성 값</h4>
          <p className="text-[11.5px] text-company-fg-subtle">원천징수세액은 간이지급명세서 입력값이 아닙니다.</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-company-border">
          <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
            <thead className="bg-[#fafafa] text-[11px] text-company-fg-subtle">
              <tr>
                <th className="px-3 py-2 font-semibold">소득자</th>
                <th className="px-3 py-2 font-semibold">근무기간</th>
                {efiling.context.halfMonths.map((period) => (
                  <th key={period} className="px-3 py-2 text-right font-semibold">{Number(period.slice(5))}월</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">지급총액</th>
                <th className="px-3 py-2 text-right font-semibold">인정상여</th>
                <th className="px-3 py-2 font-semibold">식별정보</th>
              </tr>
            </thead>
            <tbody>
              {directEntry.employees.length > 0 ? directEntry.employees.map((row) => (
                <tr key={row.employeeKey} className="border-t border-company-border">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.employeeName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-company-fg-muted">{row.workPeriodLabel}</td>
                  {row.monthlyPay.map((month) => (
                    <td key={month.period} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {formatKrw(month.grossPayKrw)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{formatKrw(row.grossPayKrw)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatKrw(row.recognizedBonusKrw)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-company-fg-muted">홈택스에서 직접 입력</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center text-company-fg-muted">
                    직접작성에 옮길 준비 완료 직원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-company-fg-subtle">
          주민등록번호·외국인등록번호는 앱에 저장하지 않습니다. 홈택스 직접작성 화면에서 사용자가 직접 입력합니다.
        </p>
      </div>

      {validationItems.length > 0 ? (
        <div id="jc-030-validation-results" className="border-t border-company-border bg-[#fffbeb] px-[18px] py-3.5">
          <h4 className="text-[12.5px] font-semibold text-[#92400e]">직접작성 전에 확인</h4>
          <ul className="mt-2 space-y-1 text-[12px]">
            {validationItems.map((item) => (
              <li key={item.id} className={LIST_TONE[item.tone]}>
                {item.employeeName ? <><b>{item.employeeName}</b>{' — '}{item.message}</> : item.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-company-border bg-[#f8fafc] px-[18px] py-3.5 text-[12px] leading-relaxed text-company-fg-muted">
        <b className="text-foreground">책임 경계</b>
        {' — '}
        이 화면은 홈택스 직접작성에 옮길 값을 정리합니다. 파일 생성·자동 입력·자동 제출·대리 신고는 제공하지 않습니다.
      </div>
    </section>
  )
}

function EfilingStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2.5">
      <p className="text-[11px] font-medium text-company-fg-subtle">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      <p className="text-[11px] text-company-fg-subtle">{sub}</p>
    </div>
  )
}

function formatKrw(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
}

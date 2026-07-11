import Link from 'next/link'
import type { WithholdingEfilingSummary } from '@/lib/efiling-withholding/summary'

const LIST_TONE: Record<string, string> = {
  ok: 'text-[#16a34a]',
  warn: 'text-[#d97706]',
  danger: 'text-[#dc2626]',
  muted: 'text-company-fg-subtle',
}

const STAT_SUB = 'text-[11px] text-company-fg-subtle'

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

export function WithholdingEfilingPanel({ efiling }: { readonly efiling: WithholdingEfilingSummary }) {
  const { stats, formatChecks, validationItems, a01 } = efiling

  return (
    <section
      id="jc-030-withholding-efiling-panel"
      className="overflow-hidden rounded-xl border border-[#ddd6fe] bg-gradient-to-b from-[#faf5ff] to-company-surface shadow-company-card"
      aria-label="원천징수이행상황신고서 직접입력 정리 패널"
    >
      <div className="flex flex-col gap-4 border-b border-[#e9e5ff] px-[18px] py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">원천징수이행상황신고서 직접입력 정리</h3>
          <p className="mt-1 max-w-[720px] text-[12.5px] leading-relaxed text-company-fg-muted">
            {efiling.payrollLabel} A01 간이세액 집계는 공식 비암호화 업로드 양식이 없어
            확정값을 <b className="font-semibold text-foreground">항목 = 값</b>으로 정리합니다.
            아래 값을 홈택스 원천세 신고 화면에 직접 입력해 주세요.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href="#jc-030-withholding-validation-results"
            className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold"
          >
            검증 결과 보기
          </a>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#e9e5ff] px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-4">
        <EfilingStat label="A01 확정 인원" value={`${a01.employeeCount}명`} sub={`확정 라인 ${stats.confirmedCount}명`} />
        <EfilingStat label="A01 총지급액" value={formatKrw(a01.grossPayKrw)} sub="별지 제21호 ⑤" />
        <EfilingStat label="A01 소득세 등" value={formatKrw(a01.incomeTaxKrw)} sub="별지 제21호 ⑥" />
        <EfilingStat label="지방소득세 (참고)" value={formatKrw(efiling.localIncomeTaxKrw)} sub="위택스 특별징수 별도 신고" />
      </div>

      <div className="grid gap-4 px-[18px] py-4 lg:grid-cols-2">
        <div className="rounded-[10px] border border-company-border bg-company-surface p-3.5">
          <h4 className="text-[13px] font-semibold">제공 경로 상태</h4>
          <ul className="mt-2.5 space-y-1.5 text-[12.5px]">
            {formatChecks.map((item) => (
              <li key={item.id} className={LIST_TONE[item.tone] ?? LIST_TONE.muted}>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div id="jc-030-withholding-validation-results" className="rounded-[10px] border border-company-border bg-company-surface p-3.5">
          <h4 className="text-[13px] font-semibold">사전검증 결과</h4>
          {validationItems.length === 0 ? (
            <p className="mt-2.5 text-[12.5px] text-company-fg-muted">검증할 급여 데이터가 없습니다.</p>
          ) : (
            <ul className="mt-2.5 space-y-1.5 text-[12.5px]">
              {validationItems.map((item) => (
                <li key={item.id} className={LIST_TONE[item.tone]}>
                  {item.employeeName ? (
                    <>
                      <span className="font-semibold">{item.employeeName}</span>
                      {' — '}
                      {item.message}
                    </>
                  ) : (
                    item.message
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-[#e9e5ff] px-[18px] py-4">
        <h4 className="text-[13px] font-semibold text-foreground">직접입력 안내</h4>
        <p className="mt-2.5 text-[12px] text-company-fg-muted">
          위 값을 홈택스 원천세 신고 화면에 직접 입력한 뒤 제출하세요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/payroll?period=${efiling.payrollPeriodKey}`}
            className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-company-nav-hover"
          >
            급여 열기
          </Link>
        </div>
      </div>

      <div className="border-t border-[#e9e5ff] bg-[#faf5ff] px-[18px] py-3.5 text-[12px] leading-relaxed text-[#4c1d95]">
        <b className="text-[#3b0764]">책임 경계</b>
        {' — '}
        본 기능은 A01 서식 집계·직접입력 정리(1b)까지입니다.
        홈택스 메뉴·입력칸 위치 단계별 안내, 자동 신고, 「국세청 검증 완료」 표시는 제공하지 않습니다.
        {efiling.businessRegistrationMasked ? (
          <>
            {' '}
            사업자등록번호: {efiling.businessRegistrationMasked}
          </>
        ) : null}
      </div>
    </section>
  )
}

function EfilingStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] border border-[#e9e5ff] bg-company-surface px-3 py-2.5">
      <p className={`${STAT_SUB} font-medium`}>{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight">{value}</p>
      <p className={STAT_SUB}>{sub}</p>
    </div>
  )
}

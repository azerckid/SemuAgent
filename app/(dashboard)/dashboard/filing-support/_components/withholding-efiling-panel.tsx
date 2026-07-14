import Link from 'next/link'
import type { WithholdingEfilingSummary } from '@/lib/efiling-withholding/summary'
import {
  FilingPortalGuide,
  type FilingPortalGuideItem,
} from '../../filing-preparation/_components/filing-portal-guide'

const LIST_TONE: Record<string, string> = {
  ok: 'text-[#16a34a]',
  warn: 'text-[#d97706]',
  danger: 'text-[#dc2626]',
  muted: 'text-company-fg-subtle',
}

const HOMETAX_WITHHOLDING_PATH = '세금신고 → 원천세 신고 → 일반 신고 → 정기신고'
const HOMETAX_URL = 'https://www.hometax.go.kr/'
const WETAX_LOCAL_INCOME_TAX_URL = 'https://www.wetax.go.kr/etr/lit/b0701/B070101M00.do'

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

export function WithholdingEfilingPanel({ efiling }: { readonly efiling: WithholdingEfilingSummary }) {
  const { validationItems, a01 } = efiling
  const portalItems: FilingPortalGuideItem[] = [
    {
      portal: 'hometax',
      scopeLabel: '원천세 · 근로소득 간이세액(A01)',
      readiness: 'ready',
      preparedValueLabel: '확정 인원·총지급액·소득세와 신고서 입력 위치',
      userActionLabel: '홈택스에서 값을 확인·입력한 뒤 제출',
      externalHref: HOMETAX_URL,
    },
    {
      portal: 'wetax',
      scopeLabel: '지방소득세 특별징수',
      readiness: 'source_pending',
      preparedValueLabel: `확정 지방소득세 ${formatKrw(efiling.localIncomeTaxKrw)} · 신고기간`,
      userActionLabel: '위택스에서 신고·제출',
      externalHref: WETAX_LOCAL_INCOME_TAX_URL,
    },
  ]

  return (
    <>
      <section
        id="jc-030-withholding-efiling-panel"
        className="overflow-hidden rounded-xl border border-[#ddd6fe] bg-company-surface shadow-company-card"
        aria-label="원천징수이행상황신고서 홈택스 직접입력 안내"
      >
        <div className="border-b border-company-border px-[18px] py-4">
          <h2 className="text-[15px] font-semibold text-foreground">홈택스 원천세 입력 안내</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            아래 경로를 연 뒤, 표에 표시된 위치에 확정값을 입력하세요.
          </p>
        </div>

        <div className="border-b border-company-border bg-[#f8fafc] px-[18px] py-3.5">
          <p className="text-[11px] font-semibold text-company-fg-subtle">홈택스 이동 경로</p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">{HOMETAX_WITHHOLDING_PATH}</p>
          <p className="mt-1 text-[11px] text-company-fg-subtle">
            2026년 7월 홈택스 화면 기준이며, 메뉴명은 홈택스 개편에 따라 달라질 수 있습니다.
          </p>
        </div>

        <div className="overflow-x-auto border-b border-company-border px-[18px] py-4">
          <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-[12.5px]">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[46%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-company-border text-[11px] text-company-fg-subtle">
                <th className="px-3 py-2 font-semibold">홈택스 화면</th>
                <th className="px-3 py-2 font-semibold">입력 위치</th>
                <th className="px-3 py-2 font-semibold">입력·확인할 값</th>
              </tr>
            </thead>
            <tbody>
              <InputGuideRow screen="기본정보" field="① 신고구분" value="매월" />
              <InputGuideRow screen="기본정보" field="② 귀속연월" value={efiling.payrollLabel.replace(' 귀속', '')} />
              <InputGuideRow
                screen="기본정보"
                field="③ 지급연월"
                value={efiling.paymentLabel}
                needsReview={!efiling.paymentPeriodKey}
              />
              <InputGuideRow
                screen="기본정보"
                field="사업자"
                value={[efiling.businessName, efiling.representativeName, efiling.businessRegistrationMasked].filter(Boolean).join(' · ')}
              />
              <InputGuideRow screen="원천징수이행상황신고서" field="근로소득 → 간이세액(A01) → ④ 인원" value={`${a01.employeeCount}명`} />
              <InputGuideRow screen="원천징수이행상황신고서" field="근로소득 → 간이세액(A01) → ⑤ 총지급액" value={formatKrw(a01.grossPayKrw)} />
              <InputGuideRow screen="원천징수이행상황신고서" field="근로소득 → 간이세액(A01) → ⑥ 소득세 등" value={formatKrw(a01.incomeTaxKrw)} />
            </tbody>
          </table>
        </div>

        <div className="px-[18px] py-4">
          <div id="jc-030-withholding-validation-results" className="rounded-lg border border-company-border p-3.5">
            <h3 className="text-[13px] font-semibold">입력 전 확인</h3>
            {validationItems.length === 0 ? (
              <p className="mt-2.5 text-[12.5px] text-company-fg-muted">검증할 급여 데이터가 없습니다.</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5 text-[12.5px]">
                {validationItems.map((item) => (
                  <li key={item.id} className={LIST_TONE[item.tone]}>
                    {item.employeeName ? <><span className="font-semibold">{item.employeeName}</span>{' — '}{item.message}</> : item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-company-border px-[18px] py-4">
          <p className="text-[11.5px] text-company-fg-subtle">
            입력·제출·납부는 사용자가 홈택스에서 직접 진행합니다. 로그인 정보 저장·자동 입력은 제공하지 않습니다.
          </p>
          <Link
            href={`/dashboard/payroll?period=${efiling.payrollPeriodKey}`}
            className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-company-nav-hover"
          >
            급여 열기
          </Link>
        </div>
      </section>

      <FilingPortalGuide items={portalItems} />
    </>
  )
}

function InputGuideRow({
  screen,
  field,
  value,
  needsReview = false,
}: {
  readonly screen: string
  readonly field: string
  readonly value: string
  readonly needsReview?: boolean
}) {
  return (
    <tr className="border-b border-company-border last:border-b-0">
      <td className="px-3 py-2.5 text-company-fg-muted">{screen}</td>
      <td className="px-3 py-2.5 font-medium text-foreground">{field}</td>
      <td className={`px-3 py-2.5 font-semibold tabular-nums ${needsReview ? 'text-[#d97706]' : 'text-[#2563eb]'}`}>
        {value}
      </td>
    </tr>
  )
}

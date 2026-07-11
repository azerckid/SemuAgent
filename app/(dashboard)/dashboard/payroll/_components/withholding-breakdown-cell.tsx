'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

// 급여대장 원천세 금액을 클릭하면 소득세·지방소득세 구성과 출처를 보여준다.
// 표시값은 급여자료의 확정값(세액표 기준 산정)이며, 이 앱이 다시 계산하지 않는다.
// withholdingTaxKrw = incomeTaxKrw + localIncomeTaxKrw (lib/payroll-workspace/summary.ts) 이므로
// 팝오버 합계는 셀에 표시된 원천세 금액과 항상 일치한다.
export function WithholdingBreakdownCell({
  incomeTaxKrw,
  localIncomeTaxKrw,
  withholdingTaxKrw,
  strong = false,
}: {
  readonly incomeTaxKrw: number
  readonly localIncomeTaxKrw: number
  readonly withholdingTaxKrw: number
  readonly strong?: boolean
}) {
  return (
    <td className={cn('px-3.5 py-2.5 text-right text-[12.5px] whitespace-nowrap tabular-nums')}>
      <Popover>
        <PopoverTrigger
          className={cn(
            'rounded-[4px] text-[#dc2626] underline decoration-dotted decoration-[#dc2626]/40 underline-offset-4 outline-none transition-colors hover:decoration-[#dc2626] focus-visible:ring-2 focus-visible:ring-[#dc2626]/30',
            strong && 'font-bold',
          )}
          aria-label={`원천세 ${formatKrw(withholdingTaxKrw)} 구성 보기`}
        >
          {withholdingTaxKrw.toLocaleString('ko-KR')}
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-64 gap-0 text-left">
          <p className="text-[12.5px] font-semibold text-foreground">원천세 구성</p>
          <div className="mt-1.5">
            <BreakdownRow label="소득세" value={incomeTaxKrw} />
            <BreakdownRow label="지방소득세" value={localIncomeTaxKrw} />
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-company-border pt-1.5">
            <span className="text-[12px] font-semibold text-foreground">합계</span>
            <span className="text-[13px] font-bold tabular-nums text-[#dc2626]">{formatKrw(withholdingTaxKrw)}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-company-fg-subtle">
            출처: 급여자료 확정값(세액표 기준 산정). 지방소득세는 지방세로 별도 신고합니다.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-company-fg-subtle">
            부양가족 공제 최종금액은 연말정산에서 확정됩니다.
          </p>
        </PopoverContent>
      </Popover>
    </td>
  )
}

function BreakdownRow({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-company-fg-muted">
        {label}
        <span className="ml-1.5 text-[10.5px] text-company-fg-subtle">업로드 자료</span>
      </span>
      <span className="font-medium tabular-nums text-foreground">{formatKrw(value)}</span>
    </div>
  )
}

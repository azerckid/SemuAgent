'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatKrw(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

// 고용형태별 원천세 산출 근거. 정규직만 근로소득 간이세액표(별표2) 조회이며,
// 프리랜서·일용직은 각각 사업소득 3.3%·일용근로소득 산식이라 문구를 분리한다.
type TaxBasis = {
  itemSource: string
  sourceNote: string
  footerNote: string
}

function resolveTaxBasis(jobType: string | null | undefined, dependentCount: number | null | undefined): TaxBasis {
  if (jobType === '정규직') {
    const dep = dependentCount && dependentCount > 0 ? `공제대상가족 ${dependentCount}명 기준` : '간이세액표 기준'
    return {
      itemSource: '간이세액표',
      sourceNote: `출처: 근로소득 간이세액표(별표2) 조회값 · ${dep}. 지방소득세는 지방세로 별도 신고합니다.`,
      footerNote: '부양가족 공제 최종금액은 연말정산에서 확정됩니다.',
    }
  }
  if (jobType === '프리랜서') {
    return {
      itemSource: '사업소득 3.3%',
      sourceNote: '출처: 사업소득 원천징수 3.3%(소득세 3% + 지방소득세 0.3%).',
      footerNote: '사업소득은 5월 종합소득세 신고에서 정산됩니다.',
    }
  }
  if (jobType === '일용직') {
    return {
      itemSource: '일용근로 산식',
      sourceNote: '출처: 일용근로소득 산식 (일급 − 150,000) × 2.7%. 지방소득세는 지방세로 별도 신고합니다.',
      footerNote: '일용근로소득은 원천징수로 분리과세 종결됩니다.',
    }
  }
  return {
    itemSource: '급여자료',
    sourceNote: '출처: 급여자료 확정값. 지방소득세는 지방세로 별도 신고합니다.',
    footerNote: '고용형태별 산출 근거는 각 직원 행에서 확인할 수 있습니다.',
  }
}

// 급여대장 원천세 금액을 클릭하면 소득세·지방소득세 구성과 출처를 보여준다.
// withholdingTaxKrw = incomeTaxKrw + localIncomeTaxKrw (lib/payroll-workspace/summary.ts) 이므로
// 팝오버 합계는 셀에 표시된 원천세 금액과 항상 일치한다.
export function WithholdingBreakdownCell({
  incomeTaxKrw,
  localIncomeTaxKrw,
  withholdingTaxKrw,
  jobType,
  dependentCount,
  strong = false,
}: {
  readonly incomeTaxKrw: number
  readonly localIncomeTaxKrw: number
  readonly withholdingTaxKrw: number
  readonly jobType?: string | null
  readonly dependentCount?: number | null
  readonly strong?: boolean
}) {
  const basis = resolveTaxBasis(jobType, dependentCount)
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
            <BreakdownRow label="소득세" value={incomeTaxKrw} source={basis.itemSource} />
            <BreakdownRow label="지방소득세" value={localIncomeTaxKrw} source={basis.itemSource === '급여자료' ? '급여자료' : '소득세의 10%'} />
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-company-border pt-1.5">
            <span className="text-[12px] font-semibold text-foreground">합계</span>
            <span className="text-[13px] font-bold tabular-nums text-[#dc2626]">{formatKrw(withholdingTaxKrw)}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-company-fg-subtle">
            {basis.sourceNote}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-company-fg-subtle">
            {basis.footerNote}
          </p>
        </PopoverContent>
      </Popover>
    </td>
  )
}

function BreakdownRow({ label, value, source }: { readonly label: string; readonly value: number; readonly source: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-company-fg-muted">
        {label}
        <span className="ml-1.5 text-[10.5px] text-company-fg-subtle">{source}</span>
      </span>
      <span className="font-medium tabular-nums text-foreground">{formatKrw(value)}</span>
    </div>
  )
}

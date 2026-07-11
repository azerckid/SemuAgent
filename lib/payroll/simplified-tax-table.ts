import { z } from 'zod'

// 근로소득 간이세액표(소득세법 시행령 별표2) 직접 조회 엔진.
//
// 이 앱은 세액을 자체 산식으로 추정하지 않고, 국세청이 공표한 간이세액표의 실제
// 세액을 "월급여액 구간 × 공제대상가족수"로 조회한다(정규직 근로소득 원천징수).
// 조회값은 법령 원문과 1:1로 대조 검증할 수 있어, 하드코딩한 임의 금액을 없앤다.
//
// 근거: 소득세법 시행령 [별표2] 근로소득 간이세액표 (개정 2024. 2. 29., 제189조제1항 관련)
//   https://www.law.go.kr/  (별표2 근로소득 간이세액표)
// 적용: 2026년 지급분(2026.2.27 개정은 8~20세 자녀세액공제 금액을 조정했을 뿐,
//   자녀공제 전 월급여·공제대상가족수별 기본 간이세액은 동일하다). 자녀공제 규칙은
//   2024.2.29 개정 기준이며, 샘플 데이터는 자녀수 0으로 두어 이 분기를 사용하지 않는다.
// 범위: 아래 BRACKETS에 담긴 급여 구간만 조회 가능(현재 샘플 급여 구간 한정).
//   구간 밖 조회는 { inRange: false }로 반환하며 임의 추정하지 않는다.
export const SIMPLIFIED_TAX_TABLE_META = {
  law: '소득세법 시행령 별표2 근로소득 간이세액표',
  revision: '2024-02-29',
  appliesFrom: '2026-03-01',
  source: 'https://www.law.go.kr/ (별표2 근로소득 간이세액표)',
  note: '자녀세액공제 전 기본 간이세액. 공제대상가족수는 본인·배우자 각 1명 포함.',
} as const

// 월급여액(비과세 제외) 구간별 공제대상가족수 1~11명 간이세액(원). '-'(비과세)은 0으로 둔다.
// 각 행은 [minKrw, maxKrw) 구간이며 별표2 조견표의 실제 공표 세액이다.
type SimplifiedTaxBracket = {
  minKrw: number
  maxKrw: number
  taxByDependents: readonly [number, number, number, number, number, number, number, number, number, number, number]
}

const BRACKETS: readonly SimplifiedTaxBracket[] = [
  { minKrw: 2_400_000, maxKrw: 2_410_000, taxByDependents: [32_380, 25_380, 14_530, 11_160, 7_780, 4_410, 1_030, 0, 0, 0, 0] },
  { minKrw: 2_800_000, maxKrw: 2_810_000, taxByDependents: [56_800, 39_300, 25_180, 19_930, 16_130, 12_760, 9_380, 6_010, 2_630, 0, 0] },
  { minKrw: 3_000_000, maxKrw: 3_020_000, taxByDependents: [74_350, 56_850, 31_940, 26_690, 21_440, 17_100, 13_730, 10_350, 6_980, 3_600, 0] },
  { minKrw: 3_600_000, maxKrw: 3_620_000, taxByDependents: [139_440, 114_440, 70_280, 57_160, 44_030, 35_510, 30_260, 25_010, 19_760, 16_020, 12_650] },
  { minKrw: 4_400_000, maxKrw: 4_420_000, taxByDependents: [249_360, 221_050, 158_490, 139_740, 120_990, 102_240, 86_530, 73_400, 60_280, 47_150, 36_760] },
  { minKrw: 6_000_000, maxKrw: 6_020_000, taxByDependents: [505_900, 466_060, 395_720, 376_970, 358_220, 339_470, 320_720, 301_970, 283_220, 264_470, 245_720] },
]

export const simplifiedTaxLookupInputSchema = z.object({
  monthlyTaxableSalaryKrw: z.number().int().nonnegative(),
  // 공제대상가족수(본인 포함). 1 이상.
  dependentCount: z.number().int().min(1),
  // 8~20세 자녀수(자녀세액공제 대상). 기본 0.
  childCountUnder20: z.number().int().nonnegative().default(0),
  // 원천징수 선택 비율(80/100/120). 기본 100.
  withholdingRatePercent: z.union([z.literal(80), z.literal(100), z.literal(120)]).default(100),
})

export type SimplifiedTaxLookupInput = z.input<typeof simplifiedTaxLookupInputSchema>

export type SimplifiedTaxLookupResult =
  | {
      inRange: true
      incomeTaxKrw: number
      localIncomeTaxKrw: number
      baseTaxKrw: number
      childDeductionKrw: number
      dependentCount: number
      bracket: { minKrw: number; maxKrw: number }
    }
  | { inRange: false }

const floorToTen = (value: number) => Math.floor(value / 10) * 10

// 별표2 제3호 자녀세액공제(8~20세): 1명 12,500 / 2명 29,160 / 3명 이상 29,160 + 2명 초과 1명당 25,000.
function childTaxDeductionKrw(childCountUnder20: number): number {
  if (childCountUnder20 <= 0) return 0
  if (childCountUnder20 === 1) return 12_500
  if (childCountUnder20 === 2) return 29_160
  return 29_160 + (childCountUnder20 - 2) * 25_000
}

// 별표2 제4호: 공제대상가족수 11명 초과 시 11명 세액 − (10명 세액 − 11명 세액) × 초과수.
function baseTaxForDependents(bracket: SimplifiedTaxBracket, dependentCount: number): number {
  if (dependentCount <= 11) return bracket.taxByDependents[dependentCount - 1]
  const tax10 = bracket.taxByDependents[9]
  const tax11 = bracket.taxByDependents[10]
  return Math.max(0, tax11 - (tax10 - tax11) * (dependentCount - 11))
}

export function lookupSimplifiedIncomeTax(rawInput: SimplifiedTaxLookupInput): SimplifiedTaxLookupResult {
  const input = simplifiedTaxLookupInputSchema.parse(rawInput)
  const bracket = BRACKETS.find(
    (b) => input.monthlyTaxableSalaryKrw >= b.minKrw && input.monthlyTaxableSalaryKrw < b.maxKrw,
  )
  if (!bracket) return { inRange: false }

  const baseTaxKrw = baseTaxForDependents(bracket, input.dependentCount)
  const childDeductionKrw = childTaxDeductionKrw(input.childCountUnder20)
  const adjustedKrw = Math.max(0, baseTaxKrw - childDeductionKrw)
  const incomeTaxKrw = floorToTen((adjustedKrw * input.withholdingRatePercent) / 100)
  const localIncomeTaxKrw = floorToTen(incomeTaxKrw / 10)

  return {
    inRange: true,
    incomeTaxKrw,
    localIncomeTaxKrw,
    baseTaxKrw,
    childDeductionKrw,
    dependentCount: input.dependentCount,
    bracket: { minKrw: bracket.minKrw, maxKrw: bracket.maxKrw },
  }
}

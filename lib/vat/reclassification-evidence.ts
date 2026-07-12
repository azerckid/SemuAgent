import { z } from 'zod'

// 부가세 매입 재분류 신뢰도 판정 — 접대비 → 복리후생비/회의비 (JC-041 VAI-9a, v2).
//
// 이 함수는 이미 추출된 구조화 신호(참석자 명단·적요 텍스트·과거 확정 이력)를 받아
// 재분류 후보의 신뢰도를 매기는 순수 함수다. 신호를 원문에서 뽑아내는 작업(적요
// 파싱, 과거 이력 조회, 직원명부 조회)은 VAI-9b evidence resolver의 몫이며, 이
// 함수는 그 결과를 입력으로 받는다.
//
// 근거: Brief 51 §4(v2). 핵심 원칙은 "후보는 넓게, 확정은 엄격하게"다 —
// 이 함수는 절대 후보를 완전히 배제(hide)하지 않는다. 참석자 정보가 없거나
// 부정적 신호가 있어도 신뢰도(confidence)를 낮출 뿐이며, 항상 등급과 발견된
// 요인(factors), 확정에 필요한 부족한 자료(missingToConfirm)를 함께 반환한다.
// 실제로 공제로 전환하는 것을 막는 엄격한 게이트는 이 함수가 아니라 사용자
// 확정 흐름(Brief 51 §5, VAI-9e)에 있다.
//
// 1차 범위: 법정 불공제 사유 ④ 접대비(기업업무추진비)만 다룬다(Brief 51 §2.1).

export const RECLASSIFICATION_CONFIDENCE_TIERS = ['high', 'medium', 'low'] as const
export type ReclassificationConfidenceTier = (typeof RECLASSIFICATION_CONFIDENCE_TIERS)[number]

export const RECLASSIFICATION_TARGET_CATEGORIES = ['welfare_expense', 'meeting_expense'] as const
export type ReclassificationTargetCategory = (typeof RECLASSIFICATION_TARGET_CATEGORIES)[number]

export const reclassificationEvidenceInputSchema = z.object({
  // 거래 적요/메모 원문(vat_deduction_review.description + staffMemo 결합, Brief 51
  // §4.5). 없으면 빈 문자열.
  memoText: z.string().default(''),
  // 적요·거래처 데이터에서 식별된 거래처명. 없으면 null.
  counterpartyName: z.string().nullable().default(null),
  // 적요 등에서 파싱된 참석자 이름 목록. 파싱 불가/정보 없음이면 반드시 null을 준다
  // (빈 배열을 "참석자 0명 확인"의 의미로 쓰지 않는다).
  attendeeNames: z.array(z.string()).nullable().default(null),
  // 같은 tenant·사업장의 활성 직원 표시 이름(대조용).
  employeeDisplayNames: z.array(z.string()).default([]),
  // 거래 금액(원 단위, 절사 전).
  amountKrw: z.number().int().nonnegative(),
  // 반복적인 소액 식대로 볼 수 있는 상한선(원). 법정 기준이 아니라 운영
  // 임계값이며 실제 데이터로 VAI-9b에서 재조정한다.
  largeAmountThresholdKrw: z.number().int().positive().default(500_000),
  // 같은 tenant에서 유사 패턴(동일 거래처·비슷한 금액대·정기 주기) 거래에 대한
  // 사용자의 과거 확정 이력. 강한 증거가 아니라 약한 참고 신호로만 쓴다(Brief 51
  // §4.3). 없으면 null.
  pastUserDecisionForSimilarPattern: z
    .enum(['reclassified_as_benefit', 'kept_as_entertainment'])
    .nullable()
    .default(null),
})

export type ReclassificationEvidenceInput = z.input<typeof reclassificationEvidenceInputSchema>

export const RECLASSIFICATION_FACTOR_TYPES = [
  'attendees_all_internal',
  'internal_event_keyword',
  'historical_pattern_benefit',
  'external_counterparty_named',
  'attendees_unknown',
  'large_amount',
  'historical_pattern_entertainment',
] as const

export type ReclassificationFactorType = (typeof RECLASSIFICATION_FACTOR_TYPES)[number]

export type ReclassificationFactor = {
  type: ReclassificationFactorType
  // 재분류를 뒷받침하는 가산 요인인지, 불리하지만 후보를 없애지는 않는 감산
  // 요인인지(Brief 51 §4.1).
  direction: 'supports' | 'weakens'
  summary: string
}

export type ReclassificationEvaluation = {
  confidence: ReclassificationConfidenceTier
  // 가산 요인이 하나도 없으면 방향을 추천하지 않는다(null) — 등급은 여전히
  // 매기지만 "복리후생비"인지 "회의비"인지 근거 없이 찍지 않는다.
  suggestedCategory: ReclassificationTargetCategory | null
  factors: ReclassificationFactor[]
  // 확정(공제 전환)하려면 사용자가 보완해야 할 자료 목록(Brief 51 §5).
  missingToConfirm: string[]
}

// 아래 두 키워드 목록은 법령 기준이 아니라 초기 휴리스틱이다. 실제 적요 데이터로
// VAI-9b에서 검증·조정한다.
const INTERNAL_EVENT_KEYWORDS = ['회식', '워크샵', '워크숍', '전 직원', '전직원', '팀 미팅', '팀미팅', '내부 행사', '단합']
// "대표·이사·팀장"은 의도적으로 제외했다 — 내부 직원의 직함이기도 해서(예: 샘플의
// "김대표"), 내부 회식 적요에 "대표님과 회식"처럼 쓰이면 정당한 절세 건을 감점
// 처리해버린다. 참석자 명단 대조가 더 신뢰할 수 있는 내부/외부 판별 신호이므로,
// 내부 직함과 겹치지 않는 표현만 감산 요인으로 쓴다(Brief 51 §4.4).
const EXTERNAL_COUNTERPARTY_KEYWORDS = ['거래처', '고객사', '바이어']
const CORPORATE_SUFFIX_PATTERN = /(주식회사|㈜|\(주\)|상사|물산|기업|산업)/

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function attendeesAllInternal(attendeeNames: string[], employeeDisplayNames: string[]): boolean {
  if (attendeeNames.length === 0) return false
  const employeeSet = new Set(employeeDisplayNames.map(normalize))
  return attendeeNames.every((name) => employeeSet.has(normalize(name)))
}

function memoMentionsInternalEvent(memoText: string): boolean {
  const normalized = normalize(memoText)
  return INTERNAL_EVENT_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))
}

function memoMentionsExternalCounterparty(memoText: string, counterpartyName: string | null): boolean {
  const normalized = normalize(memoText)
  if (EXTERNAL_COUNTERPARTY_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))) return true
  if (counterpartyName && CORPORATE_SUFFIX_PATTERN.test(counterpartyName)) return true
  return false
}

// 가산 요인은 강도에 따라 2점(강) 또는 1점(중/약), 감산 요인은 전부 -1점으로
// 합산한다. 점수 자체는 법정 기준이 아니라 등급을 매기기 위한 내부 장치이며,
// 결과(factors)는 항상 원문 그대로 노출해 사용자가 점수가 아니라 근거를 보게 한다.
function confidenceFromScore(score: number): ReclassificationConfidenceTier {
  if (score >= 2) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

export function evaluateReclassificationCandidate(
  rawInput: ReclassificationEvidenceInput,
): ReclassificationEvaluation {
  const input = reclassificationEvidenceInputSchema.parse(rawInput)

  const factors: ReclassificationFactor[] = []
  const missingToConfirm: string[] = []
  let score = 0

  // --- 가산 요인 ---
  const attendeesKnownAllInternal = input.attendeeNames !== null
    && attendeesAllInternal(input.attendeeNames, input.employeeDisplayNames)
  if (attendeesKnownAllInternal) {
    factors.push({
      type: 'attendees_all_internal',
      direction: 'supports',
      summary: '참석자 전원이 내부 직원 명단과 일치합니다.',
    })
    score += 2
  }

  if (memoMentionsInternalEvent(input.memoText)) {
    factors.push({
      type: 'internal_event_keyword',
      direction: 'supports',
      summary: '적요에 내부 행사를 특정하는 표현이 있습니다.',
    })
    score += 1
  }

  if (input.pastUserDecisionForSimilarPattern === 'reclassified_as_benefit') {
    factors.push({
      type: 'historical_pattern_benefit',
      direction: 'supports',
      summary: '같은 tenant에서 유사 패턴 거래를 복리후생비·회의비로 재분류 확정한 이력이 있습니다(참고용).',
    })
    score += 1
  }

  // --- 감산 요인(후보를 없애지 않음, Brief 51 §0.1) ---
  // 참석자 정보 없음은 "적극적으로 불리한 증거"가 아니라 "아직 확인 안 된 정보"다
  // — 점수를 깎지 않고 factors·missingToConfirm에만 남긴다. 예를 들어 내부 행사
  // 키워드만 있고 참석자 명단이 없는 흔한 경우가, 정보 부재 때문에 이중으로
  // 감점돼 등급이 부당하게 낮아지지 않도록 한다.
  if (input.attendeeNames === null) {
    factors.push({
      type: 'attendees_unknown',
      direction: 'weakens',
      summary: '참석자 정보가 없어 내부/외부 여부를 확인할 수 없습니다.',
    })
    missingToConfirm.push('참석자 명단(전원 내부 직원인지 확인)')
  }

  if (input.amountKrw > input.largeAmountThresholdKrw) {
    factors.push({
      type: 'large_amount',
      direction: 'weakens',
      summary: `금액(${input.amountKrw.toLocaleString('ko-KR')}원)이 반복적인 소액 식대 패턴보다 큽니다.`,
    })
    missingToConfirm.push('고액 지출의 업무 목적 소명 자료')
    score -= 1
  }

  if (memoMentionsExternalCounterparty(input.memoText, input.counterpartyName)) {
    factors.push({
      type: 'external_counterparty_named',
      direction: 'weakens',
      summary: '적요 또는 거래처명에 외부 거래처를 시사하는 표현이 있습니다.',
    })
    missingToConfirm.push('내부 행사였음을 뒷받침하는 근거')
    score -= 1
  }

  if (input.pastUserDecisionForSimilarPattern === 'kept_as_entertainment') {
    factors.push({
      type: 'historical_pattern_entertainment',
      direction: 'weakens',
      summary: '같은 tenant에서 유사 패턴 거래를 접대비로 유지 확정한 이력이 있습니다(참고용).',
    })
    score -= 1
  }

  // 확정에는 적격증빙 확인이 항상 필요하다(Brief 51 §5) — 신뢰도와 무관하게 공통.
  missingToConfirm.push('적격증빙 확인 및 사용자 최종 확정')

  const suggestedCategory: ReclassificationTargetCategory | null = factors.some(
    (factor) => factor.direction === 'supports',
  )
    ? (factors.some((f) => f.type === 'attendees_all_internal' || f.type === 'historical_pattern_benefit')
      ? 'welfare_expense'
      : 'meeting_expense')
    : null

  return {
    confidence: confidenceFromScore(score),
    suggestedCategory,
    factors,
    missingToConfirm,
  }
}

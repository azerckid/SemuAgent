import { and, eq, ne } from 'drizzle-orm'
import { bookkeepingTransactionClassification, employeeProfile, vatDeductionReview } from '@/lib/db/schema'
import {
  evaluateReclassificationCandidate,
  type ReclassificationEvaluation,
} from './reclassification-evidence'

// JC-041 VAI-9b (v2): 실제 데이터에서 재분류 신뢰도 평가 신호를 뽑아 VAI-9a
// 판정 함수(evaluateReclassificationCandidate)에 넘긴다. 1차 범위(Brief 51 §2.1)는
// 접대비(기업업무추진비)로 분류된 불공제 후보만 다룬다.
//
// 핵심 원칙(Brief 51 §0.1): 후보는 넓게, 확정은 엄격하게. 이 모듈은 범위 안의
// 접대비 불공제 후보를 절대 배제하지 않는다 — 참석자 정보가 없거나 감산 요인이
// 있어도 신뢰도만 낮아질 뿐, 목록에서 빠지지 않는다.
//
// 이 모듈은 read-only다. vat_deduction_review의 결정(decision)을 바꾸지 않으며,
// 재분류 확정은 사용자 액션(VAI-9e)에서만 일어난다.

const ENTERTAINMENT_REASON_KEYWORDS = ['접대비', '기업업무추진비']

export type ReclassificationCandidate = {
  reviewRowId: string
  description: string
  counterparty: string | null
  supplyAmountKrw: number
  inputTaxKrw: number
  evaluation: ReclassificationEvaluation
}

// 적요 텍스트에서 참석자로 보이는 이름 후보를 뽑는다. "참석자: 홍길동, 김철수"처럼
// 명시적인 패턴만 인정한다. 그 외에는 null(정보 없음)을 반환한다 — 어설픈 추출로
// 오탐을 만드느니 "정보 없음"으로 보수적으로 처리하는 게 안전하다. null이어도
// VAI-9a는 후보를 배제하지 않고 신뢰도만 낮춘다(Brief 51 §0.1).
export function extractAttendeeNames(memoText: string): string[] | null {
  const match = /참석자\s*[:：]\s*([^/\n]+)/.exec(memoText)
  if (!match) return null
  const names = match[1]
    .split(/[,、·\s]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  return names.length > 0 ? names : null
}

async function loadActiveEmployeeNames(tenantId: string, clientId: string): Promise<string[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({ displayName: employeeProfile.displayName })
    .from(employeeProfile)
    .where(and(
      eq(employeeProfile.tenantId, tenantId),
      eq(employeeProfile.clientId, clientId),
      eq(employeeProfile.employeeStatus, 'active'),
    ))
  return rows.map((row) => row.displayName)
}

type PastDecisionRow = { decision: string; reason: string }

// 과거 vat_deduction_review 행 목록에서 참고 신호를 뽑는 순수 함수(DB I/O 없음,
// 단위 테스트 대상). 접대비 사유였던 과거 이력만 신호로 쓴다 — reason 필터 없이
// 전부 모으면, 같은 거래처가 다른 불공제 사유(예: 비영업용 소형승용차)로 걸렸던
// 이력까지 접대비 재분류 신호로 오독될 수 있다.
//
// 이 신호는 Brief 51 §4.3에 따라 약한 참고 신호일 뿐이다 — 상충하는 이력(재분류
// 이력과 유지 이력이 둘 다 있음)이 있으면 보수적인 쪽(접대비 유지)을 신호로 쓰되,
// 어느 쪽이든 신뢰도를 조정하는 요인일 뿐 후보를 없애는 게이트가 아니다.
export function resolvePastDecisionSignal(
  rows: readonly PastDecisionRow[],
): 'reclassified_as_benefit' | 'kept_as_entertainment' | null {
  const entertainmentRows = rows.filter((row) =>
    ENTERTAINMENT_REASON_KEYWORDS.some((keyword) => row.reason.includes(keyword)))

  if (entertainmentRows.some((row) => row.decision === 'non_deductible')) return 'kept_as_entertainment'
  if (entertainmentRows.some((row) => row.decision === 'deductible')) return 'reclassified_as_benefit'
  return null
}

// 같은 tenant·사업장에서 같은 거래처의 과거(현재 기간 제외) 결정 이력을 찾는다.
// vat_deduction_review에 재분류 전용 스키마를 새로 만들지 않고 기존 감사 이력을
// 재사용한다.
async function loadPastDecisionForCounterparty(params: {
  tenantId: string
  clientId: string
  periodKey: string
  counterparty: string
}): Promise<'reclassified_as_benefit' | 'kept_as_entertainment' | null> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({ decision: vatDeductionReview.decision, reason: vatDeductionReview.reason })
    .from(vatDeductionReview)
    .where(and(
      eq(vatDeductionReview.tenantId, params.tenantId),
      eq(vatDeductionReview.clientId, params.clientId),
      eq(vatDeductionReview.counterparty, params.counterparty),
      eq(vatDeductionReview.kind, 'non_deductible_candidate'),
      ne(vatDeductionReview.periodKey, params.periodKey),
    ))

  return resolvePastDecisionSignal(rows)
}

// 현재 기간에 접대비로 분류된 불공제 후보 매입 거래를 전부 찾아 재분류 신뢰도를
// 평가한다. 신뢰도와 무관하게 이 범위(접대비 불공제 후보) 안의 모든 행을
// 반환한다 — 근거가 약하다는 이유로 결과에서 제외하지 않는다(Brief 51 §0.1).
export async function resolveReclassificationCandidates(params: {
  tenantId: string
  clientId: string
  periodKey: string
}): Promise<ReclassificationCandidate[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({
      id: vatDeductionReview.id,
      description: vatDeductionReview.description,
      counterparty: vatDeductionReview.counterparty,
      supplyAmountKrw: vatDeductionReview.supplyAmountKrw,
      inputTaxKrw: vatDeductionReview.inputTaxKrw,
      reason: vatDeductionReview.reason,
      // Brief 51 §4.5: 담당자가 기장 시 직접 남긴 메모도 근거 탐색 대상에 포함한다.
      staffMemo: bookkeepingTransactionClassification.staffMemo,
    })
    .from(vatDeductionReview)
    .leftJoin(
      bookkeepingTransactionClassification,
      eq(bookkeepingTransactionClassification.id, vatDeductionReview.classificationRowId),
    )
    .where(and(
      eq(vatDeductionReview.tenantId, params.tenantId),
      eq(vatDeductionReview.clientId, params.clientId),
      eq(vatDeductionReview.periodKey, params.periodKey),
      eq(vatDeductionReview.kind, 'non_deductible_candidate'),
    ))

  // 1차 범위 경계: 접대비(기업업무추진비) 사유만 다룬다(Brief 51 §2.1). 이 필터는
  // 신뢰도 게이트가 아니라 기능 범위 경계다 — 다른 불공제 사유는 아직 이 기능의
  // 대상이 아니다.
  const entertainmentRows = rows.filter((row) =>
    ENTERTAINMENT_REASON_KEYWORDS.some((keyword) => row.reason.includes(keyword)))

  if (entertainmentRows.length === 0) return []

  const employeeNames = await loadActiveEmployeeNames(params.tenantId, params.clientId)

  const candidates: ReclassificationCandidate[] = []
  for (const row of entertainmentRows) {
    const pastDecision = row.counterparty
      ? await loadPastDecisionForCounterparty({
        tenantId: params.tenantId,
        clientId: params.clientId,
        periodKey: params.periodKey,
        counterparty: row.counterparty,
      })
      : null

    const memoText = [row.description, row.staffMemo].filter(Boolean).join(' / ')

    const evaluation = evaluateReclassificationCandidate({
      memoText,
      counterpartyName: row.counterparty,
      attendeeNames: extractAttendeeNames(memoText),
      employeeDisplayNames: employeeNames,
      amountKrw: row.supplyAmountKrw,
      pastUserDecisionForSimilarPattern: pastDecision,
    })

    // 신뢰도와 무관하게 항상 추가한다 — 근거가 약해도 후보를 숨기지 않는다.
    candidates.push({
      reviewRowId: row.id,
      description: row.description,
      counterparty: row.counterparty,
      supplyAmountKrw: row.supplyAmountKrw,
      inputTaxKrw: row.inputTaxKrw,
      evaluation,
    })
  }

  return candidates
}

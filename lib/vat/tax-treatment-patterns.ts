import type { VatTaxTreatmentFinalDecision } from '@/lib/validations/vat-tax-treatment'
import type { VatTaxTreatmentRuleResult } from './tax-treatment-rules'

export type VatTaxTreatmentPatternRow = {
  classificationRowId: string
  transactionDate: string
  counterparty: string | null
  direction: 'sale' | 'purchase'
  finalAccount: string | null
  finalDecision: VatTaxTreatmentFinalDecision
}

function normalizePatternText(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9a-z가-힣]/gi, '').toLowerCase()
}

function isCompatiblePattern(params: {
  target: Omit<VatTaxTreatmentPatternRow, 'finalDecision'>
  candidate: VatTaxTreatmentPatternRow
}) {
  const targetCounterparty = normalizePatternText(params.target.counterparty)
  if (!targetCounterparty || targetCounterparty !== normalizePatternText(params.candidate.counterparty)) return false
  if (params.target.direction !== params.candidate.direction) return false
  if (params.candidate.transactionDate >= params.target.transactionDate) return false
  if (
    params.target.finalAccount
    && params.candidate.finalAccount
    && params.target.finalAccount !== params.candidate.finalAccount
  ) return false
  return true
}

export function findCompatibleVatPatternRows(params: {
  target: Omit<VatTaxTreatmentPatternRow, 'finalDecision'>
  priorRows: VatTaxTreatmentPatternRow[]
}) {
  return params.priorRows.filter((candidate) => isCompatiblePattern({
    target: params.target,
    candidate,
  }))
}

export function findTiedVatPatternDecisionConflict(rows: VatTaxTreatmentPatternRow[]) {
  const counts = new Map<VatTaxTreatmentFinalDecision, number>()
  for (const row of rows) counts.set(row.finalDecision, (counts.get(row.finalDecision) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0])
  ))
  const topCount = ranked[0]?.[1]
  if (!topCount) return null
  const tiedDecisions = ranked
    .filter(([, count]) => count === topCount)
    .map(([decision]) => decision)
  if (tiedDecisions.length < 2) return null
  const tied = new Set(tiedDecisions)
  return {
    decisions: tiedDecisions,
    references: rows
      .filter((row) => tied.has(row.finalDecision))
      .map((row) => `classification:${row.classificationRowId}`),
  }
}

function dominantPurchaseDecision(rows: VatTaxTreatmentPatternRow[]) {
  const counts = new Map<'deductible' | 'non_deductible' | 'prorated', number>()
  for (const row of rows) {
    if (!['deductible', 'non_deductible', 'prorated'].includes(row.finalDecision)) continue
    const decision = row.finalDecision as 'deductible' | 'non_deductible' | 'prorated'
    counts.set(decision, (counts.get(decision) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0])
  ))
  const first = ranked[0]
  if (!first || ranked[1]?.[1] === first[1]) return null
  return { decision: first[0], count: first[1] }
}

function patternResult(
  base: VatTaxTreatmentRuleResult,
  pattern: { decision: 'deductible' | 'non_deductible' | 'prorated'; count: number },
): VatTaxTreatmentRuleResult {
  if (pattern.decision === 'deductible') {
    return {
      ...base,
      recommendation: 'likely_deductible',
      source: 'prior_confirmed_pattern',
      confidence: pattern.count >= 2 ? 'high' : 'medium',
      basisLabel: `같은 사업장의 최근 동일 거래처 ${pattern.count}건을 공제로 확정했습니다.`,
      ruleReference: null,
      hometaxAction: 'expected_no_change',
    }
  }
  if (pattern.decision === 'non_deductible') {
    return {
      ...base,
      recommendation: 'likely_non_deductible',
      source: 'prior_confirmed_pattern',
      confidence: pattern.count >= 2 ? 'high' : 'medium',
      basisLabel: `같은 사업장의 최근 동일 거래처 ${pattern.count}건을 불공제로 확정했습니다.`,
      ruleReference: null,
      hometaxAction: 'review_deduction',
    }
  }
  return {
    ...base,
    recommendation: 'proration_required',
    source: 'prior_confirmed_pattern',
    confidence: pattern.count >= 2 ? 'high' : 'medium',
    basisLabel: `같은 사업장의 최근 동일 거래처 ${pattern.count}건을 안분으로 확정했습니다.`,
    ruleReference: null,
    hometaxAction: 'review_proration',
  }
}

export function applyPriorConfirmedVatPattern(params: {
  target: Omit<VatTaxTreatmentPatternRow, 'finalDecision'>
  priorRows: VatTaxTreatmentPatternRow[]
  base: VatTaxTreatmentRuleResult
}): VatTaxTreatmentRuleResult {
  if (params.target.direction !== 'purchase' || params.base.recommendation !== 'needs_review') {
    return params.base
  }

  const compatibleRows = findCompatibleVatPatternRows({
    target: params.target,
    priorRows: params.priorRows,
  })
  const pattern = dominantPurchaseDecision(compatibleRows)
  return pattern ? patternResult(params.base, pattern) : params.base
}

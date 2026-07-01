import type { GeneratedAttributionRow } from './period-attribution-service'
import type { MaterialAttributionAiOutput } from './schemas'

function validEvidenceDate(value: string | null) {
  if (!value) return null
  const match = value.match(/^20\d{2}-(\d{2})-(\d{2})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? value : null
}

function validAttributedPeriod(value: string | null) {
  if (!value) return null
  const match = value.match(/^20\d{2}-(\d{2})$/)
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? value : null
}

function recommendationForResolvedPeriod(
  row: GeneratedAttributionRow,
  periodRelation: GeneratedAttributionRow['periodRelation'],
): GeneratedAttributionRow['recommendation'] {
  if (row.duplicateStatus === 'possible_duplicate') return 'exclude_duplicate' as const
  if (periodRelation === 'future') return 'reference_only' as const
  return 'include' as const
}

export function applyMaterialAttributionAiSuggestions(params: {
  rows: GeneratedAttributionRow[]
  ai: MaterialAttributionAiOutput
  allowedIndexes?: Set<number>
}) {
  if (params.ai.candidates.length === 0) return params.rows

  const suggestionByIndex = new Map(
    params.ai.candidates
      .filter((candidate) => !params.allowedIndexes || params.allowedIndexes.has(candidate.index))
      .map((candidate) => [candidate.index, candidate]),
  )

  return params.rows.map((row, index) => {
    const suggestion = suggestionByIndex.get(index)
    if (!suggestion) return row

    const evidenceDate = validEvidenceDate(suggestion.evidenceDate)
    const attributedPeriod = validAttributedPeriod(suggestion.attributedPeriod)
    const periodRelation = attributedPeriod ? suggestion.periodRelation : 'unknown'
    const recommendation = attributedPeriod
      ? recommendationForResolvedPeriod(row, periodRelation)
      : 'hold'

    return {
      ...row,
      evidenceDate,
      attributedPeriod,
      periodRelation,
      recommendation,
    }
  })
}

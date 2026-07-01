import {
  defaultCriteriaForWorkType,
  type GeneralDefaultCriterion,
  type GeneralDefaultCriteriaWorkType,
} from '@/lib/review/default-criteria'
import { buildJournalEntryWorkbookSource, looksLikeJournalEntryWorkbook } from '@/lib/review/journal-entry-workbook'
import type { CriterionResult, SessionEvaluation } from '@/lib/validations/session-evaluation'
import { normalizeEvaluationFilenameKey } from './filename-normalization'

export type EvaluationFileSummary = {
  filename: string
  fileType: string
  status: string
  detectedFileType: string | null
  explanation: string | null
  materialStatus: string | null
  routingStatus: string | null
  confidence: string | null
  riskFlags: string[]
}

type DeterministicCriterionGroup =
  | 'bank_statement'
  | 'card_statement'
  | 'sales_tax_invoice'
  | 'purchase_tax_invoice'
  | 'cash_receipt'
  | 'online_sales_pg_settlement'
  | 'journal_entry_workbook'
  | 'other_evidence'

const DETERMINISTIC_GROUPS = new Set<string>([
  'bank_statement',
  'card_statement',
  'sales_tax_invoice',
  'purchase_tax_invoice',
  'cash_receipt',
  'online_sales_pg_settlement',
  'journal_entry_workbook',
  'other_evidence',
])

function normalizeText(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

function isExplicitlyUnsuitableFile(file: EvaluationFileSummary) {
  const detected = normalizeText(file.detectedFileType)
  const riskFlags = file.riskFlags.map((flag) => normalizeText(flag))

  return file.materialStatus === 'insufficient' &&
    file.routingStatus === 'needs_review' &&
    (
      riskFlags.includes('not_transaction_detail') ||
      detected.includes('월별 부가세 매출 집계표')
    )
}

function looksLikeExpenseEvidence(source: string) {
  return /(관리비|통신비|전화요금|휴대폰|수도요금|전기요금|가스요금|보험료|임대료|지출\s*결의|납부\s*영수증|영수증|청구서|고객보관용|기타\s*증빙|expense receipt|utility bill|invoice receipt)/i.test(source)
}

function inferTaxInvoiceGroup(source: string): Extract<DeterministicCriterionGroup, 'sales_tax_invoice' | 'purchase_tax_invoice'> | null {
  if (/(매출\s*세금계산서|sales tax invoice|tax invoice sales)/i.test(source)) {
    return 'sales_tax_invoice'
  }

  if (/(매입\s*세금계산서|purchase tax invoice|tax invoice purchase|전자\s*세금계산서|세금계산서)/i.test(source)) {
    return 'purchase_tax_invoice'
  }

  return null
}

function inferDeterministicFileGroup(file: EvaluationFileSummary): DeterministicCriterionGroup | null {
  if (isExplicitlyUnsuitableFile(file)) return null

  // Use AI-read document content, not the local folder path or bare filename, as the grouping basis.
  const source = normalizeText([
    file.detectedFileType,
    file.explanation,
    file.riskFlags.join(' '),
  ].join('\n'))

  if (/(기업은행|우리은행|은행|통장|거래내역|bank|statement)/i.test(source)) {
    return 'bank_statement'
  }

  const taxInvoiceGroup = inferTaxInvoiceGroup(source)
  if (taxInvoiceGroup) return taxInvoiceGroup

  const journalWorkbookSource = buildJournalEntryWorkbookSource({
    detectedFileType: file.detectedFileType,
    explanation: file.explanation,
    riskFlags: file.riskFlags,
    originalFilename: file.filename,
  })
  if (looksLikeJournalEntryWorkbook(journalWorkbookSource)) {
    return 'journal_entry_workbook'
  }

  if (looksLikeExpenseEvidence(source)) {
    return 'other_evidence'
  }

  if (/(카드\s*사용|카드\s*이용|신용카드|체크카드|카드승인|카드\s*명세|카드\s*내역|card statement|card usage)/i.test(source)) {
    return 'card_statement'
  }

  if (/(현금영수증|cash receipt)/i.test(source)) {
    return 'cash_receipt'
  }

  if (/(kcp|pg\s*정산|pg settlement|온라인\s*매출|스마트스토어|오픈마켓|네이버페이\s*정산|npay\s*settlement)/i.test(source)) {
    return 'online_sales_pg_settlement'
  }

  if (looksLikeExpenseEvidence(source)) {
    return 'other_evidence'
  }

  return null
}

export function inferDefaultCriterionGroup(
  criterion: CriterionResult,
  defaultCriteria: GeneralDefaultCriterion[],
): GeneralDefaultCriterion | null {
  const source = normalizeText(criterion.criterion_text)
  return defaultCriteria.find((defaultCriterion) => (
    source.includes(normalizeText(defaultCriterion.itemName))
  )) ?? null
}

function recomputeMaterialVerdict(criteria: CriterionResult[]): SessionEvaluation['overall_verdict'] {
  const materialCriteria = criteria.filter((criterion) => criterion.criterion_type === 'material')
  if (materialCriteria.length === 0) return criteria.length === 0 ? 'sufficient' : 'uncertain'
  if (materialCriteria.some((criterion) => ['missing', 'non_compliant'].includes(criterion.status))) {
    return 'needs_resubmission'
  }
  if (materialCriteria.every((criterion) => criterion.status === 'satisfied')) return 'sufficient'
  return 'uncertain'
}

function createDefaultCriterionResult(params: {
  defaultCriterion: GeneralDefaultCriterion
  relatedFilenames: string[]
}): CriterionResult {
  const { defaultCriterion, relatedFilenames } = params

  if (relatedFilenames.length > 0) {
    return {
      criterion_text: `${defaultCriterion.itemName}: ${defaultCriterion.conditionText ?? ''}`,
      criterion_type: 'material',
      status: 'satisfied',
      related_filenames: relatedFilenames,
      reason: `파일명과 파일 분석 결과 기준으로 ${relatedFilenames.join(', ')} 파일이 ${defaultCriterion.itemName} 요청자료에 해당합니다.`,
      requested_action: null,
      confidence: 'high',
    }
  }

  if (defaultCriterion.requiredness === 'optional') {
    return {
      criterion_text: `${defaultCriterion.itemName}: ${defaultCriterion.conditionText ?? ''}`,
      criterion_type: 'material',
      status: 'satisfied',
      related_filenames: [],
      reason: '참고 항목으로 제출 파일이 없어도 즉시 보충 요청 대상은 아닙니다.',
      requested_action: null,
      confidence: 'medium',
    }
  }

  return {
    criterion_text: `${defaultCriterion.itemName}: ${defaultCriterion.conditionText ?? ''}`,
    criterion_type: 'material',
    status: 'missing',
    related_filenames: [],
    reason: `${defaultCriterion.itemName} 요청자료로 판독된 파일이 없습니다.`,
    requested_action: `${defaultCriterion.itemName} 제출 요청`,
    confidence: 'medium',
  }
}

export function applyDeterministicDefaultCriteriaLinks(params: {
  evaluation: SessionEvaluation
  fileSummaries: EvaluationFileSummary[]
  workType: GeneralDefaultCriteriaWorkType
}): SessionEvaluation {
  if (params.workType !== 'bookkeeping') return params.evaluation

  const defaultCriteria = defaultCriteriaForWorkType(params.workType)
  const fileGroups = new Map<DeterministicCriterionGroup, string[]>()
  const unsuitableKeys = new Set(
    params.fileSummaries
      .filter(isExplicitlyUnsuitableFile)
      .map((file) => normalizeEvaluationFilenameKey(file.filename)),
  )

  for (const file of params.fileSummaries) {
    const group = inferDeterministicFileGroup(file)
    if (!group) continue
    fileGroups.set(group, [...(fileGroups.get(group) ?? []), file.filename])
  }
  const filenameToGroup = new Map(
    params.fileSummaries.map((file) => [
      normalizeEvaluationFilenameKey(file.filename),
      inferDeterministicFileGroup(file),
    ]),
  )

  const criteria = params.evaluation.criteria.map((criterion) => {
    if (criterion.criterion_type !== 'material') return criterion

    const defaultCriterion = inferDefaultCriterionGroup(criterion, defaultCriteria)
    const defaultGroup = defaultCriterion?.itemGroup
    const isDeterministicDefaultGroup = Boolean(defaultGroup && DETERMINISTIC_GROUPS.has(defaultGroup))
    const filteredRelatedFilenames = criterion.related_filenames.filter((filename) => {
      if (unsuitableKeys.has(normalizeEvaluationFilenameKey(filename))) return false
      if (!isDeterministicDefaultGroup) return true

      const inferredGroup = filenameToGroup.get(normalizeEvaluationFilenameKey(filename))
      return inferredGroup === defaultGroup
    })

    if (
      !defaultCriterion ||
      !DETERMINISTIC_GROUPS.has(defaultCriterion.itemGroup)
    ) {
      return {
        ...criterion,
        related_filenames: filteredRelatedFilenames,
      }
    }

    const deterministicFiles = fileGroups.get(defaultCriterion.itemGroup as DeterministicCriterionGroup) ?? []
    const relatedFilenames = Array.from(new Set([
      ...filteredRelatedFilenames,
      ...deterministicFiles,
    ]))

    if (
      defaultCriterion.requiredness === 'required' &&
      criterion.status === 'satisfied' &&
      relatedFilenames.length === 0
    ) {
      return {
        ...criterion,
        status: 'missing' as const,
        related_filenames: [],
        reason: `${defaultCriterion.itemName} 요청자료로 판독된 파일이 없습니다.`,
        requested_action: `${defaultCriterion.itemName} 제출 요청`,
        confidence: 'medium' as const,
      }
    }

    if (deterministicFiles.length === 0) {
      return { ...criterion, related_filenames: relatedFilenames }
    }

    return {
      ...criterion,
      status: 'satisfied' as const,
      related_filenames: relatedFilenames,
      reason: `파일명과 파일 분석 결과 기준으로 ${deterministicFiles.join(', ')} 파일이 ${defaultCriterion.itemName} 요청자료에 해당합니다.`,
      requested_action: null,
      confidence: 'high' as const,
    }
  })
  const presentDefaultGroups = new Set(
    criteria
      .filter((criterion) => criterion.criterion_type === 'material')
      .map((criterion) => inferDefaultCriterionGroup(criterion, defaultCriteria)?.itemGroup)
      .filter(Boolean),
  )

  for (const defaultCriterion of defaultCriteria) {
    if (presentDefaultGroups.has(defaultCriterion.itemGroup)) continue

    const deterministicFiles = DETERMINISTIC_GROUPS.has(defaultCriterion.itemGroup)
      ? fileGroups.get(defaultCriterion.itemGroup as DeterministicCriterionGroup) ?? []
      : []

    criteria.push(createDefaultCriterionResult({
      defaultCriterion,
      relatedFilenames: deterministicFiles,
    }))
    presentDefaultGroups.add(defaultCriterion.itemGroup)
  }

  return {
    ...params.evaluation,
    overall_verdict: recomputeMaterialVerdict(criteria),
    criteria,
  }
}

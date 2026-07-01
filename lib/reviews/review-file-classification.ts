import { inferBookkeepingPeriodRange, isBookkeepingPeriodInRange } from '@/lib/bookkeeping/period-range'
import { buildJournalEntryWorkbookSource, looksLikeJournalEntryWorkbook } from '@/lib/review/journal-entry-workbook'
import { resolveUnlinkedReason } from '@/lib/reviews/unlinked-reason'
import type { ReviewAnalysisRun, ReviewFile, ReviewSession } from './review-workspace-types'

type ParsedAnalysisOutput = {
  material_status?: string
  routing_status?: string
  detected_file_type?: string
  risk_flags?: string[]
  explanation?: string
  staff_unlinked_reason?: string | null
} | null

export type ReviewFileClassification = {
  status: 'suitable' | 'unsuitable' | 'pending' | 'unmatched' | 'password_required' | 'password_invalid'
  label: '적합' | '부적합' | '판정 대기' | '매칭 필요' | '비밀번호 필요' | '비밀번호 오류'
  reason: string
  criterionGroup:
    | 'bank_statement'
    | 'card_statement'
    | 'sales_tax_invoice'
    | 'purchase_tax_invoice'
    | 'cash_receipt'
    | 'online_sales_pg_settlement'
    | 'journal_entry_workbook'
    | 'other_evidence'
    | null
}

export function representativeRunForFile(file: ReviewFile, runs: ReviewAnalysisRun[]) {
  const fileRuns = runs
    .filter((run) => run.uploadFileId === file.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return fileRuns.find((run) => run.status === 'completed') ?? fileRuns[0] ?? null
}

export function parseAnalysisOutput(run: ReviewAnalysisRun | null): ParsedAnalysisOutput {
  if (!run?.parsedOutput) return null
  try {
    return JSON.parse(run.parsedOutput) as NonNullable<ParsedAnalysisOutput>
  } catch {
    return null
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

function isExplicitlyUnsuitable(parsed: ParsedAnalysisOutput) {
  return Boolean(
    parsed &&
    parsed.material_status === 'insufficient' &&
    parsed.routing_status === 'needs_review' &&
    (
      parsed.risk_flags?.includes('not_transaction_detail') ||
      parsed.detected_file_type?.includes('월별 부가세 매출 집계표')
    ),
  )
}

function isNaverPayWithoutDetailSignal(file: ReviewFile, parsed: ParsedAnalysisOutput) {
  const source = normalizeText([
    file.originalFilename,
    parsed?.detected_file_type,
    parsed?.explanation,
    parsed?.risk_flags?.join(' '),
  ].join('\n'))

  if (!/(네이버페이|naver|npay)/i.test(source)) return false
  return !/(거래|정산|상세|transaction|settlement|detail)/i.test(source)
}

function looksLikeExpenseEvidence(source: string) {
  return /(관리비|통신비|전화요금|휴대폰|수도요금|전기요금|가스요금|보험료|임대료|지출\s*결의|납부\s*영수증|영수증|청구서|고객보관용|기타\s*증빙|expense receipt|utility bill|invoice receipt)/i.test(source)
}

function inferTaxInvoiceGroup(source: string) {
  if (/(매출\s*세금계산서|sales tax invoice|tax invoice sales)/i.test(source)) {
    return 'sales_tax_invoice' as const
  }

  if (/(매입\s*세금계산서|purchase tax invoice|tax invoice purchase|전자\s*세금계산서|세금계산서)/i.test(source)) {
    return 'purchase_tax_invoice' as const
  }

  return null
}

function formatMonthKorean(period: string) {
  const month = Number(period.slice(5, 7))
  return Number.isFinite(month) ? `${month}월` : period
}

function normalizeContentMonth(year: string, month: string) {
  const numericMonth = Number(month)
  if (numericMonth < 1 || numericMonth > 12) return null
  return `${year}-${month.padStart(2, '0')}`
}

function findContentAttributionPeriod(source: string) {
  const periodLabels = [
    '고지년월',
    '고지월',
    '사용년월',
    '사용월',
    '이용년월',
    '이용월',
    '공급기간',
    '공급년월',
    '청구년월',
    '청구월',
    '귀속년월',
    '귀속월',
    '정산년월',
    '정산월',
  ]
  const pattern = new RegExp(
    `(${periodLabels.join('|')})\\s*[:：은는-]*\\s*(20\\d{2})\\s*[.\\-/년]?\\s*(\\d{1,2})`,
    'i',
  )
  const match = source.match(pattern)
  if (!match) return null

  const period = normalizeContentMonth(match[2], match[3])
  if (!period) return null
  return {
    label: match[1],
    period,
  }
}

function unsuitablePeriodMismatch(session: ReviewSession, parsed: ParsedAnalysisOutput) {
  if (session.workType !== 'bookkeeping' || !parsed) return null
  const targetRange = inferBookkeepingPeriodRange(session.accountingPeriod)
  if (!targetRange) return null

  // File names are deliberately excluded. Use only AI-read document content.
  const source = normalizeText([
    parsed.detected_file_type,
    parsed.explanation,
    parsed.risk_flags?.join(' '),
  ].join('\n'))
  const contentPeriod = findContentAttributionPeriod(source)
  if (!contentPeriod || isBookkeepingPeriodInRange(contentPeriod.period, targetRange)) return null

  const isMaintenanceFee = /관리비/.test(source)
  const subject = isMaintenanceFee ? `${formatMonthKorean(contentPeriod.period)}달 관리비` : `${contentPeriod.period} 자료`
  const requestedLabel = targetRange.start === targetRange.end ? targetRange.start : `${targetRange.start}~${targetRange.end}`

  return {
    status: 'unsuitable' as const,
    label: '부적합' as const,
    criterionGroup: null,
    reason: `문서 내용상 ${contentPeriod.label}이 ${contentPeriod.period}로 확인되어 ${subject}로 판단됨. 요청기간 ${requestedLabel} 자료에 해당하지 않습니다.`,
  }
}

function inferCriterionGroup(file: ReviewFile, parsed: ParsedAnalysisOutput) {
  if (isExplicitlyUnsuitable(parsed) || isNaverPayWithoutDetailSignal(file, parsed)) return null

  // Use AI-read document content, not the tester's local folder name, as the grouping basis.
  // staff_unlinked_reason is also AI-read content. It often contains the clearest
  // document-shape statement when the first pass could not connect a checklist item.
  const source = normalizeText([
    parsed?.detected_file_type,
    parsed?.explanation,
    parsed?.staff_unlinked_reason,
    parsed?.risk_flags?.join(' '),
  ].join('\n'))

  if (/(기업은행|우리은행|은행|통장|거래내역|bank|statement)/i.test(source)) {
    return 'bank_statement' as const
  }

  const taxInvoiceGroup = inferTaxInvoiceGroup(source)
  if (taxInvoiceGroup) return taxInvoiceGroup

  const journalWorkbookSource = buildJournalEntryWorkbookSource({
    detectedFileType: parsed?.detected_file_type,
    explanation: [
      parsed?.explanation,
      parsed?.staff_unlinked_reason,
    ].filter(Boolean).join('\n'),
    riskFlags: parsed?.risk_flags,
    originalFilename: file.originalFilename,
  })
  if (looksLikeJournalEntryWorkbook(journalWorkbookSource)) {
    return 'journal_entry_workbook' as const
  }

  if (looksLikeExpenseEvidence(source)) {
    return 'other_evidence' as const
  }

  if (/(카드\s*사용|카드\s*이용|신용카드|체크카드|카드승인|카드\s*명세|카드\s*내역|card statement|card usage)/i.test(source)) {
    return 'card_statement' as const
  }

  if (/(현금영수증|cash receipt)/i.test(source)) {
    return 'cash_receipt' as const
  }

  if (/(kcp|pg\s*정산|pg settlement|온라인\s*매출|스마트스토어|오픈마켓|네이버페이\s*정산|npay\s*settlement)/i.test(source)) {
    return 'online_sales_pg_settlement' as const
  }

  if (looksLikeExpenseEvidence(source)) {
    return 'other_evidence' as const
  }

  if (parsed?.routing_status === 'needs_review' && resolveUnlinkedReason({ parsed })) return null

  return null
}

export function classifyReviewFile(file: ReviewFile, session: ReviewSession): ReviewFileClassification {
  // 비밀번호 보호 파일은 AI 분석을 건너뛰어 analysis_run이 없다.
  // passwordStatus 가드는 다른 분류보다 먼저 처리한다.
  if (file.passwordStatus === 'invalid') {
    return {
      status: 'password_invalid',
      label: '비밀번호 오류',
      criterionGroup: null,
      reason: '입력한 비밀번호가 맞지 않습니다. 다시 입력하거나, 비밀번호 없는 파일로 다시 받아야 합니다.',
    }
  }

  if (file.passwordStatus === 'required') {
    return {
      status: 'password_required',
      label: '비밀번호 필요',
      criterionGroup: null,
      reason: '비밀번호가 걸린 파일이라 내용을 확인하지 못했습니다. 비밀번호를 입력하거나, 비밀번호 없는 파일로 다시 받아야 합니다.',
    }
  }

  const representativeRun = representativeRunForFile(file, session.analysisRuns)
  const parsed = parseAnalysisOutput(representativeRun)

  const periodMismatch = unsuitablePeriodMismatch(session, parsed)
  if (periodMismatch) return periodMismatch

  if (isExplicitlyUnsuitable(parsed) || isNaverPayWithoutDetailSignal(file, parsed)) {
    return {
      status: 'unsuitable',
      label: '부적합',
      criterionGroup: null,
      reason: '파일명은 네이버페이지만 실제 내용은 월별 부가세 매출 집계표라 기장 요청자료 기준에 해당하지 않습니다.',
    }
  }

  const criterionGroup = inferCriterionGroup(file, parsed)
  if (criterionGroup) {
    return {
      status: 'suitable',
      label: '적합',
      criterionGroup,
      reason: '파일명과 분석 결과 기준으로 요청자료에 연결할 수 있는 파일입니다.',
    }
  }

  if (file.status === 'uploaded' || file.status === 'analyzing') {
    return {
      status: 'pending',
      label: '판정 대기',
      criterionGroup: null,
      reason: '파일 분석 또는 요청자료 매칭이 아직 완료되지 않았습니다.',
    }
  }

  return {
    status: 'unmatched',
    label: '매칭 필요',
    criterionGroup: null,
    reason: resolveUnlinkedReason({ parsed }) ?? '',
  }
}

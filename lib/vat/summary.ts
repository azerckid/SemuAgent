import { and, desc, eq } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import { client, tenant, vatDeductionReview, vatPeriodSummary } from '@/lib/db/schema'

export type VatSalesGroupId = 'taxable' | 'zero_rated' | 'exempt'
export type VatDeductionDecision = 'pending' | 'deductible' | 'non_deductible' | 'prorated'
export type VatDeductionKind = 'deductible' | 'non_deductible_candidate' | 'proration_required'
export type VatTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'

export type VatTaxSummary = {
  outputTaxKrw: number
  inputTaxKrw: number
  inputTaxDeductibleKrw: number
  payableTaxKrw: number
  pendingDeductionCount: number
  isFinal: boolean
  filingDeadline: string
  dDay: number
}

export type VatSalesGroup = {
  id: VatSalesGroupId
  title: string
  supplyAmountKrw: number
  outputTaxKrw: number | null
  tone: VatTone
}

export type VatDeductionReviewRow = {
  id: string
  sourceVoucherId: string | null
  sourceVoucherLineId: string | null
  classificationRowId: string | null
  description: string
  counterparty: string | null
  supplyAmountKrw: number
  inputTaxKrw: number
  kind: VatDeductionKind
  decision: VatDeductionDecision
  reason: string
  prorationRateBps: number | null
  actionLabels: string[]
}

export type VatSchedule = {
  id: 'sales_tax_invoice' | 'purchase_tax_invoice' | 'card_receipt' | 'non_deductible_input_tax'
  title: string
  description: string
  tone: VatTone
  statusLabel: string
}

export type VatPackagePreview = {
  fileName: string
  description: string
  locked: boolean
  lockReason: string | null
  canGenerate: boolean
}

export type VatSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: CompanyHomePeriod
  taxSummary: VatTaxSummary
  salesGroups: VatSalesGroup[]
  deductionReviews: VatDeductionReviewRow[]
  schedules: VatSchedule[]
  packagePreview: VatPackagePreview
}

type VatPeriodSummaryInput = {
  taxableSupplyKrw: number
  taxableOutputTaxKrw: number
  zeroRatedSupplyKrw: number
  exemptSupplyKrw: number
  outputTaxKrw: number
  inputTaxKrw: number
  inputTaxDeductibleKrw: number
  pendingDeductionCount: number
  isFinal: boolean
  packageStatus: 'locked' | 'ready' | 'generated'
  packageStorageKey: string | null
}

type VatDeductionReviewInput = {
  id: string
  sourceVoucherId: string | null
  sourceVoucherLineId: string | null
  classificationRowId: string | null
  description: string
  counterparty: string | null
  supplyAmountKrw: number
  inputTaxKrw: number
  kind: string
  decision: string
  reason: string
  prorationRateBps: number | null
}

type LoadVatSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

const DEFAULT_TZ = 'Asia/Seoul'
const VAT_OUTPUT_ACCOUNT_CODE = '255'
const VAT_INPUT_ACCOUNT_CODE = '135'

const EMPTY_VAT_PERIOD_SUMMARY: VatPeriodSummaryInput = {
  taxableSupplyKrw: 0,
  taxableOutputTaxKrw: 0,
  zeroRatedSupplyKrw: 0,
  exemptSupplyKrw: 0,
  outputTaxKrw: 0,
  inputTaxKrw: 0,
  inputTaxDeductibleKrw: 0,
  pendingDeductionCount: 0,
  isFinal: false,
  packageStatus: 'locked',
  packageStorageKey: null,
}

export function isVatOutputTaxLine(line: { accountName: string | null; accountCode: string | null; side: string }) {
  return line.side === 'credit' && (line.accountCode === VAT_OUTPUT_ACCOUNT_CODE || line.accountName === '부가세예수금')
}

export function isVatInputTaxLine(line: { accountName: string | null; accountCode: string | null; side: string }) {
  return line.side === 'debit' && (line.accountCode === VAT_INPUT_ACCOUNT_CODE || line.accountName === '부가세대급금')
}

export function normalizeVatDeductionKind(value: string): VatDeductionKind {
  if (value === 'non_deductible_candidate' || value === 'proration_required') return value
  return 'deductible'
}

export function normalizeVatDeductionDecision(value: string): VatDeductionDecision {
  if (value === 'deductible' || value === 'non_deductible' || value === 'prorated') return value
  return 'pending'
}

export function calculateDeductibleInputTax(
  inputTaxKrw: number,
  reviews: Array<Pick<VatDeductionReviewInput, 'decision' | 'inputTaxKrw' | 'prorationRateBps'>>,
) {
  return reviews.reduce((sum, review) => {
    const decision = normalizeVatDeductionDecision(review.decision)
    if (decision === 'deductible' || decision === 'pending') return sum
    if (decision === 'non_deductible') return sum - review.inputTaxKrw
    if (decision === 'prorated') {
      const rateBps = review.prorationRateBps ?? 0
      const deductibleAmount = Math.round(review.inputTaxKrw * (rateBps / 10_000))
      return sum - (review.inputTaxKrw - deductibleAmount)
    }
    return sum
  }, inputTaxKrw)
}

export function buildVatPeriodRecalculation(
  summary: Pick<VatPeriodSummaryInput, 'outputTaxKrw' | 'inputTaxKrw'>,
  reviews: Array<Pick<VatDeductionReviewInput, 'decision' | 'inputTaxKrw' | 'prorationRateBps'>>,
) {
  const pendingDeductionCount = reviews.filter((review) => (
    normalizeVatDeductionDecision(review.decision) === 'pending'
  )).length
  const inputTaxDeductibleKrw = calculateDeductibleInputTax(summary.inputTaxKrw, reviews)
  const packageStatus: VatPeriodSummaryInput['packageStatus'] = pendingDeductionCount > 0
    ? 'locked'
    : 'ready'

  return {
    inputTaxDeductibleKrw,
    payableTaxKrw: summary.outputTaxKrw - inputTaxDeductibleKrw,
    pendingDeductionCount,
    packageStatus,
  }
}

export function buildVatTaxSummary(
  summary: Pick<VatPeriodSummaryInput, 'outputTaxKrw' | 'inputTaxKrw' | 'inputTaxDeductibleKrw' | 'pendingDeductionCount' | 'isFinal'>,
  period: Pick<CompanyHomePeriod, 'filingDeadline' | 'dDay'>,
  reviews: Array<Pick<VatDeductionReviewInput, 'decision' | 'inputTaxKrw' | 'prorationRateBps'>> = [],
): VatTaxSummary {
  const pendingDeductionCount = reviews.length > 0
    ? reviews.filter((review) => normalizeVatDeductionDecision(review.decision) === 'pending').length
    : summary.pendingDeductionCount
  const inputTaxDeductibleKrw = reviews.length > 0
    ? calculateDeductibleInputTax(summary.inputTaxKrw, reviews)
    : summary.inputTaxDeductibleKrw

  return {
    outputTaxKrw: summary.outputTaxKrw,
    inputTaxKrw: summary.inputTaxKrw,
    inputTaxDeductibleKrw,
    payableTaxKrw: summary.outputTaxKrw - inputTaxDeductibleKrw,
    pendingDeductionCount,
    isFinal: summary.isFinal,
    filingDeadline: period.filingDeadline,
    dDay: period.dDay,
  }
}

export function buildVatSalesGroups(summary: Pick<VatPeriodSummaryInput,
  'taxableSupplyKrw' | 'taxableOutputTaxKrw' | 'zeroRatedSupplyKrw' | 'exemptSupplyKrw'
>): VatSalesGroup[] {
  return [
    {
      id: 'taxable',
      title: '과세 매출',
      supplyAmountKrw: summary.taxableSupplyKrw,
      outputTaxKrw: summary.taxableOutputTaxKrw,
      tone: summary.taxableSupplyKrw > 0 ? 'info' : 'muted',
    },
    {
      id: 'zero_rated',
      title: '영세율 매출',
      supplyAmountKrw: summary.zeroRatedSupplyKrw,
      outputTaxKrw: 0,
      tone: summary.zeroRatedSupplyKrw > 0 ? 'ok' : 'muted',
    },
    {
      id: 'exempt',
      title: '면세 매출',
      supplyAmountKrw: summary.exemptSupplyKrw,
      outputTaxKrw: null,
      tone: summary.exemptSupplyKrw > 0 ? 'warn' : 'muted',
    },
  ]
}

export function buildVatDeductionReviewRow(row: VatDeductionReviewInput): VatDeductionReviewRow {
  const kind = normalizeVatDeductionKind(row.kind)
  const decision = normalizeVatDeductionDecision(row.decision)
  return {
    id: row.id,
    sourceVoucherId: row.sourceVoucherId,
    sourceVoucherLineId: row.sourceVoucherLineId,
    classificationRowId: row.classificationRowId,
    description: row.description,
    counterparty: row.counterparty,
    supplyAmountKrw: row.supplyAmountKrw,
    inputTaxKrw: row.inputTaxKrw,
    kind,
    decision,
    reason: row.reason,
    prorationRateBps: row.prorationRateBps,
    actionLabels: vatDeductionActionLabels(kind, decision),
  }
}

export function vatDeductionActionLabels(kind: VatDeductionKind, decision: VatDeductionDecision): string[] {
  if (decision !== 'pending') return ['확정됨']
  if (kind === 'non_deductible_candidate') return ['불공제 확정', '공제']
  if (kind === 'proration_required') return ['안분 계산', '공제']
  return ['공제 확정']
}

export function vatDeductionTone(kind: VatDeductionKind, decision: VatDeductionDecision): VatTone {
  if (decision === 'deductible') return 'ok'
  if (decision === 'non_deductible') return 'danger'
  if (decision === 'prorated') return 'warn'
  if (kind === 'non_deductible_candidate') return 'danger'
  if (kind === 'proration_required') return 'warn'
  return 'info'
}

export function buildVatSchedules(taxSummary: VatTaxSummary, reviews: VatDeductionReviewRow[]): VatSchedule[] {
  const nonDeductiblePending = reviews.filter((review) => (
    review.decision === 'pending' && review.kind === 'non_deductible_candidate'
  )).length
  const prorationPending = reviews.filter((review) => (
    review.decision === 'pending' && review.kind === 'proration_required'
  )).length

  return [
    {
      id: 'sales_tax_invoice',
      title: '매출 세금계산서 합계표',
      description: '과세 매출 공급가액과 매출세액 기준',
      tone: taxSummary.outputTaxKrw > 0 ? 'ok' : 'muted',
      statusLabel: taxSummary.outputTaxKrw > 0 ? '준비됨' : '대기',
    },
    {
      id: 'purchase_tax_invoice',
      title: '매입 세금계산서 합계표',
      description: '공제 확정 매입세액 기준',
      tone: taxSummary.pendingDeductionCount > 0 ? 'warn' : 'ok',
      statusLabel: taxSummary.pendingDeductionCount > 0 ? '검토 대기' : '준비됨',
    },
    {
      id: 'card_receipt',
      title: '카드·현금영수증 수취명세',
      description: '매입 증빙과 공제 판정 연결',
      tone: prorationPending > 0 ? 'warn' : 'ok',
      statusLabel: prorationPending > 0 ? '안분 필요' : '준비됨',
    },
    {
      id: 'non_deductible_input_tax',
      title: '공제받지 못할 매입세액 명세',
      description: '접대비·차량 등 불공제 후보',
      tone: nonDeductiblePending > 0 ? 'danger' : 'ok',
      statusLabel: nonDeductiblePending > 0 ? '검토 대기' : '준비됨',
    },
  ]
}

export function buildVatPackagePreview(params: {
  period: Pick<CompanyHomePeriod, 'key'>
  taxSummary: Pick<VatTaxSummary, 'pendingDeductionCount'>
  hasSummary: boolean
  packageStatus: VatPeriodSummaryInput['packageStatus']
  packageStorageKey: string | null
}): VatPackagePreview {
  const fileName = `부가세_${params.period.key}_신고패키지.pdf`
  if (!params.hasSummary) {
    return {
      fileName,
      description: '확정 전표와 VAT summary 생성 후 패키지 초안을 만들 수 있습니다.',
      locked: true,
      lockReason: '기장검토 먼저 확정',
      canGenerate: false,
    }
  }
  if (params.taxSummary.pendingDeductionCount > 0) {
    return {
      fileName,
      description: 'PDF 초안과 홈택스 입력 가이드는 공제 검토 완료 후 생성됩니다.',
      locked: true,
      lockReason: `공제 검토 ${params.taxSummary.pendingDeductionCount}건 완료 후 생성`,
      canGenerate: false,
    }
  }
  return {
    fileName,
    description: params.packageStorageKey ? '생성된 패키지 초안이 보관되어 있습니다.' : 'PDF 초안과 홈택스 입력 가이드를 생성할 수 있습니다.',
    locked: false,
    lockReason: null,
    canGenerate: params.packageStatus !== 'generated',
  }
}

export async function loadVatSummary({ tenantId, periodKey, today }: LoadVatSummaryParams): Promise<VatSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const period = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(client.createdAt)
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = { tenant: tenantRow, businessEntity, period }

  if (!businessEntity) {
    const taxSummary = buildVatTaxSummary(EMPTY_VAT_PERIOD_SUMMARY, period)
    return {
      ...base,
      taxSummary,
      salesGroups: buildVatSalesGroups(EMPTY_VAT_PERIOD_SUMMARY),
      deductionReviews: [],
      schedules: buildVatSchedules(taxSummary, []),
      packagePreview: buildVatPackagePreview({
        period,
        taxSummary,
        hasSummary: false,
        packageStatus: 'locked',
        packageStorageKey: null,
      }),
    }
  }

  const [summaryRows, reviewRows] = await Promise.all([
    db
      .select({
        taxableSupplyKrw: vatPeriodSummary.taxableSupplyKrw,
        taxableOutputTaxKrw: vatPeriodSummary.taxableOutputTaxKrw,
        zeroRatedSupplyKrw: vatPeriodSummary.zeroRatedSupplyKrw,
        exemptSupplyKrw: vatPeriodSummary.exemptSupplyKrw,
        outputTaxKrw: vatPeriodSummary.outputTaxKrw,
        inputTaxKrw: vatPeriodSummary.inputTaxKrw,
        inputTaxDeductibleKrw: vatPeriodSummary.inputTaxDeductibleKrw,
        pendingDeductionCount: vatPeriodSummary.pendingDeductionCount,
        isFinal: vatPeriodSummary.isFinal,
        packageStatus: vatPeriodSummary.packageStatus,
        packageStorageKey: vatPeriodSummary.packageStorageKey,
      })
      .from(vatPeriodSummary)
      .where(and(
        eq(vatPeriodSummary.tenantId, tenantId),
        eq(vatPeriodSummary.clientId, businessEntity.id),
        eq(vatPeriodSummary.periodKey, period.key),
        eq(vatPeriodSummary.filingType, 'final'),
      ))
      .limit(1),
    db
      .select({
        id: vatDeductionReview.id,
        sourceVoucherId: vatDeductionReview.sourceVoucherId,
        sourceVoucherLineId: vatDeductionReview.sourceVoucherLineId,
        classificationRowId: vatDeductionReview.classificationRowId,
        description: vatDeductionReview.description,
        counterparty: vatDeductionReview.counterparty,
        supplyAmountKrw: vatDeductionReview.supplyAmountKrw,
        inputTaxKrw: vatDeductionReview.inputTaxKrw,
        kind: vatDeductionReview.kind,
        decision: vatDeductionReview.decision,
        reason: vatDeductionReview.reason,
        prorationRateBps: vatDeductionReview.prorationRateBps,
      })
      .from(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.tenantId, tenantId),
        eq(vatDeductionReview.clientId, businessEntity.id),
        eq(vatDeductionReview.periodKey, period.key),
      ))
      .orderBy(desc(vatDeductionReview.decision), desc(vatDeductionReview.inputTaxKrw), desc(vatDeductionReview.createdAt)),
  ])

  const summary = summaryRows[0] ?? EMPTY_VAT_PERIOD_SUMMARY
  const deductionReviews = reviewRows.map(buildVatDeductionReviewRow)
  const taxSummary = buildVatTaxSummary(summary, period, reviewRows)

  return {
    ...base,
    taxSummary,
    salesGroups: buildVatSalesGroups(summary),
    deductionReviews,
    schedules: buildVatSchedules(taxSummary, deductionReviews),
    packagePreview: buildVatPackagePreview({
      period,
      taxSummary,
      hasSummary: Boolean(summaryRows[0]),
      packageStatus: summary.packageStatus,
      packageStorageKey: summary.packageStorageKey,
    }),
  }
}

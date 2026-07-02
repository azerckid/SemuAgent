import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  client,
  filingChecklistItem,
  filingItem,
  filingReceipt,
  payrollPeriodSummary,
  tenant,
  vatPeriodSummary,
} from '@/lib/db/schema'

export type FilingItemType = 'vat' | 'withholding' | 'social_insurance'
export type FilingPackageStatus = 'locked' | 'ready' | 'generated' | 'submitted'
export type FilingItemStatus = 'locked' | 'ready' | 'needs_review' | 'submitted'
export type FilingReceiptStatus = 'missing' | 'stored'
export type FilingTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'

export type FilingPeriod = {
  filingPeriodKey: string
  filingLabel: string
  payrollPeriodKey: string
  payrollLabel: string
}

export type FilingSupportItem = {
  id: string
  type: FilingItemType
  title: string
  description: string
  meta: string[]
  sourceModule: 'vat' | 'payroll'
  sourceRefId: string | null
  status: FilingItemStatus
  statusLabel: string
  packageStatus: FilingPackageStatus
  packageStatusLabel: string
  lockReason: string | null
  primaryActionLabel: string
  secondaryHref: string
  secondaryActionLabel: string
  tone: FilingTone
}

export type FilingGuideStep = {
  number: number
  title: string
  description: string
  values: Array<{ label: string; value: string }>
  done: boolean
}

export type FilingInputGuide = {
  title: string
  description: string
  targetItemType: FilingItemType
  steps: FilingGuideStep[]
  copyPayload: string
  downloadActionLabel: string | null
}

export type FilingReceiptRow = {
  id: string
  itemType: FilingItemType
  title: string
  description: string
  status: FilingReceiptStatus
  uploadedAt: string | null
  receiptType: 'hometax_receipt' | 'payment_receipt' | 'insurance_receipt'
}

export type FilingChecklistRow = {
  id: string
  code: string
  label: string
  description: string
  completed: boolean
  itemType: FilingItemType | null
}

export type FilingSupportSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: FilingPeriod
  responsibility: {
    title: string
    description: string
  }
  items: FilingSupportItem[]
  guide: FilingInputGuide
  receipts: FilingReceiptRow[]
  checklist: FilingChecklistRow[]
  hasSourceArtifacts: boolean
}

type LoadFilingSupportSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

type VatFilingSource = {
  id: string
  payableTaxKrw: number
  pendingDeductionCount: number
  packageStatus: 'locked' | 'ready' | 'generated'
  packageStorageKey: string | null
}

type PayrollFilingSource = {
  id: string
  employeeCount: number
  grossPayKrw: number
  withholdingTaxKrw: number
  socialInsuranceKrw: number
  noticeImportStatus: 'missing' | 'partial' | 'matched'
  closeStatus: 'open' | 'blocked' | 'closed'
  issueCount: number
  withholdingStatementStatus: 'not_generated' | 'ready' | 'generated' | 'failed'
  insuranceStatementStatus: 'not_generated' | 'ready' | 'generated' | 'failed'
}

type FilingItemOverride = {
  id: string
  itemType: FilingItemType
  status: FilingItemStatus
  packageStatus: FilingPackageStatus
  lockReason: string | null
  packageStorageKey: string | null
  submittedAt: string | null
}

const DEFAULT_TZ = 'Asia/Seoul'

export const FILING_RESPONSIBILITY = {
  title: 'JARYO Company는 신고서 제출을 대행하지 않습니다.',
  description: '첨부 패키지 생성과 홈택스 단계별 입력 가이드까지 지원하며, 실제 제출과 납부는 회사가 홈택스에서 직접 진행하고 접수증만 보관합니다.',
} as const

const CHECKLIST_DEFINITIONS: Array<{
  code: string
  label: string
  description: string
  itemType: FilingItemType | null
  sortOrder: number
}> = [
  {
    code: 'withholding_payment',
    label: '원천세 납부서 확인 및 이체',
    description: '6월 귀속 · 납부기한 2026-07-10',
    itemType: 'withholding',
    sortOrder: 10,
  },
  {
    code: 'insurance_notice_reconciled',
    label: '4대보험 고지금액 확인',
    description: '공단 고지서 대사 완료',
    itemType: 'social_insurance',
    sortOrder: 20,
  },
  {
    code: 'vat_payment',
    label: '부가세 납부서 발급 및 납부',
    description: '신고 확정 후 · 납부기한 2026-07-25',
    itemType: 'vat',
    sortOrder: 30,
  },
  {
    code: 'receipts_archived',
    label: '신고 접수증 3종 보관 완료',
    description: '부가세 접수증 업로드 대기',
    itemType: null,
    sortOrder: 40,
  },
]

function safeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function buildFilingItemId(params: {
  tenantId: string
  clientId: string
  filingPeriodKey: string
  itemType: FilingItemType
}) {
  return [
    'filing_item',
    safeKeyPart(params.tenantId),
    safeKeyPart(params.clientId),
    safeKeyPart(params.filingPeriodKey),
    params.itemType,
  ].join('__')
}

export function buildChecklistItemId(params: {
  tenantId: string
  clientId: string
  filingPeriodKey: string
  code: string
}) {
  return [
    'filing_checklist',
    safeKeyPart(params.tenantId),
    safeKeyPart(params.clientId),
    safeKeyPart(params.filingPeriodKey),
    safeKeyPart(params.code),
  ].join('__')
}

export function resolvePayrollPeriodKey(period: Pick<CompanyHomePeriod, 'endMonth'>) {
  return period.endMonth
}

export function buildFilingPeriod(period: CompanyHomePeriod): FilingPeriod {
  const year = period.key.slice(0, 4)
  const filingHalf = period.key.endsWith('H2') ? '2기' : '1기'
  const payrollMonth = Number(period.endMonth.slice(5, 7))

  return {
    filingPeriodKey: period.key,
    filingLabel: `${year}년 ${filingHalf}`,
    payrollPeriodKey: resolvePayrollPeriodKey(period),
    payrollLabel: `${year}년 ${payrollMonth}월 귀속`,
  }
}

export function formatKrw(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
}

export function splitWithholdingTax(totalKrw: number) {
  const localIncomeTaxKrw = Math.floor((totalKrw / 11) / 1_000) * 1_000
  return {
    incomeTaxKrw: totalKrw - localIncomeTaxKrw,
    localIncomeTaxKrw,
  }
}

function isReadyDocument(status: PayrollFilingSource['withholdingStatementStatus']) {
  return status === 'ready' || status === 'generated'
}

function packageLabel(status: FilingPackageStatus) {
  switch (status) {
    case 'submitted':
      return '제출 기록됨'
    case 'generated':
    case 'ready':
      return '패키지 준비됨'
    case 'locked':
    default:
      return '패키지 대기'
  }
}

function itemStatusLabel(status: FilingItemStatus) {
  switch (status) {
    case 'submitted':
      return '제출 기록됨'
    case 'ready':
      return '패키지 준비됨'
    case 'needs_review':
      return '확인 필요'
    case 'locked':
    default:
      return '패키지 대기'
  }
}

function overrideSubmitted(base: FilingSupportItem, override: FilingItemOverride | undefined): FilingSupportItem {
  if (!override || override.status !== 'submitted') return base
  return {
    ...base,
    status: 'submitted',
    statusLabel: '제출 기록됨',
    packageStatus: 'submitted',
    packageStatusLabel: '제출 기록됨',
    lockReason: null,
    primaryActionLabel: '접수증 보기',
    tone: 'ok',
  }
}

export function buildFilingItems(params: {
  tenantId: string
  clientId: string
  period: FilingPeriod
  vat: VatFilingSource | null
  payroll: PayrollFilingSource | null
  overrides?: FilingItemOverride[]
}): FilingSupportItem[] {
  const overrides = new Map((params.overrides ?? []).map((row) => [row.itemType, row]))
  const vatItemId = buildFilingItemId({ ...params, filingPeriodKey: params.period.filingPeriodKey, itemType: 'vat' })
  const withholdingItemId = buildFilingItemId({ ...params, filingPeriodKey: params.period.filingPeriodKey, itemType: 'withholding' })
  const insuranceItemId = buildFilingItemId({ ...params, filingPeriodKey: params.period.filingPeriodKey, itemType: 'social_insurance' })

  const vatPending = params.vat?.pendingDeductionCount ?? 0
  const vatReady = Boolean(params.vat) && vatPending === 0 && params.vat!.packageStatus !== 'locked'
  const vatBase: FilingSupportItem = {
    id: vatItemId,
    type: 'vat',
    title: `${params.period.filingLabel} 부가가치세 (확정)`,
    description: params.vat
      ? `납부(예정) ${formatKrw(params.vat.payableTaxKrw)} · 마감 2026-07-25`
      : '부가세 summary 생성 대기',
    meta: [
      '부가세 화면 연동',
      vatPending > 0 ? `불공제 검토 ${vatPending}건 완료 후 패키지 확정` : '공제 검토 완료 후 패키지 확정',
    ],
    sourceModule: 'vat',
    sourceRefId: params.vat?.id ?? null,
    status: vatReady ? 'ready' : 'locked',
    statusLabel: vatReady ? '패키지 준비됨' : '패키지 대기',
    packageStatus: vatReady ? params.vat!.packageStatus : 'locked',
    packageStatusLabel: vatReady ? packageLabel(params.vat!.packageStatus) : '패키지 대기',
    lockReason: vatReady ? null : params.vat ? `부가세 공제 검토 ${vatPending}건을 먼저 완료하세요` : '부가세 집계를 먼저 생성하세요',
    primaryActionLabel: vatReady ? '패키지 열기' : '패키지 · 잠김',
    secondaryHref: `/dashboard/vat?period=${params.period.filingPeriodKey}`,
    secondaryActionLabel: '부가세 열기',
    tone: vatReady ? 'ok' : 'warn',
  }

  const withholdingReady = Boolean(params.payroll)
    && params.payroll!.closeStatus === 'closed'
    && isReadyDocument(params.payroll!.withholdingStatementStatus)
  const withholdingBase: FilingSupportItem = {
    id: withholdingItemId,
    type: 'withholding',
    title: `${params.period.payrollLabel} 원천징수이행상황신고`,
    description: params.payroll
      ? `원천세 ${formatKrw(params.payroll.withholdingTaxKrw)}`
      : '급여 마감 및 지급명세서 생성 대기',
    meta: ['급여 화면 연동', withholdingReady ? '지급명세서 첨부 준비됨' : '급여 마감·지급명세서 생성 필요'],
    sourceModule: 'payroll',
    sourceRefId: params.payroll?.id ?? null,
    status: withholdingReady ? 'ready' : 'locked',
    statusLabel: withholdingReady ? '패키지 준비됨' : '패키지 대기',
    packageStatus: withholdingReady ? 'generated' : 'locked',
    packageStatusLabel: withholdingReady ? '패키지 준비됨' : '패키지 대기',
    lockReason: withholdingReady ? null : '급여 마감과 원천징수 지급명세서 생성을 먼저 완료하세요',
    primaryActionLabel: withholdingReady ? '패키지 열기' : '패키지 · 잠김',
    secondaryHref: `/dashboard/payroll?period=${params.period.payrollPeriodKey}`,
    secondaryActionLabel: '급여 열기',
    tone: withholdingReady ? 'ok' : 'warn',
  }

  const insuranceReady = Boolean(params.payroll)
    && params.payroll!.issueCount === 0
    && params.payroll!.noticeImportStatus === 'matched'
    && isReadyDocument(params.payroll!.insuranceStatementStatus)
  const insuranceBase: FilingSupportItem = {
    id: insuranceItemId,
    type: 'social_insurance',
    title: `${params.period.payrollLabel} 4대보험 보수총액 신고`,
    description: params.payroll ? `국민연금·건강·고용 신고 자료 ${formatKrw(params.payroll.socialInsuranceKrw)}` : '급여·고지액 매칭 대기',
    meta: ['급여 화면 연동', insuranceReady ? '공단 EDI 제출용 자료 준비됨' : '공단 EDI 제출용 자료 확인 필요'],
    sourceModule: 'payroll',
    sourceRefId: params.payroll?.id ?? null,
    status: insuranceReady ? 'ready' : 'needs_review',
    statusLabel: insuranceReady ? '패키지 준비됨' : '확인 필요',
    packageStatus: insuranceReady ? 'generated' : 'locked',
    packageStatusLabel: insuranceReady ? '패키지 준비됨' : '확인 필요',
    lockReason: insuranceReady ? null : '4대보험 고지액 매칭과 자료 생성을 확인하세요',
    primaryActionLabel: insuranceReady ? '자료 열기' : '자료 확인',
    secondaryHref: `/dashboard/payroll?period=${params.period.payrollPeriodKey}`,
    secondaryActionLabel: '급여 열기',
    tone: insuranceReady ? 'ok' : 'warn',
  }

  return [
    overrideSubmitted(vatBase, overrides.get('vat')),
    overrideSubmitted(withholdingBase, overrides.get('withholding')),
    overrideSubmitted(insuranceBase, overrides.get('social_insurance')),
  ].map((item) => ({
    ...item,
    statusLabel: itemStatusLabel(item.status),
    packageStatusLabel: packageLabel(item.packageStatus),
  }))
}

export function buildFilingInputGuide(params: {
  period: FilingPeriod
  payroll: PayrollFilingSource | null
  withholdingItem: FilingSupportItem
}): FilingInputGuide {
  const employeeCount = params.payroll?.employeeCount ?? 0
  const grossPayKrw = params.payroll?.grossPayKrw ?? 0
  const withholdingTaxKrw = params.payroll?.withholdingTaxKrw ?? 0
  const { incomeTaxKrw, localIncomeTaxKrw } = splitWithholdingTax(withholdingTaxKrw)
  const copyPayload = [
    `${params.period.payrollLabel} 원천세 신고 입력값`,
    `간이세액 대상: ${employeeCount.toLocaleString('ko-KR')}명`,
    `총지급액: ${formatKrw(grossPayKrw)}`,
    `징수세액: ${formatKrw(incomeTaxKrw)}`,
    `지방소득세: ${formatKrw(localIncomeTaxKrw)}`,
  ].join('\n')

  return {
    title: '홈택스 입력 가이드 · 원천세',
    description: '아래 값을 홈택스 해당 항목에 그대로 입력하세요. (자동 제출 아님)',
    targetItemType: 'withholding',
    steps: [
      {
        number: 1,
        title: '홈택스 로그인 → 원천세 신고 메뉴 이동',
        description: '국세청 홈택스에서 회사 공동인증서로 로그인',
        values: [],
        done: true,
      },
      {
        number: 2,
        title: '인원·총지급액 입력',
        description: '간이세액 대상과 총지급액을 입력',
        values: [
          { label: '간이세액 대상', value: `${employeeCount.toLocaleString('ko-KR')}명` },
          { label: '총지급액', value: formatKrw(grossPayKrw) },
        ],
        done: false,
      },
      {
        number: 3,
        title: '소득세액 입력',
        description: '징수세액을 입력하고 지방소득세는 위택스에서 별도 확인',
        values: [
          { label: '징수세액', value: formatKrw(incomeTaxKrw) },
          { label: '지방소득세', value: formatKrw(localIncomeTaxKrw) },
        ],
        done: false,
      },
      {
        number: 4,
        title: '신고서 제출 → 접수증 저장',
        description: '제출 후 접수증을 제출 접수증 보관 영역에 업로드',
        values: [],
        done: false,
      },
    ],
    copyPayload,
    downloadActionLabel: params.withholdingItem.status === 'ready' || params.withholdingItem.status === 'submitted'
      ? '지급명세서 다운로드'
      : null,
  }
}

function receiptFallbackTitle(itemType: FilingItemType, period: FilingPeriod) {
  if (itemType === 'vat') return `${period.filingLabel} 부가세 접수증`
  if (itemType === 'withholding') return `${period.payrollLabel} 원천징수 접수증`
  return `${period.payrollLabel} 보수총액 신고 접수증`
}

function receiptTypeForItem(itemType: FilingItemType): FilingReceiptRow['receiptType'] {
  if (itemType === 'social_insurance') return 'insurance_receipt'
  return 'hometax_receipt'
}

export function buildFilingReceipts(params: {
  period: FilingPeriod
  items: FilingSupportItem[]
  storedReceipts: Array<{
    id: string
    filingItemId: string
    receiptType: FilingReceiptRow['receiptType']
    originalFilename: string
    uploadedAt: string
  }>
}): FilingReceiptRow[] {
  const receiptsByItemId = new Map<string, typeof params.storedReceipts>()
  for (const receipt of params.storedReceipts) {
    const group = receiptsByItemId.get(receipt.filingItemId) ?? []
    group.push(receipt)
    receiptsByItemId.set(receipt.filingItemId, group)
  }

  return params.items.flatMap((item): FilingReceiptRow[] => {
    const stored = receiptsByItemId.get(item.id) ?? []
    if (stored.length > 0) {
      return stored.map((receipt) => ({
        id: receipt.id,
        itemType: item.type,
        title: receipt.originalFilename,
        description: `${formatReceiptDate(receipt.uploadedAt)} 제출 · 보관 완료`,
        status: 'stored' as const,
        uploadedAt: receipt.uploadedAt,
        receiptType: receipt.receiptType,
      }))
    }

    return [{
      id: `missing:${item.type}`,
      itemType: item.type,
      title: receiptFallbackTitle(item.type, params.period),
      description: '제출 후 업로드 대기',
      status: 'missing' as const,
      uploadedAt: null,
      receiptType: receiptTypeForItem(item.type),
    }]
  })
}

function formatReceiptDate(iso: string) {
  const datePart = iso.slice(0, 10)
  return datePart || iso
}

export function buildFilingChecklist(params: {
  tenantId: string
  clientId: string
  filingPeriodKey: string
  storedItems: Array<{
    id: string
    code: string
    completed: boolean
  }>
}): FilingChecklistRow[] {
  const storedByCode = new Map(params.storedItems.map((item) => [item.code, item]))
  return CHECKLIST_DEFINITIONS.map((definition) => {
    const stored = storedByCode.get(definition.code)
    return {
      id: stored?.id ?? buildChecklistItemId({
        tenantId: params.tenantId,
        clientId: params.clientId,
        filingPeriodKey: params.filingPeriodKey,
        code: definition.code,
      }),
      code: definition.code,
      label: definition.label,
      description: definition.description,
      completed: stored?.completed ?? false,
      itemType: definition.itemType,
    }
  })
}

export function buildDefaultFilingItemRecord(params: {
  tenantId: string
  clientId: string
  period: FilingPeriod
  item: FilingSupportItem
  timestamp: string
}) {
  return {
    id: params.item.id,
    tenantId: params.tenantId,
    clientId: params.clientId,
    filingPeriodKey: params.period.filingPeriodKey,
    payrollPeriodKey: params.period.payrollPeriodKey,
    itemType: params.item.type,
    sourceModule: params.item.sourceModule,
    sourceRefId: params.item.sourceRefId,
    title: params.item.title,
    description: params.item.description,
    status: params.item.status,
    packageStatus: params.item.packageStatus,
    lockReason: params.item.lockReason,
    packageStorageKey: null,
    generatedAt: null,
    submittedAt: null,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }
}

export function checklistDefinitionForCode(code: string) {
  return CHECKLIST_DEFINITIONS.find((item) => item.code === code) ?? null
}

export async function loadFilingSupportSummary({
  tenantId,
  periodKey,
  today,
}: LoadFilingSupportSummaryParams): Promise<FilingSupportSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const companyPeriod = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })
  const period = buildFilingPeriod(companyPeriod)

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = {
    tenant: tenantRow,
    businessEntity,
    period,
    responsibility: FILING_RESPONSIBILITY,
  }

  if (!businessEntity) {
    return {
      ...base,
      items: [],
      guide: buildFilingInputGuide({
        period,
        payroll: null,
        withholdingItem: {
          id: 'missing',
          type: 'withholding',
          title: '원천세',
          description: '',
          meta: [],
          sourceModule: 'payroll',
          sourceRefId: null,
          status: 'locked',
          statusLabel: '패키지 대기',
          packageStatus: 'locked',
          packageStatusLabel: '패키지 대기',
          lockReason: null,
          primaryActionLabel: '패키지 · 잠김',
          secondaryHref: '/dashboard/payroll',
          secondaryActionLabel: '급여 열기',
          tone: 'muted',
        },
      }),
      receipts: [],
      checklist: [],
      hasSourceArtifacts: false,
    }
  }

  const itemIds: Record<FilingItemType, string> = {
    vat: buildFilingItemId({ tenantId, clientId: businessEntity.id, filingPeriodKey: period.filingPeriodKey, itemType: 'vat' }),
    withholding: buildFilingItemId({ tenantId, clientId: businessEntity.id, filingPeriodKey: period.filingPeriodKey, itemType: 'withholding' }),
    social_insurance: buildFilingItemId({ tenantId, clientId: businessEntity.id, filingPeriodKey: period.filingPeriodKey, itemType: 'social_insurance' }),
  }

  const [vatRows, payrollRows, filingItemRows, receiptRows, checklistRows] = await Promise.all([
    db
      .select({
        id: vatPeriodSummary.id,
        payableTaxKrw: vatPeriodSummary.payableTaxKrw,
        pendingDeductionCount: vatPeriodSummary.pendingDeductionCount,
        packageStatus: vatPeriodSummary.packageStatus,
        packageStorageKey: vatPeriodSummary.packageStorageKey,
      })
      .from(vatPeriodSummary)
      .where(and(
        eq(vatPeriodSummary.tenantId, tenantId),
        eq(vatPeriodSummary.clientId, businessEntity.id),
        eq(vatPeriodSummary.periodKey, period.filingPeriodKey),
        eq(vatPeriodSummary.filingType, 'final'),
      ))
      .limit(1),
    db
      .select({
        id: payrollPeriodSummary.id,
        employeeCount: payrollPeriodSummary.employeeCount,
        grossPayKrw: payrollPeriodSummary.grossPayKrw,
        withholdingTaxKrw: payrollPeriodSummary.withholdingTaxKrw,
        socialInsuranceKrw: payrollPeriodSummary.socialInsuranceKrw,
        noticeImportStatus: payrollPeriodSummary.noticeImportStatus,
        closeStatus: payrollPeriodSummary.closeStatus,
        issueCount: payrollPeriodSummary.issueCount,
        withholdingStatementStatus: payrollPeriodSummary.withholdingStatementStatus,
        insuranceStatementStatus: payrollPeriodSummary.insuranceStatementStatus,
      })
      .from(payrollPeriodSummary)
      .where(and(
        eq(payrollPeriodSummary.tenantId, tenantId),
        eq(payrollPeriodSummary.clientId, businessEntity.id),
        eq(payrollPeriodSummary.payrollPeriod, period.payrollPeriodKey),
      ))
      .limit(1),
    db
      .select({
        id: filingItem.id,
        itemType: filingItem.itemType,
        status: filingItem.status,
        packageStatus: filingItem.packageStatus,
        lockReason: filingItem.lockReason,
        packageStorageKey: filingItem.packageStorageKey,
        submittedAt: filingItem.submittedAt,
      })
      .from(filingItem)
      .where(and(
        eq(filingItem.tenantId, tenantId),
        eq(filingItem.clientId, businessEntity.id),
        eq(filingItem.filingPeriodKey, period.filingPeriodKey),
      )),
    db
      .select({
        id: filingReceipt.id,
        filingItemId: filingReceipt.filingItemId,
        receiptType: filingReceipt.receiptType,
        originalFilename: filingReceipt.originalFilename,
        uploadedAt: filingReceipt.uploadedAt,
      })
      .from(filingReceipt)
      .where(and(
        eq(filingReceipt.tenantId, tenantId),
        eq(filingReceipt.clientId, businessEntity.id),
        inArray(filingReceipt.filingItemId, Object.values(itemIds)),
      ))
      .orderBy(desc(filingReceipt.uploadedAt), asc(filingReceipt.id)),
    db
      .select({
        id: filingChecklistItem.id,
        code: filingChecklistItem.code,
        completed: filingChecklistItem.completed,
      })
      .from(filingChecklistItem)
      .where(and(
        eq(filingChecklistItem.tenantId, tenantId),
        eq(filingChecklistItem.clientId, businessEntity.id),
        eq(filingChecklistItem.filingPeriodKey, period.filingPeriodKey),
      )),
  ])

  const vat = vatRows[0] ?? null
  const payroll = payrollRows[0] ?? null
  const items = buildFilingItems({
    tenantId,
    clientId: businessEntity.id,
    period,
    vat,
    payroll,
    overrides: filingItemRows as FilingItemOverride[],
  })

  return {
    ...base,
    items,
    guide: buildFilingInputGuide({
      period,
      payroll,
      withholdingItem: items.find((item) => item.type === 'withholding') ?? items[1],
    }),
    receipts: buildFilingReceipts({
      period,
      items,
      storedReceipts: receiptRows,
    }),
    checklist: buildFilingChecklist({
      tenantId,
      clientId: businessEntity.id,
      filingPeriodKey: period.filingPeriodKey,
      storedItems: checklistRows,
    }),
    hasSourceArtifacts: Boolean(vat || payroll),
  }
}

export async function loadFilingSupportAttentionCount(tenantId: string) {
  const summary = await loadFilingSupportSummary({ tenantId })

  return summary.items.filter((item) => item.status === 'locked' || item.status === 'needs_review').length
}

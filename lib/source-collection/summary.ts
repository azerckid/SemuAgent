import { and, desc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  client,
  requestItemValidation,
  requestItemValidationFile,
  tenant,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { resolveUploadedFileDisplay } from '@/lib/upload/file-display'
import { fromISO } from '@/lib/time'

export type SourceCollectionFileStatus =
  | 'uploaded'
  | 'analyzing'
  | 'matched'
  | 'needs_review'
  | 'rejected'
  | 'failed'

export type SourceCollectionSourceType =
  | 'tax_invoice'
  | 'bank_statement'
  | 'card_purchase'
  | 'receipt_other'

export type SourceCollectionTone = 'ok' | 'warn' | 'muted' | 'info'

export type SourceCollectionCompleteness = {
  collectedCount: number
  requiredCount: number
  missingCount: number
  progressPercent: number
}

export type SourceCollectionSourceTypeTile = {
  id: SourceCollectionSourceType
  title: string
  collectedCount: number
  requiredCount: number
  statusLabel: string
  tone: SourceCollectionTone
}

export type SourceCollectionImportRow = {
  id: string
  safeTitle: string
  sourceType: SourceCollectionSourceType | 'unknown'
  progressPercent: number
  status: SourceCollectionFileStatus
  statusLabel: string
  uploadedAt: string
  rowCountLabel: string | null
  href: string
  canRetry: boolean
}

export type SourceCollectionMissingItem = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: '다시 업로드' | '정규화 확인'
}

export type SourceCollectionSummary = {
  tenant: {
    id: string
    name: string
    timezone: string
  }
  businessEntity: {
    id: string
    name: string
  } | null
  period: CompanyHomePeriod
  completeness: SourceCollectionCompleteness
  sourceTypeTiles: SourceCollectionSourceTypeTile[]
  importRows: SourceCollectionImportRow[]
  missingItems: SourceCollectionMissingItem[]
}

type ValidationRow = {
  id: string
  itemName: string
  itemGroup: string | null
  validationStatus: string
  requestedAction: string | null
}

type UploadFileRow = {
  id: string
  fileType: string
  fileSize: number
  status: string
  passwordStatus: string | null
  uploadedAt: string
}

type LoadSourceCollectionSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

const ROUTES = {
  sourceCollection: '/dashboard/direct-upload',
  bookkeeping: '/dashboard/reviews',
}

const DEFAULT_TZ = 'Asia/Seoul'
const MATERIAL_ISSUE_STATUSES = ['missing', 'non_compliant', 'uncertain'] as const

const SOURCE_TYPE_TILES: Array<{ id: SourceCollectionSourceType; title: string }> = [
  { id: 'tax_invoice', title: '세금계산서' },
  { id: 'bank_statement', title: '통장 거래내역' },
  { id: 'card_purchase', title: '카드 매입내역' },
  { id: 'receipt_other', title: '영수증·기타' },
]

// item_group은 lib/review/default-criteria-data.ts의 기본 항목(bookkeeping/vat)
// 실제 값 기준으로 매핑한다. 매핑되지 않는 값은 전부 receipt_other 타일로 합산한다.
const ITEM_GROUP_SOURCE_TYPE_MAP: Record<string, SourceCollectionSourceType> = {
  bank_statement: 'bank_statement',
  card_statement: 'card_purchase',
  vat_business_card_purchase: 'card_purchase',
  sales_tax_invoice: 'tax_invoice',
  purchase_tax_invoice: 'tax_invoice',
  vat_sales_tax_invoice: 'tax_invoice',
  vat_purchase_tax_invoice: 'tax_invoice',
  cash_receipt: 'receipt_other',
  online_sales_pg_settlement: 'receipt_other',
  journal_entry_workbook: 'receipt_other',
  other_evidence: 'receipt_other',
  vat_card_sales: 'receipt_other',
  vat_cash_receipt_sales: 'receipt_other',
  vat_other_evidence: 'receipt_other',
}

const FILE_STATUS_PROGRESS: Record<string, number> = {
  uploaded: 20,
  analyzing: 60,
  matched: 100,
  needs_review: 100,
  rejected: 0,
  failed: 20,
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${exponent === 0 ? value : value.toFixed(1)}${units[exponent]}`
}

export function mapItemGroupToSourceType(itemGroup: string | null | undefined): SourceCollectionSourceType | 'unknown' {
  if (!itemGroup) return 'unknown'
  return ITEM_GROUP_SOURCE_TYPE_MAP[itemGroup] ?? 'unknown'
}

export function buildSourceCollectionCompleteness(
  rows: Array<Pick<ValidationRow, 'validationStatus'>>,
): SourceCollectionCompleteness {
  const requiredCount = rows.length
  const missingCount = rows.filter((row) => MATERIAL_ISSUE_STATUSES.includes(row.validationStatus as (typeof MATERIAL_ISSUE_STATUSES)[number])).length
  const collectedCount = Math.max(0, requiredCount - missingCount)
  const progressPercent = requiredCount === 0
    ? 100
    : clampPercent((collectedCount / requiredCount) * 100)

  return { collectedCount, requiredCount, missingCount, progressPercent }
}

export function buildSourceCollectionSourceTypeTiles(
  rows: Array<Pick<ValidationRow, 'itemGroup' | 'validationStatus'>>,
): SourceCollectionSourceTypeTile[] {
  return SOURCE_TYPE_TILES.map(({ id, title }) => {
    const groupRows = rows.filter((row) => {
      const mapped = mapItemGroupToSourceType(row.itemGroup)
      // 미매핑(unknown) 항목은 전부 receipt_other 타일로 합산한다.
      return mapped === id || (mapped === 'unknown' && id === 'receipt_other')
    })

    const requiredCount = groupRows.length
    // MATERIAL_ISSUE_STATUSES에는 'uncertain'(저신뢰 정규화)도 포함된다. 파일 단위
    // "정규화 대기"(info)는 validationStatus만으로는 missing과 구분되지 않아 후속
    // (파일 상태 연계) 과제로 남긴다 — 여기서는 warn/ok/muted 3단계만 파생한다.
    const missingCount = groupRows.filter((row) => MATERIAL_ISSUE_STATUSES.includes(row.validationStatus as (typeof MATERIAL_ISSUE_STATUSES)[number])).length
    const collectedCount = Math.max(0, requiredCount - missingCount)

    let tone: SourceCollectionTone
    let statusLabel: string
    if (requiredCount === 0) {
      tone = 'muted'
      statusLabel = '자료 없음'
    } else if (missingCount > 0) {
      tone = 'warn'
      statusLabel = `${missingCount}건 미수집`
    } else {
      tone = 'ok'
      statusLabel = '정규화 완료'
    }

    return { id, title, collectedCount, requiredCount, statusLabel, tone }
  })
}

// resolveUploadedFileDisplay는 상태 라벨(예: "처리 지연")을 제공할 뿐 파일명을 대체하지
// 않는다. 원본 파일명·storage key를 노출하지 않는 safeTitle은 fileType·sourceType
// 기반으로 이 함수에서 직접 파생한다.
const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  image: '이미지',
  other: '기타',
}

export function buildSourceCollectionImportRow(
  file: UploadFileRow,
  sourceType: SourceCollectionSourceType | 'unknown' = 'unknown',
): SourceCollectionImportRow {
  const display = resolveUploadedFileDisplay(file)
  const fileTypeLabel = FILE_TYPE_LABEL[file.fileType] ?? '기타'
  const sourceTypeTitle = sourceType === 'unknown'
    ? '분류 대기'
    : SOURCE_TYPE_TILES.find((tile) => tile.id === sourceType)?.title ?? '분류 대기'

  return {
    id: file.id,
    safeTitle: `${sourceTypeTitle} · ${fileTypeLabel} 자료`,
    sourceType,
    progressPercent: FILE_STATUS_PROGRESS[file.status] ?? 0,
    status: (file.status as SourceCollectionFileStatus) ?? 'uploaded',
    statusLabel: display.label,
    uploadedAt: fromISO(file.uploadedAt).toISODate() ?? file.uploadedAt.slice(0, 10),
    rowCountLabel: formatFileSize(file.fileSize),
    href: `${ROUTES.sourceCollection}?fileId=${file.id}`,
    canRetry: file.status === 'failed',
  }
}

export function buildSourceCollectionMissingItems(
  rows: Array<Pick<ValidationRow, 'id' | 'itemName' | 'validationStatus' | 'requestedAction'>>,
): SourceCollectionMissingItem[] {
  const items: SourceCollectionMissingItem[] = []

  for (const row of rows) {
    if (row.validationStatus === 'missing') {
      items.push({
        id: row.id,
        title: row.itemName,
        description: row.requestedAction ?? '필수 자료가 아직 업로드되지 않았습니다.',
        tone: 'warn',
        href: ROUTES.sourceCollection,
        ctaLabel: '다시 업로드',
      })
    } else if (row.validationStatus === 'non_compliant') {
      items.push({
        id: row.id,
        title: row.itemName,
        description: row.requestedAction ?? '업로드된 자료가 요건을 충족하지 않습니다.',
        tone: 'danger',
        href: ROUTES.sourceCollection,
        ctaLabel: '다시 업로드',
      })
    } else if (row.validationStatus === 'uncertain') {
      items.push({
        id: row.id,
        title: row.itemName,
        description: row.requestedAction ?? '자동 분류 신뢰도가 낮아 확인이 필요합니다.',
        tone: 'warn',
        href: ROUTES.bookkeeping,
        ctaLabel: '정규화 확인',
      })
    }
  }

  return items
}

type FileItemGroupLinkRow = {
  uploadFileId: string
  validationId: string
  itemGroup: string | null
  contribution: string | null
  createdAt: string
}

// request_item_validation_file은 파일 하나가 여러 validation에 기여할 수 있는
// 구조다(예: 세금계산서+기타증빙). DB 반환 순서에 의존하면 safeTitle/sourceType이
// 비결정적으로 흔들리므로, contribution 우선순위(만족 > 부분만족 > 불확실 > 불일치 >
// 무관) → createdAt 오름차순 → validationId 오름차순(동시 생성 tie-break)으로 정렬해
// 파일당 하나의 itemGroup만 완전히 결정적으로 고른다.
const CONTRIBUTION_RANK: Record<string, number> = {
  satisfied: 0,
  partial: 1,
  uncertain: 2,
  non_compliant: 3,
  unrelated: 4,
}

export function buildFileItemGroupMap(rows: FileItemGroupLinkRow[]): Map<string, string | null> {
  const sorted = [...rows].sort((a, b) => {
    const rankA = a.contribution ? CONTRIBUTION_RANK[a.contribution] ?? 5 : 5
    const rankB = b.contribution ? CONTRIBUTION_RANK[b.contribution] ?? 5 : 5
    return rankA - rankB || a.createdAt.localeCompare(b.createdAt) || a.validationId.localeCompare(b.validationId)
  })

  const map = new Map<string, string | null>()
  for (const row of sorted) {
    if (!map.has(row.uploadFileId)) {
      map.set(row.uploadFileId, row.itemGroup)
    }
  }
  return map
}

export async function loadSourceCollectionSummary({
  tenantId,
  periodKey,
  today,
}: LoadSourceCollectionSummaryParams): Promise<SourceCollectionSummary> {
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
  const baseSummary = { tenant: tenantRow, businessEntity, period }

  if (!businessEntity) {
    return {
      ...baseSummary,
      completeness: { collectedCount: 0, requiredCount: 0, missingCount: 0, progressPercent: 100 },
      sourceTypeTiles: buildSourceCollectionSourceTypeTiles([]),
      importRows: [],
      missingItems: [],
    }
  }

  const scopedSession = and(
    eq(uploadSession.tenantId, tenantId),
    eq(uploadSession.clientId, businessEntity.id),
    eq(uploadSession.source, 'staff_direct'),
    isNull(uploadSession.deletedAt),
    gte(uploadSession.accountingPeriod, period.startMonth),
    lte(uploadSession.accountingPeriod, period.endMonth),
  )

  const [validationRows, fileRows] = await Promise.all([
    db
      .select({
        id: requestItemValidation.id,
        itemName: requestItemValidation.itemName,
        itemGroup: requestItemValidation.itemGroup,
        validationStatus: requestItemValidation.validationStatus,
        requestedAction: requestItemValidation.requestedAction,
      })
      .from(requestItemValidation)
      .innerJoin(uploadSession, and(eq(requestItemValidation.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(requestItemValidation.tenantId, tenantId),
        ne(requestItemValidation.reviewStatus, 'excluded'),
      )),
    db
      .select({
        id: uploadFile.id,
        fileType: uploadFile.fileType,
        fileSize: uploadFile.fileSize,
        status: uploadFile.status,
        passwordStatus: uploadFile.passwordStatus,
        uploadedAt: uploadFile.uploadedAt,
      })
      .from(uploadFile)
      .innerJoin(uploadSession, and(eq(uploadFile.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(uploadFile.tenantId, tenantId),
        ne(uploadFile.staffReviewStatus, 'excluded'),
      ))
      .orderBy(desc(uploadFile.uploadedAt)),
  ])

  // 파일별 자료유형은 request_item_validation_file(uploadFileId ↔ validationId)을 통해
  // request_item_validation.itemGroup과 연결한다. 승인 Preview의 "수집 상태 표"가
  // 파일마다 자료유형을 보여주므로, 항상 unknown으로 두지 않고 실제 연결을 조회한다.
  // 한 파일이 여러 validation에 기여할 수 있어(예: 세금계산서+기타증빙), DB 반환
  // 순서에 의존하지 않도록 contribution 우선순위 → createdAt → validationId로
  // 결정적으로 고른다.
  const fileIds = fileRows.map((file) => file.id)
  const fileItemGroupRows = fileIds.length > 0
    ? await db
      .select({
        uploadFileId: requestItemValidationFile.uploadFileId,
        validationId: requestItemValidationFile.validationId,
        itemGroup: requestItemValidation.itemGroup,
        contribution: requestItemValidationFile.contribution,
        createdAt: requestItemValidationFile.createdAt,
      })
      .from(requestItemValidationFile)
      .innerJoin(requestItemValidation, eq(requestItemValidationFile.validationId, requestItemValidation.id))
      .where(and(
        eq(requestItemValidationFile.tenantId, tenantId),
        eq(requestItemValidation.tenantId, tenantId),
        ne(requestItemValidation.reviewStatus, 'excluded'),
        inArray(requestItemValidationFile.uploadFileId, fileIds),
      ))
    : []

  const fileItemGroupMap = buildFileItemGroupMap(fileItemGroupRows)

  return {
    ...baseSummary,
    completeness: buildSourceCollectionCompleteness(validationRows),
    sourceTypeTiles: buildSourceCollectionSourceTypeTiles(validationRows),
    importRows: fileRows.map((file) => buildSourceCollectionImportRow(
      file,
      mapItemGroupToSourceType(fileItemGroupMap.get(file.id)),
    )),
    missingItems: buildSourceCollectionMissingItems(validationRows),
  }
}

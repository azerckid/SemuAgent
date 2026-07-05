import { and, desc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  client,
  requestItemValidation,
  requestItemValidationFile,
  sourceBatch,
  tenant,
  uploadFile,
} from '@/lib/db/schema'
import { resolveUploadedFileDisplay } from '@/lib/upload/file-display'
import { internalSourceBatchReadKindCondition } from '@/lib/source-batch/scope'
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
  normalizationPendingCount: number
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
  uploadSessionId: string
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
  bookkeeping: '/dashboard/bookkeeping',
}

const DEFAULT_TZ = 'Asia/Seoul'
const MATERIAL_MISSING_STATUSES = ['missing', 'non_compliant'] as const

const SOURCE_TYPE_TILES: Array<{ id: SourceCollectionSourceType; title: string }> = [
  { id: 'tax_invoice', title: '세금계산서' },
  { id: 'bank_statement', title: '통장 거래내역' },
  { id: 'card_purchase', title: '카드 매입내역' },
  { id: 'receipt_other', title: '영수증 · 기타' },
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

const NORMALIZATION_PENDING_STATUSES = ['uploaded', 'analyzing'] as const

const FILE_STATUS_PROGRESS: Record<string, number> = {
  uploaded: 20,
  analyzing: 60,
  matched: 100,
  needs_review: 100,
  rejected: 0,
  failed: 20,
}

const SOURCE_COLLECTION_FILE_STATUS_LABEL: Record<string, string> = {
  uploaded: '정규화 대기',
  analyzing: '정규화 진행 중',
  matched: '정규화 완료',
  needs_review: '확인 필요',
  rejected: '제외됨',
  failed: '파싱 오류',
}

const IMPORT_ROW_STATUS_RANK: Record<SourceCollectionFileStatus, number> = {
  matched: 0,
  needs_review: 1,
  analyzing: 2,
  uploaded: 3,
  failed: 4,
  rejected: 5,
}

const IMPORT_ROW_SOURCE_TYPE_RANK: Record<SourceCollectionSourceType | 'unknown', number> = {
  tax_invoice: 0,
  bank_statement: 1,
  receipt_other: 2,
  card_purchase: 3,
  unknown: 4,
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

type SourceCollectionTileFileRow = {
  status: string
  sourceType: SourceCollectionSourceType | 'unknown'
}

export function sourceCollectionSourceTypeLabel(sourceType: SourceCollectionSourceType | 'unknown') {
  if (sourceType === 'unknown') return '분류 대기'
  return SOURCE_TYPE_TILES.find((tile) => tile.id === sourceType)?.title ?? '분류 대기'
}

export function countNormalizationPendingFiles(
  files: Array<Pick<SourceCollectionTileFileRow, 'status'>>,
) {
  return files.filter((file) => NORMALIZATION_PENDING_STATUSES.includes(
    file.status as (typeof NORMALIZATION_PENDING_STATUSES)[number],
  )).length
}

function fileBelongsToSourceTypeTile(
  sourceType: SourceCollectionSourceType | 'unknown',
  tileId: SourceCollectionSourceType,
) {
  return sourceType === tileId || (sourceType === 'unknown' && tileId === 'receipt_other')
}

export function buildSourceCollectionCompleteness(
  rows: Array<Pick<ValidationRow, 'validationStatus'>>,
  files: Array<Pick<SourceCollectionTileFileRow, 'status'>> = [],
): SourceCollectionCompleteness {
  const requiredCount = rows.length
  const missingCount = rows.filter((row) => MATERIAL_MISSING_STATUSES.includes(row.validationStatus as (typeof MATERIAL_MISSING_STATUSES)[number])).length
  const uncertainCount = rows.filter((row) => row.validationStatus === 'uncertain').length
  const collectedCount = Math.max(0, requiredCount - missingCount)
  const progressPercent = requiredCount === 0
    ? 0
    : clampPercent((collectedCount / requiredCount) * 100)
  const normalizationPendingCount = uncertainCount > 0
    ? uncertainCount
    : countNormalizationPendingFiles(files)

  return { collectedCount, requiredCount, missingCount, progressPercent, normalizationPendingCount }
}

export function buildSourceCollectionSourceTypeTiles(
  rows: Array<Pick<ValidationRow, 'itemGroup' | 'validationStatus'>>,
  files: SourceCollectionTileFileRow[] = [],
): SourceCollectionSourceTypeTile[] {
  return SOURCE_TYPE_TILES.map(({ id, title }) => {
    const groupRows = rows.filter((row) => {
      const mapped = mapItemGroupToSourceType(row.itemGroup)
      return mapped === id || (mapped === 'unknown' && id === 'receipt_other')
    })

    const requiredCount = groupRows.length
    const missingCount = groupRows.filter((row) => MATERIAL_MISSING_STATUSES.includes(row.validationStatus as (typeof MATERIAL_MISSING_STATUSES)[number])).length
    const uncertainCount = groupRows.filter((row) => row.validationStatus === 'uncertain').length
    const collectedCount = Math.max(0, requiredCount - missingCount)
    const pendingFileCount = files.filter((file) => (
      fileBelongsToSourceTypeTile(file.sourceType, id)
      && NORMALIZATION_PENDING_STATUSES.includes(file.status as (typeof NORMALIZATION_PENDING_STATUSES)[number])
    )).length
    const normalizationPendingCount = uncertainCount > 0 ? uncertainCount : pendingFileCount

    let tone: SourceCollectionTone
    let statusLabel: string
    if (requiredCount === 0 && normalizationPendingCount === 0) {
      tone = 'muted'
      statusLabel = '자료 없음'
    } else if (missingCount > 0) {
      tone = 'warn'
      statusLabel = `${missingCount}건 미수집`
    } else if (normalizationPendingCount > 0) {
      tone = 'info'
      statusLabel = `정규화 대기 ${normalizationPendingCount}`
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
  file: UploadFileRow & { uploadSessionId: string },
  sourceType: SourceCollectionSourceType | 'unknown' = 'unknown',
  periodKey?: string,
): SourceCollectionImportRow {
  const display = resolveUploadedFileDisplay(file)
  const fileTypeLabel = FILE_TYPE_LABEL[file.fileType] ?? '기타'
  const sourceTypeTitle = sourceCollectionSourceTypeLabel(sourceType)
  const safeTitle = sourceType === 'receipt_other' && fileTypeLabel === '기타'
    ? `${sourceTypeTitle} 자료`
    : `${sourceTypeTitle} · ${fileTypeLabel} 자료`
  const canRetry = file.status === 'failed'
  const periodQuery = periodKey ? `period=${periodKey}&` : ''
  const viewQuery = periodKey ? `period=${periodKey}&fileId=${file.id}` : `fileId=${file.id}`

  return {
    id: file.id,
    uploadSessionId: file.uploadSessionId,
    safeTitle,
    sourceType,
    progressPercent: FILE_STATUS_PROGRESS[file.status] ?? 0,
    status: (file.status as SourceCollectionFileStatus) ?? 'uploaded',
    statusLabel: display.isPasswordSubmittable
      ? display.label
      : SOURCE_COLLECTION_FILE_STATUS_LABEL[file.status] ?? display.label,
    uploadedAt: fromISO(file.uploadedAt).toISODate() ?? file.uploadedAt.slice(0, 10),
    rowCountLabel: formatFileSize(file.fileSize),
    href: canRetry
      ? `${ROUTES.sourceCollection}?${periodQuery}fileId=${file.id}&action=retry`
      : `${ROUTES.sourceCollection}?${viewQuery}#import-status`,
    canRetry,
  }
}

export function sortSourceCollectionImportRows(rows: SourceCollectionImportRow[]) {
  return [...rows].sort((a, b) => {
    const statusRankA = IMPORT_ROW_STATUS_RANK[a.status] ?? 99
    const statusRankB = IMPORT_ROW_STATUS_RANK[b.status] ?? 99
    const sourceRankA = IMPORT_ROW_SOURCE_TYPE_RANK[a.sourceType] ?? 99
    const sourceRankB = IMPORT_ROW_SOURCE_TYPE_RANK[b.sourceType] ?? 99

    return statusRankA - statusRankB
      || sourceRankA - sourceRankB
      || a.uploadedAt.localeCompare(b.uploadedAt)
      || a.safeTitle.localeCompare(b.safeTitle)
      || a.id.localeCompare(b.id)
  })
}

export function buildSourceCollectionMissingItems(
  rows: Array<Pick<ValidationRow, 'id' | 'itemName' | 'validationStatus' | 'requestedAction'>>,
): SourceCollectionMissingItem[] {
  const items: SourceCollectionMissingItem[] = []
  const uncertainRows = rows.filter((row) => row.validationStatus === 'uncertain')

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
    }
  }

  if (uncertainRows.length > 0) {
    const first = uncertainRows[0]
    const count = uncertainRows.length
    items.push({
      id: count === 1 ? first.id : `uncertain:${count}`,
      title: count === 1 ? first.itemName : `영수증 묶음 정규화 확인 ${count}건`,
      description: first.requestedAction ?? (count === 1
        ? '자동 분류 신뢰도가 낮아 확인이 필요합니다.'
        : `자동 분류 신뢰도가 낮은 영수증 ${count}건이 검토를 기다립니다.`),
      tone: 'warn',
      href: ROUTES.bookkeeping,
      ctaLabel: '정규화 확인',
    })
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
      completeness: { collectedCount: 0, requiredCount: 0, missingCount: 0, progressPercent: 0, normalizationPendingCount: 0 },
      sourceTypeTiles: buildSourceCollectionSourceTypeTiles([], []),
      importRows: [],
      missingItems: [],
    }
  }

  const scopedSessionRows = await db
    .select({ id: sourceBatch.legacyUploadSessionId })
    .from(sourceBatch)
    .where(and(
      eq(sourceBatch.tenantId, tenantId),
      eq(sourceBatch.clientId, businessEntity.id),
      internalSourceBatchReadKindCondition(),
      isNull(sourceBatch.deletedAt),
      gte(sourceBatch.accountingPeriod, period.startMonth),
      lte(sourceBatch.accountingPeriod, period.endMonth),
    ))
  const scopedSessionIds = scopedSessionRows
    .map((row) => row.id)
    .filter((id): id is string => id !== null)

  const [validationRows, fileRows] = scopedSessionIds.length === 0
    ? [[], []]
    : await Promise.all([
      db
        .select({
          id: requestItemValidation.id,
          itemName: requestItemValidation.itemName,
          itemGroup: requestItemValidation.itemGroup,
          validationStatus: requestItemValidation.validationStatus,
          requestedAction: requestItemValidation.requestedAction,
        })
        .from(requestItemValidation)
        .where(and(
          eq(requestItemValidation.tenantId, tenantId),
          inArray(requestItemValidation.uploadSessionId, scopedSessionIds),
          ne(requestItemValidation.reviewStatus, 'excluded'),
        )),
      db
        .select({
          id: uploadFile.id,
          uploadSessionId: uploadFile.uploadSessionId,
          fileType: uploadFile.fileType,
          fileSize: uploadFile.fileSize,
          status: uploadFile.status,
          passwordStatus: uploadFile.passwordStatus,
          uploadedAt: uploadFile.uploadedAt,
        })
        .from(uploadFile)
        .where(and(
          eq(uploadFile.tenantId, tenantId),
          inArray(uploadFile.uploadSessionId, scopedSessionIds),
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
  const tileFiles: SourceCollectionTileFileRow[] = fileRows.map((file) => ({
    status: file.status,
    sourceType: mapItemGroupToSourceType(fileItemGroupMap.get(file.id)),
  }))

  return {
    ...baseSummary,
    completeness: buildSourceCollectionCompleteness(validationRows, tileFiles),
    sourceTypeTiles: buildSourceCollectionSourceTypeTiles(validationRows, tileFiles),
    importRows: sortSourceCollectionImportRows(fileRows.map((file) => buildSourceCollectionImportRow(
      file,
      mapItemGroupToSourceType(fileItemGroupMap.get(file.id)),
      period.key,
    ))),
    missingItems: buildSourceCollectionMissingItems(validationRows),
  }
}

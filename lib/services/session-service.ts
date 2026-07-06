import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { sourceBatch, uploadSession } from '@/lib/db/schema'
import { getUploadBaseUrl } from '@/lib/env'
import { fromISO, now, toDBString, tokenExpiry } from '@/lib/time'
import { generateRawToken, hashToken } from '@/lib/token'
import {
  seedGeneralDefaultCriteria,
  type GeneralDefaultCriteriaWorkType,
} from '@/lib/review/default-criteria'
import {
  buildBookkeepingPeriodRangeSnapshot,
  emptyBookkeepingPeriodRangeSnapshot,
  type BookkeepingPeriodType,
} from '@/lib/bookkeeping/period-range'
import { normalizeSessionDisplayLabel } from '@/lib/upload-session/display-labels'

export type CreateSessionResult = {
  sessionId: string
  uploadUrl: string
  sourceBatchId?: string
}

export type CreateDirectUploadSessionInput = {
  tenantId: string
  clientId: string
  staffId: string
  displayLabel: string
  accountingPeriod: string
  closingDateISO: string
  requestKind: 'general' | 'payroll'
  workType?: GeneralDefaultCriteriaWorkType
  bookkeepingPeriodType?: BookkeepingPeriodType | null
  analysisNotes?: string | null
  requestEventId?: string | null
  dbClient?: Pick<typeof db, 'insert' | 'select'>
  seedDefaultCriteria?: boolean
}

export async function createDirectUploadSession(
  input: CreateDirectUploadSessionInput,
): Promise<CreateSessionResult> {
  const {
    tenantId,
    clientId,
    staffId,
    displayLabel,
    accountingPeriod,
    closingDateISO,
    requestKind,
    workType,
    bookkeepingPeriodType,
    analysisNotes,
    requestEventId,
    seedDefaultCriteria = true,
  } = input
  const sessionId = randomUUID()
  const sourceBatchId = `source_batch_${sessionId}`
  const dbClient = input.dbClient ?? db
  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = tokenExpiry(closingDateISO)
  const uploadUrl = `${getUploadBaseUrl()}/upload/${rawToken}`
  const periodRangeSnapshot = requestKind === 'general' && workType === 'bookkeeping'
    ? buildBookkeepingPeriodRangeSnapshot({
      accountingPeriod,
      periodType: bookkeepingPeriodType,
    })
    : emptyBookkeepingPeriodRangeSnapshot
  const label = requestKind === 'payroll'
    ? '급여정산'
    : workType === 'vat'
      ? '부가세 자료'
      : workType === 'bookkeeping'
        ? '기장 자료'
        : '자료'
  const requestEmailSubject = `[담당자 직접 업로드] ${accountingPeriod} ${label}`
  const requestEmailBody = [
    '담당자가 고객 메일 발송 없이 테스트/검토용 자료를 직접 업로드한 세션입니다.',
    analysisNotes?.trim() ? `검토 메모: ${analysisNotes.trim()}` : null,
  ].filter(Boolean).join('\n\n')
  const sessionDisplayLabel = normalizeSessionDisplayLabel(displayLabel)

  const createdAt = toDBString(now())

  await dbClient.insert(uploadSession).values({
    id: sessionId,
    tenantId,
    clientId,
    createdByStaffId: staffId,
    accountingPeriod,
    ...periodRangeSnapshot,
    tokenHash,
    uploadUrl,
    expiresAt: toDBString(expiresAt),
    status: 'active',
    analysisNotes: analysisNotes ?? null,
    requestEmailSubject,
    requestEmailBody,
    requestEmailCc: null,
    extractedCriteria: null,
    additionalCriteria: null,
    requestEventId: requestEventId ?? null,
    requestKind,
    source: 'staff_direct',
    staffDirectLabel: sessionDisplayLabel,
    createdAt,
  })

  await dbClient.insert(sourceBatch).values({
    id: sourceBatchId,
    tenantId,
    clientId,
    createdByStaffId: staffId,
    sourceKind: 'staff_direct',
    accountingPeriod,
    ...periodRangeSnapshot,
    displayLabel: sessionDisplayLabel,
    legacyUploadSessionId: sessionId,
    deletedAt: null,
    deletedByStaffId: null,
    createdAt,
    updatedAt: createdAt,
  })

  if (seedDefaultCriteria && requestKind === 'general' && workType) {
    await seedGeneralDefaultCriteria({
      dbClient,
      tenantId,
      uploadSessionId: sessionId,
      requestEventId: requestEventId ?? null,
      workType,
    })
  }

  return { sessionId, uploadUrl, sourceBatchId }
}

/**
 * ISO datetime(dueAt)에서 YYYY-MM-DD 날짜 부분만 추출.
 * tokenExpiry() 입력 형식 변환용.
 */
export function extractDateFromISO(isoDatetime: string): string {
  return fromISO(isoDatetime).toISODate() ?? isoDatetime.slice(0, 10)
}

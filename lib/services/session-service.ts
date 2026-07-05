import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outboundEmail, sourceBatch, uploadSession } from '@/lib/db/schema'
import {
  buildRequestEmailHtml,
  buildSenderFooterText,
  buildStaffRequestConfirmationHtml,
  formatAccountingPeriod,
} from '@/lib/email/templates'
import { requireEmailEnv, env, getUploadBaseUrl } from '@/lib/env'
import { fromISO, now, toDBString, tokenExpiry } from '@/lib/time'
import { generateRawToken, hashToken } from '@/lib/token'
import { ccEmailsForSend, normalizeCcEmails } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { appendDefaultCriteriaSection } from '@/lib/mail-console/default-criteria-section'
import {
  inferGeneralDefaultCriteriaWorkType,
  seedGeneralDefaultCriteria,
  type GeneralDefaultCriteriaWorkType,
} from '@/lib/review/default-criteria'
import {
  buildBookkeepingPeriodRangeSnapshot,
  emptyBookkeepingPeriodRangeSnapshot,
  type BookkeepingPeriodType,
} from '@/lib/bookkeeping/period-range'
import {
  formatNumberedSessionDisplayLabel,
  normalizeSessionDisplayLabel,
} from '@/lib/upload-session/display-labels'

export type CreateSessionInput = {
  tenantId: string
  clientId: string
  staffId: string
  staffName: string
  staffEmail: string
  clientEmail: string
  clientName: string
  clientContactName: string | null
  accountingPeriod: string
  /** YYYY-MM-DD 형식. tokenExpiry() 계산 기준. */
  closingDateISO: string
  requestEmailSubject: string
  /** greeting/footer 제외한 순수 본문. 서비스가 조합. */
  requestEmailBody: string
  requestEmailGreeting?: string
  senderPhone?: string
  requestEmailCc?: string | null
  extractedCriteria?: string | null
  additionalCriteria?: string | null
  analysisNotes?: string | null
  /** 이벤트 기반 발송 시 연결 필드 (optional) */
  requestEventId?: string | null
  requestTemplateId?: string | null
  requestKind?: 'general' | 'payroll'
  defaultCriteriaWorkType?: GeneralDefaultCriteriaWorkType
  bookkeepingPeriodType?: BookkeepingPeriodType | null
}

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

async function computeNextCustomerUploadDisplayLabel(
  dbClient: Pick<typeof db, 'select'>,
  tenantId: string,
  clientId: string,
  clientName: string,
): Promise<string> {
  const [row] = await dbClient
    .select({ value: sql<number>`count(*)` })
    .from(uploadSession)
    .where(and(
      eq(uploadSession.tenantId, tenantId),
      eq(uploadSession.clientId, clientId),
      eq(uploadSession.source, 'customer_upload'),
      isNotNull(uploadSession.staffDirectLabel),
    ))

  return formatNumberedSessionDisplayLabel(clientName, Number(row?.value ?? 0) + 1)
}

/**
 * upload_session 생성 + Resend 발송 + outbound_email 기록.
 * 기존 /api/sessions POST와 신규 /api/request-events/[id]/send 양쪽에서 사용.
 *
 * 실패 전략:
 * - upload_session INSERT 성공 후 Resend 실패 → outbound_email failed 기록 후 throw
 * - caller(이벤트 기반)는 Resend 실패 시 이벤트를 draft_ready로 유지
 */
export async function createSessionAndSend(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const {
    tenantId, clientId, staffId, staffName, staffEmail,
    clientEmail, clientName, clientContactName,
    accountingPeriod, closingDateISO,
    requestEmailSubject, requestEmailBody, requestEmailGreeting, senderPhone,
    requestEmailCc,
    extractedCriteria, additionalCriteria, analysisNotes,
    requestEventId, requestTemplateId, requestKind = 'general', defaultCriteriaWorkType,
    bookkeepingPeriodType,
  } = input

  // 1. 토큰 및 세션 식별자 생성
  const sessionId = randomUUID()
  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = tokenExpiry(closingDateISO)
  const uploadUrl = `${getUploadBaseUrl()}/upload/${rawToken}`
  const normalizedCcEmail = normalizeCcEmails(requestEmailCc)
  const cc = ccEmailsForSend(normalizedCcEmail)
  const hasExplicitCriteria = Boolean(
    extractedCriteria?.trim() ||
    additionalCriteria?.trim() ||
    analysisNotes?.trim(),
  )
  const criteriaWorkType = defaultCriteriaWorkType ?? inferGeneralDefaultCriteriaWorkType({
    requestEmailSubject,
    requestEmailBody,
  })
  const periodRangeSnapshot = requestKind === 'general' && criteriaWorkType === 'bookkeeping'
    ? buildBookkeepingPeriodRangeSnapshot({
      accountingPeriod,
      periodType: bookkeepingPeriodType,
    })
    : emptyBookkeepingPeriodRangeSnapshot
  const requestEmailBodyWithDefaultCriteria =
    requestKind === 'general' && !hasExplicitCriteria
      ? appendDefaultCriteriaSection(requestEmailBody, criteriaWorkType)
      : requestEmailBody
  const displayLabel = await computeNextCustomerUploadDisplayLabel(db, tenantId, clientId, clientName)

  // 2. 이메일 내용 조합
  const formattedPeriod = formatAccountingPeriod(accountingPeriod)
  const formattedExpiry = expiresAt.toFormat('yyyy년 M월 d일')
  const greetingRecipient = clientContactName ?? clientName
  const greeting = requestEmailGreeting?.trim() || `안녕하세요, ${greetingRecipient} 담당자님.`
  const requestBodySnapshot = requestEmailBodyWithDefaultCriteria.trim()
  const requestBodyForEmail = requestBodySnapshot.split('[[업로드링크]]').join(uploadUrl)
  const requestSubjectForEmail = requestEmailSubject.split('[[업로드링크]]').join(uploadUrl)
  const senderFooter = buildSenderFooterText({
    staffName,
    staffEmail,
    senderPhone: senderPhone?.trim(),
  })
  const fullBody = [greeting, requestBodySnapshot, senderFooter]
    .filter(Boolean)
    .join('\n\n')
  const fullBodyForEmail = [greeting, requestBodyForEmail, senderFooter]
    .filter(Boolean)
    .join('\n\n')

  const clientEmailHtml = buildRequestEmailHtml({
    expiryDate: formattedExpiry,
    greeting,
    requestBody: requestBodyForEmail,
    senderFooter,
    uploadUrl,
  })
  const staffSubject = `[JARYO] ${clientName} 자료 요청 발송 확인`
  const staffEmailHtml = buildStaffRequestConfirmationHtml({
    clientName,
    clientEmail,
    staffName,
    accountingPeriod: formattedPeriod,
    expiryDate: formattedExpiry,
    requestSubject: requestSubjectForEmail,
    requestBody: fullBodyForEmail,
    uploadUrl,
    sessionUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/sessions/${sessionId}`,
  })

  // 3. upload_session DB 저장 (토큰 해시만 저장, raw_token은 URL에만 포함)
  await db.insert(uploadSession).values({
    id: sessionId,
    tenantId,
    clientId,
    createdByStaffId: staffId,
    accountingPeriod,
    ...periodRangeSnapshot,
    tokenHash,
    uploadUrl,
    expiresAt: toDBString(expiresAt),
    status: 'requested',
    analysisNotes: analysisNotes ?? null,
    requestEmailSubject,
    requestEmailBody: fullBody,
    requestEmailCc: normalizedCcEmail,
    extractedCriteria: extractedCriteria ?? null,
    additionalCriteria: additionalCriteria ?? null,
    requestEventId: requestEventId ?? null,
    requestKind,
    staffDirectLabel: displayLabel,
    createdAt: toDBString(now()),
  })

  if (requestKind === 'general' && !hasExplicitCriteria) {
    await seedGeneralDefaultCriteria({
      dbClient: db,
      tenantId,
      uploadSessionId: sessionId,
      requestEventId: requestEventId ?? null,
      workType: criteriaWorkType,
    })
  }

  // 4. Resend 발송 시도 — 클라이언트/담당자 개별 추적
  // 클라이언트 이메일 실패 = 업로드 링크 미전달 → throw (critical)
  // 담당자 이메일 실패 = 내부 알림 누락 → 로그만 남기고 계속 (non-fatal)
  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)
  const emailFrom = await getTenantEmailFrom(tenantId, emailEnv.EMAIL_FROM)
  const ts = toDBString(now())

  let clientEmailSent = false
  let staffEmailSent = false

  try {
    await resend.emails.send({
      from: emailFrom,
      to: clientEmail,
      ...(cc ? { cc } : {}),
      subject: requestSubjectForEmail,
      html: clientEmailHtml,
    })
    clientEmailSent = true
  } catch (err) {
    console.error('[createSessionAndSend] 클라이언트 이메일 발송 실패', err)
  }

  if (clientEmailSent) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: staffEmail,
        subject: staffSubject,
        html: staffEmailHtml,
      })
      staffEmailSent = true
    } catch (err) {
      console.error('[createSessionAndSend] 담당자 이메일 발송 실패 (non-fatal)', err)
    }
  }

  // 5. outbound_email 기록 — 각각 실제 발송 결과로 기록
  await db.insert(outboundEmail).values({
    id: randomUUID(),
    uploadSessionId: sessionId,
    tenantId,
    type: 'upload_request',
    status: clientEmailSent ? 'sent' : 'failed',
    toEmail: clientEmail,
    ccEmail: normalizedCcEmail,
    subject: requestSubjectForEmail,
    body: clientEmailHtml,
    requestEventId: requestEventId ?? null,
    requestTemplateId: requestTemplateId ?? null,
    sentAt: clientEmailSent ? ts : null,
    createdAt: ts,
  })

  await db.insert(outboundEmail).values({
    id: randomUUID(),
    uploadSessionId: sessionId,
    tenantId,
    type: 'staff_notification',
    status: staffEmailSent ? 'sent' : 'failed',
    toEmail: staffEmail,
    ccEmail: null,
    subject: staffSubject,
    body: staffEmailHtml,
    requestEventId: requestEventId ?? null,
    requestTemplateId: requestTemplateId ?? null,
    sentAt: staffEmailSent ? ts : null,
    createdAt: ts,
  })

  if (!clientEmailSent) {
    throw new Error('이메일 발송에 실패했습니다')
  }

  return { sessionId, uploadUrl }
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

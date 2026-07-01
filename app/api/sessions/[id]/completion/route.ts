import { Resend } from 'resend'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, outboundEmail, requestItemValidation, staff, uploadSession } from '@/lib/db/schema'
import { ccEmailsForSend } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { buildCompletionThanksHtml, formatAccountingPeriod } from '@/lib/email/templates'
import { requireEmailEnv } from '@/lib/env'
import { getAcceptedStoredFilesForSession } from '@/lib/sessions/accepted-files'
import {
  buildCompletionCriteriaSummary,
  computeCompletionEligibility,
} from '@/lib/sessions/completion-eligibility'
import { markGeneralSessionCompleted } from '@/lib/sessions/complete-session'
import { now, toDBString } from '@/lib/time'

function buildAppliedNotes(session: {
  analysisNotes: string | null
  extractedCriteria: string | null
  additionalCriteria: string | null
}) {
  return [
    session.analysisNotes ? `세션 기준:\n${session.analysisNotes}` : null,
    session.extractedCriteria ? `요청 메일 추출 기준:\n${session.extractedCriteria}` : null,
    session.additionalCriteria ? `담당자 추가 기준:\n${session.additionalCriteria}` : null,
  ].filter(Boolean).join('\n\n') || null
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    const [staffRecord] = await db
      .select({ id: staff.id, role: staff.role, name: staff.name })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const [row] = await db
      .select({
        session: uploadSession,
        clientRecord: client,
      })
      .from(uploadSession)
      .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    if (!row) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    const { session, clientRecord } = row
    if (staffRecord.role === 'STAFF' && session.createdByStaffId !== staffRecord.id) {
      return NextResponse.json({ error: '자신이 생성한 세션만 완료 처리할 수 있습니다' }, { status: 403 })
    }
    if (session.requestKind !== 'general') {
      return NextResponse.json({ error: '일반 자료 세션에서만 사용할 수 있습니다' }, { status: 409 })
    }

    const existingEmailRows = await db
      .select({ id: outboundEmail.id, status: outboundEmail.status })
      .from(outboundEmail)
      .where(and(
        eq(outboundEmail.uploadSessionId, sessionId),
        eq(outboundEmail.tenantId, tenantId),
        eq(outboundEmail.type, 'completion_thanks'),
      ))
      .orderBy(desc(outboundEmail.createdAt))
      .limit(5)

    if (session.status === 'completed' || existingEmailRows.some((email) => email.status === 'sent')) {
      await markGeneralSessionCompleted({ sessionId, tenantId })
      return NextResponse.json({ ok: true, alreadyCompleted: true })
    }
    if (existingEmailRows.some((email) => email.status === 'draft')) {
      return NextResponse.json({ error: '완료 감사메일 발송이 이미 처리 중입니다' }, { status: 409 })
    }
    if (session.status !== 'ready_for_accountant') {
      return NextResponse.json({ error: '자료 충족 검토 상태에서만 완료 처리할 수 있습니다' }, { status: 409 })
    }

    const acceptedFiles = await getAcceptedStoredFilesForSession({ sessionId, tenantId })
    if (acceptedFiles.files.length === 0) {
      return NextResponse.json({ error: '완료 처리 전에 다운로드 가능한 부합 자료가 필요합니다' }, { status: 409 })
    }

    const validationRows = await db
      .select({
        criterionType: requestItemValidation.criterionType,
        requiredness: requestItemValidation.requiredness,
        validationStatus: requestItemValidation.validationStatus,
        reviewStatus: requestItemValidation.reviewStatus,
      })
      .from(requestItemValidation)
      .where(and(
        eq(requestItemValidation.uploadSessionId, sessionId),
        eq(requestItemValidation.tenantId, tenantId),
      ))
    const completionEligibility = computeCompletionEligibility(validationRows)
    const completionKind = completionEligibility.eligible && completionEligibility.completionKind === 'exception'
      ? 'exception'
      : 'normal'

    const formattedPeriod = formatAccountingPeriod(session.accountingPeriod)
    const subject = `[${staffRecord.name}] ${formattedPeriod} 기장 자료 제출 완료 안내`
    const body = buildCompletionThanksHtml({
      clientName: clientRecord.name,
      staffName: staffRecord.name,
      accountingPeriod: formattedPeriod,
    })
    const timestamp = toDBString(now())
    const emailId = crypto.randomUUID()

    await db.insert(outboundEmail).values({
      id: emailId,
      uploadSessionId: sessionId,
      tenantId,
      type: 'completion_thanks',
      status: 'draft',
      toEmail: clientRecord.email,
      ccEmail: session.requestEmailCc,
      subject,
      body,
      appliedAnalysisNotes: buildAppliedNotes(session),
      criteriaSummary: buildCompletionCriteriaSummary({
        completionKind,
        acceptedFileCount: acceptedFiles.files.length,
      }),
      requestEventId: session.requestEventId,
      approvedByStaffId: staffRecord.id,
      sentAt: null,
      createdAt: timestamp,
    })

    let sendStatus: 'sent' | 'failed' = 'sent'
    try {
      const emailEnv = requireEmailEnv()
      const resend = new Resend(emailEnv.RESEND_API_KEY)
      const emailFrom = await getTenantEmailFrom(tenantId, emailEnv.EMAIL_FROM)
      const cc = ccEmailsForSend(session.requestEmailCc)
      await resend.emails.send({
        from: emailFrom,
        to: clientRecord.email,
        ...(cc ? { cc } : {}),
        subject,
        html: body,
      })
    } catch (err) {
      console.error('[POST /api/sessions/[id]/completion] completion_thanks 발송 실패:', err)
      sendStatus = 'failed'
    }

    await db
      .update(outboundEmail)
      .set({
        status: sendStatus,
        sentAt: sendStatus === 'sent' ? toDBString(now()) : null,
      })
      .where(and(eq(outboundEmail.id, emailId), eq(outboundEmail.tenantId, tenantId)))

    if (sendStatus === 'failed') {
      return NextResponse.json({ error: '완료 감사메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }

    await markGeneralSessionCompleted({ sessionId, tenantId })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/completion]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

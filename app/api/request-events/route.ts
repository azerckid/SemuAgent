import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, clientRequestSchedule, requestTemplate, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { createClientRequestEventSchema } from '@/lib/validations/scheduling'
import { normalizeCcEmails } from '@/lib/email/cc'

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = createClientRequestEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const {
      clientId,
      requestScheduleId,
      requestTemplateId,
      accountingPeriod,
      frequency,
      title,
      dueAt,
      requestItemsSnapshot,
      emailSubjectSnapshot,
      emailBodySnapshot,
      emailGreetingSnapshot,
      senderPhoneSnapshot,
      ccEmailSnapshot,
      analysisCriteriaSnapshot,
    } = parsed.data

    // 고객사가 이 테넌트 소속인지 확인
    const clientRow = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1)

    if (!clientRow[0]) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }

    // requestTemplateId가 주어진 경우:
    // 같은 테넌트 소속이면서 공통 템플릿(client_id IS NULL) 또는 이 고객사 전용(client_id = clientId)인지 검증
    if (requestTemplateId) {
      const templateRow = await db
        .select({ id: requestTemplate.id })
        .from(requestTemplate)
        .where(
          and(
            eq(requestTemplate.id, requestTemplateId),
            eq(requestTemplate.tenantId, tenantId),
            or(isNull(requestTemplate.clientId), eq(requestTemplate.clientId, clientId)),
          ),
        )
        .limit(1)
      if (!templateRow[0]) {
        return NextResponse.json({ error: '요청 템플릿을 찾을 수 없습니다' }, { status: 404 })
      }
    }

    // requestScheduleId가 주어진 경우 같은 테넌트·고객사 소속인지 검증
    if (requestScheduleId) {
      const scheduleRow = await db
        .select({ id: clientRequestSchedule.id })
        .from(clientRequestSchedule)
        .where(
          and(
            eq(clientRequestSchedule.id, requestScheduleId),
            eq(clientRequestSchedule.tenantId, tenantId),
            eq(clientRequestSchedule.clientId, clientId),
            isNull(clientRequestSchedule.deletedAt),
          ),
        )
        .limit(1)
      if (!scheduleRow[0]) {
        return NextResponse.json({ error: '요청 일정 설정을 찾을 수 없습니다' }, { status: 404 })
      }
    }

    // 로그인한 사용자의 staff 레코드 조회
    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const ts = toDBString(now())
    const eventId = randomUUID()
    const normalizedCcEmailSnapshot = normalizeCcEmails(ccEmailSnapshot)

    await db.insert(clientRequestEvent).values({
      id: eventId,
      tenantId,
      clientId,
      requestScheduleId: requestScheduleId ?? null,
      requestTemplateId: requestTemplateId ?? null,
      uploadSessionId: null,
      accountingPeriod,
      frequency,
      title,
      dueAt,
      status: 'draft_ready',
      requestItemsSnapshot: requestItemsSnapshot ? JSON.stringify(requestItemsSnapshot) : null,
      emailSubjectSnapshot: emailSubjectSnapshot ?? null,
      emailBodySnapshot: emailBodySnapshot ?? null,
      emailGreetingSnapshot: emailGreetingSnapshot ?? null,
      senderPhoneSnapshot: senderPhoneSnapshot ?? null,
      ccEmailSnapshot: normalizedCcEmailSnapshot,
      analysisCriteriaSnapshot: analysisCriteriaSnapshot ?? null,
      createdByStaffId: staffRow[0].id,
      createdAt: ts,
      updatedAt: ts,
    })

    return NextResponse.json({ id: eventId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/request-events]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

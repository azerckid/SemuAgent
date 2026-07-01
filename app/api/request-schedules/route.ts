import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, clientRequestSchedule, requestTemplate, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { createClientRequestScheduleSchema } from '@/lib/validations/scheduling'
import { DateTime } from 'luxon'
import { calculateDueAt, generateAccountingPeriods } from '@/lib/services/schedule-calculator'
import { normalizeCcEmails } from '@/lib/email/cc'

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId 필요' }, { status: 400 })
    }

    const rows = await db
      .select()
      .from(clientRequestSchedule)
      .where(and(
        eq(clientRequestSchedule.clientId, clientId),
        eq(clientRequestSchedule.tenantId, tenantId),
        isNull(clientRequestSchedule.deletedAt),
      ))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/request-schedules]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = createClientRequestScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const {
      clientId,
      frequency,
      startsOn,
      endsOn,
      timezone,
      generationPolicy,
      sendPolicy,
      sendRule,
      dueRule,
      emailSubjectTemplate,
      emailBodyTemplate,
      emailGreetingTemplate,
      senderPhoneTemplate,
      ccEmailTemplate,
      analysisCriteriaTemplate,
      isActive,
    } = parsed.data

    // 고객사 소속 확인
    const clientRow = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1)

    if (!clientRow[0]) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }

    // 로그인 담당자 확인
    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    // requestTemplateId가 있으면 같은 테넌트 + 같은 고객사 템플릿인지 검증 (v1: 고객사별 템플릿만 허용)
    if (parsed.data.requestTemplateId) {
      const tmpl = await db
        .select({ id: requestTemplate.id, clientId: requestTemplate.clientId })
        .from(requestTemplate)
        .where(
          and(
            eq(requestTemplate.id, parsed.data.requestTemplateId),
            eq(requestTemplate.tenantId, tenantId),
          ),
        )
        .limit(1)

      if (!tmpl[0]) {
        return NextResponse.json({ error: '요청 템플릿을 찾을 수 없습니다' }, { status: 404 })
      }
      if (tmpl[0].clientId !== clientId) {
        return NextResponse.json({ error: '이 고객사의 요청 템플릿이 아닙니다' }, { status: 403 })
      }
    }

    // 날짜 유효성 검증 (Zod regex는 통과하지만 Luxon이 유효하지 않은 날짜를 잡음)
    const startDate = DateTime.fromISO(startsOn, { zone: timezone })
    if (!startDate.isValid) {
      return NextResponse.json({ error: '유효하지 않은 시작일입니다' }, { status: 400 })
    }
    if (endsOn) {
      const endDate = DateTime.fromISO(endsOn, { zone: timezone })
      if (!endDate.isValid) {
        return NextResponse.json({ error: '유효하지 않은 종료일입니다' }, { status: 400 })
      }
      if (endsOn < startsOn) {
        return NextResponse.json({ error: '종료일은 시작일 이후여야 합니다' }, { status: 400 })
      }
    }

    // 선생성할 회차 목록 계산 (종료일 없으면 12개월까지)
    const periods = generateAccountingPeriods(
      frequency,
      startsOn,
      endsOn ?? null,
      timezone,
    )

    if (periods.length === 0) {
      return NextResponse.json({ error: '유효한 요청 회차가 없습니다' }, { status: 400 })
    }

    const ts = toDBString(now())
    const scheduleId = randomUUID()
    const requestTemplateId = parsed.data.requestTemplateId ?? null
    const staffId = staffRow[0].id
    const freqEnum = frequency as 'monthly' | 'quarterly' | 'semiannual' | 'annual'
    const normalizedCcEmailTemplate = normalizeCcEmails(ccEmailTemplate)
    let createdEvents = 0

    // schedule + event 선생성을 한 트랜잭션으로 처리
    await db.transaction(async (tx) => {
      // 1. schedule 저장
      await tx.insert(clientRequestSchedule).values({
        id: scheduleId,
        tenantId,
        clientId,
        requestTemplateId,
        frequency,
        startsOn,
        endsOn: endsOn ?? null,
        timezone,
        generationPolicy,
        sendPolicy,
        dueRule: JSON.stringify(dueRule),
        sendRule: JSON.stringify(sendRule),
        emailSubjectTemplate,
        emailBodyTemplate,
        emailGreetingTemplate: emailGreetingTemplate ?? null,
        senderPhoneTemplate: senderPhoneTemplate ?? null,
        ccEmailTemplate: normalizedCcEmailTemplate,
        analysisCriteriaTemplate: analysisCriteriaTemplate ?? null,
        isActive,
        createdAt: ts,
        updatedAt: ts,
      })

      // 2. 각 회차 이벤트 선생성
      for (const period of periods) {
        // 중복 체크: tenantId + clientId + scheduleId + accountingPeriod
        const existing = await tx
          .select({ id: clientRequestEvent.id })
          .from(clientRequestEvent)
          .where(
            and(
              eq(clientRequestEvent.tenantId, tenantId),
              eq(clientRequestEvent.clientId, clientId),
              eq(clientRequestEvent.requestScheduleId, scheduleId),
              eq(clientRequestEvent.accountingPeriod, period),
            ),
          )
          .limit(1)

        if (existing[0]) continue

        const dueAt = calculateDueAt(dueRule, period, timezone)

        await tx.insert(clientRequestEvent).values({
          id: randomUUID(),
          tenantId,
          clientId,
          requestScheduleId: scheduleId,
          requestTemplateId,
          uploadSessionId: null,
          accountingPeriod: period,
          frequency: freqEnum,
          title: `${period} 자료 요청`,
          dueAt,
          status: 'draft_ready',
          requestItemsSnapshot: null,
          emailSubjectSnapshot: emailSubjectTemplate ?? null,
          emailBodySnapshot: emailBodyTemplate ?? null,
          emailGreetingSnapshot: emailGreetingTemplate ?? null,
          senderPhoneSnapshot: senderPhoneTemplate ?? null,
          ccEmailSnapshot: normalizedCcEmailTemplate,
          analysisCriteriaSnapshot: analysisCriteriaTemplate ?? null,
          createdByStaffId: staffId,
          createdAt: ts,
          updatedAt: ts,
        })
        createdEvents++
      }
    })

    return NextResponse.json({ ok: true, scheduleId, createdEvents }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/request-schedules]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

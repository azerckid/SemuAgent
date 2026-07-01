/**
 * 정기 요청 자동 초안 생성 Cron
 * 스케줄: 0 0 * * * (UTC 자정 = KST 오전 9시)
 *
 * 동작:
 * 1. 활성 client_request_schedule(generationPolicy=auto_generate_draft) 전체 조회
 * 2. 오늘이 sendRule 조건과 일치하는 스케줄 필터
 * 3. 해당 기간 이벤트가 이미 존재하면 skip (idempotency)
 * 4. client_request_event 생성 (status=draft_ready)
 * 5. send_policy=approval_required → 초안만 생성, 발송 안 함
 */

import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { clientRequestEvent, clientRequestSchedule, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { parseSendRule, parseDueRule } from '@/lib/validations/scheduling'
import {
  calculateAccountingPeriod,
  calculateDueAt,
  isScheduledToday,
} from '@/lib/services/schedule-calculator'

export const maxDuration = 60

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = now()
  let created = 0
  let skipped = 0
  let errors = 0

  try {
    const schedules = await db
      .select()
      .from(clientRequestSchedule)
      .where(
        and(
          eq(clientRequestSchedule.isActive, true),
          eq(clientRequestSchedule.generationPolicy, 'auto_generate_draft'),
        ),
      )

    for (const schedule of schedules) {
      try {
        const timezone = schedule.timezone ?? 'Asia/Seoul'
        const todayInTz = today.setZone(timezone)

        // starts_on 이전이면 skip
        if (schedule.startsOn > todayInTz.toFormat('yyyy-MM-dd')) {
          skipped++
          continue
        }
        // ends_on 이후면 skip
        if (schedule.endsOn && schedule.endsOn < todayInTz.toFormat('yyyy-MM-dd')) {
          skipped++
          continue
        }

        const sendRule = parseSendRule(schedule.sendRule)
        if (!sendRule) {
          skipped++
          continue
        }

        const frequency = schedule.frequency as 'monthly' | 'quarterly' | 'semiannual' | 'annual'

        // 오늘이 발송 날짜인지 확인
        if (!isScheduledToday(sendRule, frequency, todayInTz)) {
          skipped++
          continue
        }

        // 현재 회계 기간 계산
        const accountingPeriod = calculateAccountingPeriod(frequency, todayInTz)

        // idempotency: tenantId + clientId + scheduleId + accountingPeriod 조합 체크
        const existing = await db
          .select({ id: clientRequestEvent.id })
          .from(clientRequestEvent)
          .where(
            and(
              eq(clientRequestEvent.tenantId, schedule.tenantId),
              eq(clientRequestEvent.clientId, schedule.clientId),
              eq(clientRequestEvent.requestScheduleId, schedule.id),
              eq(clientRequestEvent.accountingPeriod, accountingPeriod),
            ),
          )
          .limit(1)

        if (existing[0]) {
          skipped++
          continue
        }

        // 담당자 조회 — 테넌트의 첫 번째 활성 담당자
        const staffRows = await db
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.tenantId, schedule.tenantId), eq(staff.active, true)))
          .limit(1)
        const staffId = staffRows[0]?.id

        if (!staffId) {
          skipped++
          continue
        }

        // 제출 기한 계산
        const dueRule = parseDueRule(schedule.dueRule)
        const dueAt = dueRule
          ? calculateDueAt(dueRule, accountingPeriod, timezone)
          : todayInTz.plus({ days: 14 }).endOf('day').toISO()!

        const ts = toDBString(now())
        const eventId = randomUUID()

        await db.insert(clientRequestEvent).values({
          id: eventId,
          tenantId: schedule.tenantId,
          clientId: schedule.clientId,
          requestScheduleId: schedule.id,
          requestTemplateId: schedule.requestTemplateId ?? null,
          uploadSessionId: null,
          accountingPeriod,
          frequency,
          title: `${accountingPeriod} 자료 요청`,
          dueAt,
          status: 'draft_ready',
          requestItemsSnapshot: null,
          emailSubjectSnapshot: schedule.emailSubjectTemplate ?? null,
          emailBodySnapshot: schedule.emailBodyTemplate ?? null,
          emailGreetingSnapshot: schedule.emailGreetingTemplate ?? null,
          senderPhoneSnapshot: schedule.senderPhoneTemplate ?? null,
          ccEmailSnapshot: schedule.ccEmailTemplate ?? null,
          analysisCriteriaSnapshot: schedule.analysisCriteriaTemplate ?? null,
          createdByStaffId: staffId,
          createdAt: ts,
          updatedAt: ts,
        })

        created++
      } catch (err) {
        console.error(`[auto-send-requests] 스케줄 처리 실패 (${schedule.id}):`, err)
        errors++
      }
    }

    console.info(`[auto-send-requests] 완료 — 생성: ${created}, 스킵: ${skipped}, 오류: ${errors}`)
    return NextResponse.json({ ok: true, created, skipped, errors })
  } catch (err) {
    console.error('[auto-send-requests] Cron 실패:', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

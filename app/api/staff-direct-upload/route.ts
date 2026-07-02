import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, staff } from '@/lib/db/schema'
import { seedGeneralDefaultCriteria } from '@/lib/review/default-criteria'
import { createDirectUploadSession } from '@/lib/services/session-service'
import {
  getStaffDirectUploadExpiresAt,
  getStaffDirectUploadExpiryDate,
} from '@/lib/staff-direct-upload/expiry'
import { now, toDBString } from '@/lib/time'
import { createStaffDirectUploadSchema } from '@/lib/validations/staff-direct-upload'
import type { BookkeepingPeriodType } from '@/lib/bookkeeping/period-range'

const WORK_TYPE_LABEL: Record<string, string> = {
  bookkeeping: '기장 자료',
  vat: '부가세 자료',
  payroll: '급여정산 자료',
  general: '기타 자료',
}

function frequencyForStaffDirectUpload(input: {
  accountingPeriod: string
  bookkeepingPeriodType?: BookkeepingPeriodType | null
}) {
  if (input.bookkeepingPeriodType === 'quarterly') return 'quarterly'
  if (input.bookkeepingPeriodType === 'yearly') return 'annual'
  if (input.bookkeepingPeriodType === 'monthly') return 'monthly'
  return input.accountingPeriod.includes('~') || input.accountingPeriod.includes('-Q') ? 'custom' : 'monthly'
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const body = await req.json()
    const parsed = createStaffDirectUploadSchema.safeParse(body)

    if (!parsed.success) {
      const details = parsed.error.flatten()
      const firstFieldError = Object.values(details.fieldErrors)
        .flat()
        .find(Boolean)
      return NextResponse.json(
        { error: firstFieldError ?? details.formErrors[0] ?? '입력값 오류', details },
        { status: 400 },
      )
    }

    const input = parsed.data
    if (input.workType === 'payroll' && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.accountingPeriod)) {
      return NextResponse.json({ error: '급여정산 직접 업로드는 월 단위 기간만 사용할 수 있습니다' }, { status: 400 })
    }

    const [clientRows, staffRows] = await Promise.all([
      db
        .select({ id: client.id, name: client.name })
        .from(client)
        .where(and(eq(client.id, input.clientId), eq(client.tenantId, tenantId)))
        .limit(1),
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
    ])

    const clientRecord = clientRows[0]
    if (!clientRecord) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }

    const staffRecord = staffRows[0]
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const eventId = randomUUID()
    const timestamp = now()
    const ts = toDBString(timestamp)
    const requestKind = input.workType === 'payroll' ? 'payroll' : 'general'
    const title = `[담당자 직접 업로드] ${input.accountingPeriod} ${WORK_TYPE_LABEL[input.workType]}`
    const expiryDate = getStaffDirectUploadExpiryDate(timestamp)
    const dueAt = toDBString(getStaffDirectUploadExpiresAt(timestamp))

    const response = await db.transaction(async (tx) => {
      const result = await createDirectUploadSession({
        tenantId,
        clientId: input.clientId,
        staffId: staffRecord.id,
        displayLabel: input.displayLabel,
        accountingPeriod: input.accountingPeriod,
        closingDateISO: expiryDate,
        requestKind,
        workType: input.workType === 'bookkeeping' || input.workType === 'vat' ? input.workType : undefined,
        bookkeepingPeriodType: input.workType === 'bookkeeping' ? input.bookkeepingPeriodType : null,
        analysisNotes: input.analysisNotes ?? null,
        requestEventId: eventId,
        dbClient: tx,
        seedDefaultCriteria: false,
      })

      await tx.insert(clientRequestEvent).values({
        id: eventId,
        tenantId,
        clientId: input.clientId,
        requestScheduleId: null,
        requestTemplateId: null,
        uploadSessionId: result.sessionId,
        accountingPeriod: input.accountingPeriod,
        frequency: frequencyForStaffDirectUpload({
          accountingPeriod: input.accountingPeriod,
          bookkeepingPeriodType: input.workType === 'bookkeeping' ? input.bookkeepingPeriodType : null,
        }),
        requestKind,
        title,
        dueAt,
        status: 'waiting_upload',
        requestItemsSnapshot: null,
        emailSubjectSnapshot: title,
        emailBodySnapshot: '담당자가 고객 메일 없이 직접 업로드한 테스트/검토 세션입니다.',
        emailGreetingSnapshot: null,
        senderPhoneSnapshot: null,
        ccEmailSnapshot: null,
        analysisCriteriaSnapshot: input.analysisNotes ?? null,
        createdByStaffId: staffRecord.id,
        createdAt: ts,
        updatedAt: ts,
      })

      if ((input.workType === 'bookkeeping' || input.workType === 'vat') && requestKind === 'general') {
        await seedGeneralDefaultCriteria({
          dbClient: tx,
          tenantId,
          uploadSessionId: result.sessionId,
          requestEventId: eventId,
          workType: input.workType,
        })
      }

      return {
        sessionId: result.sessionId,
        uploadUrl: result.uploadUrl,
        eventId,
        resultPath: requestKind === 'payroll'
          ? `/dashboard/payroll?eventId=${eventId}`
          : `/dashboard/direct-upload?sessionId=${result.sessionId}`,
      }
    })

    return NextResponse.json(
      response,
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/staff-direct-upload]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

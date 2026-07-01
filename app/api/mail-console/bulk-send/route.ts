import { and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  client,
  clientCcGroup,
  clientRequestEvent,
  requestTemplate,
  staff,
} from '@/lib/db/schema'
import {
  applyMailConsoleTokens,
  appendDefaultCriteriaSection,
  deterministicBulkEventId,
  duplicateBasicRequestMessage,
  mailConsoleBulkSendRequestSchema,
  requestKindForWorkType,
  titleForBulkSend,
  unresolvedMailConsoleTokens,
  type MailConsoleBulkSendRequest,
} from '@/lib/mail-console/bulk-send'
import { pickDefaultCcGroup, resolveCcGroupSelection } from '@/lib/mail-console/cc-group'
import { acquireSendLock, isUniqueConstraintError, releaseSendLock } from '@/lib/locks/send-lock'
import { createSessionAndSend } from '@/lib/services/session-service'
import { now, toDBString, tokenExpiry } from '@/lib/time'

type ClientRow = {
  id: string
  name: string
  email: string
  contactName: string | null
  staffName: string | null
}

type CcGroupRow = {
  id: string
  clientId: string
  name: string
  emails: string
  purpose: 'general' | 'payroll' | 'all'
  isDefault: boolean
}

type TemplateRow = {
  id: string
  requestItems: string | null
  analysisCriteriaTemplate: string | null
}

type BulkSendResult = {
  clientId: string
  clientName: string
  status: 'success' | 'failed'
  eventId?: string
  sessionId?: string
  sessionPath?: string
  error?: string
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const body = await req.json()
    const parsed = mailConsoleBulkSendRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const input = parsed.data
    const staffRows = await db
      .select({ id: staff.id, name: staff.name, email: staff.email })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    const staffRecord = staffRows[0]
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const uniqueClientIds = Array.from(new Set(input.clientIds))
    const [clientRows, ccGroupRows, templateRows] = await Promise.all([
      db
        .select({
          id: client.id,
          name: client.name,
          email: client.email,
          contactName: client.contactName,
          staffName: staff.name,
        })
        .from(client)
        .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
        .where(and(eq(client.tenantId, tenantId), inArray(client.id, uniqueClientIds))),
      db
        .select({
          id: clientCcGroup.id,
          clientId: clientCcGroup.clientId,
          name: clientCcGroup.name,
          emails: clientCcGroup.emails,
          purpose: clientCcGroup.purpose,
          isDefault: clientCcGroup.isDefault,
        })
        .from(clientCcGroup)
        .where(and(eq(clientCcGroup.tenantId, tenantId), inArray(clientCcGroup.clientId, uniqueClientIds))),
      input.requestTemplateId
        ? db
          .select({
            id: requestTemplate.id,
            requestItems: requestTemplate.requestItems,
            analysisCriteriaTemplate: requestTemplate.analysisCriteriaTemplate,
          })
          .from(requestTemplate)
          .where(and(
            eq(requestTemplate.id, input.requestTemplateId),
            eq(requestTemplate.tenantId, tenantId),
            or(isNull(requestTemplate.clientId), inArray(requestTemplate.clientId, uniqueClientIds)),
          ))
          .limit(1)
        : Promise.resolve([] as TemplateRow[]),
    ])

    const foundClientIds = new Set(clientRows.map((row) => row.id))
    const missingClientIds = uniqueClientIds.filter((id) => !foundClientIds.has(id))
    if (missingClientIds.length > 0) {
      return NextResponse.json(
        { error: '선택한 고객사 중 현재 테넌트에서 찾을 수 없는 항목이 있습니다', missingClientIds },
        { status: 404 },
      )
    }

    const templateRow = templateRows[0] as TemplateRow | undefined
    if (input.requestTemplateId && !templateRow) {
      return NextResponse.json({ error: '요청 템플릿을 찾을 수 없습니다' }, { status: 404 })
    }

    const ccGroupsByClientId = new Map<string, CcGroupRow[]>()
    for (const group of ccGroupRows as CcGroupRow[]) {
      const groups = ccGroupsByClientId.get(group.clientId) ?? []
      groups.push(group)
      ccGroupsByClientId.set(group.clientId, groups)
    }

    const ccSelectionByClientId = new Map(
      (input.clientCcSelections ?? []).map((selection) => [selection.clientId, selection.ccGroupId]),
    )
    for (const clientId of uniqueClientIds) {
      const selectedCcGroupId = ccSelectionByClientId.get(clientId)
      if (selectedCcGroupId === undefined) continue

      const clientGroups = ccGroupsByClientId.get(clientId) ?? []
      if (selectedCcGroupId === null) continue

      const ownsGroup = clientGroups.some((group) => group.id === selectedCcGroupId)
      if (!ownsGroup) {
        return NextResponse.json(
          { error: '선택한 CC 그룹이 고객사에 속하지 않습니다', clientId, ccGroupId: selectedCcGroupId },
          { status: 400 },
        )
      }
    }

    const results: BulkSendResult[] = []
    const clientsByInputOrder = uniqueClientIds
      .map((id) => clientRows.find((row) => row.id === id))
      .filter((row): row is ClientRow => Boolean(row))

    for (const targetClient of clientsByInputOrder) {
      const clientGroups = ccGroupsByClientId.get(targetClient.id) ?? []
      const selectedCcGroupId = ccSelectionByClientId.get(targetClient.id)
      const selectedCcGroup = selectedCcGroupId === undefined
        ? pickDefaultCcGroup(clientGroups, input.workType)
        : resolveCcGroupSelection(clientGroups, input.workType, selectedCcGroupId)
      const result = await sendForClient({
        input,
        tenantId,
        staffRecord,
        targetClient,
        ccEmails: selectedCcGroup?.emails ?? null,
        templateRow,
      })
      results.push(result)
    }

    const successCount = results.filter((result) => result.status === 'success').length
    const failureCount = results.length - successCount

    return NextResponse.json(
      {
        ok: failureCount === 0,
        summary: { total: results.length, successCount, failureCount },
        results,
      },
      { status: failureCount === 0 ? 201 : 207 },
    )
  } catch (err) {
    console.error('[POST /api/mail-console/bulk-send]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

async function sendForClient({
  input,
  tenantId,
  staffRecord,
  targetClient,
  ccEmails,
  templateRow,
}: {
  input: MailConsoleBulkSendRequest
  tenantId: string
  staffRecord: { id: string; name: string; email: string }
  targetClient: ClientRow
  ccEmails: string | null
  templateRow?: TemplateRow
}): Promise<BulkSendResult> {
  const baseResult = { clientId: targetClient.id, clientName: targetClient.name }
  const clientEmail = targetClient.email.trim()
  if (!clientEmail) {
    return { ...baseResult, status: 'failed', error: '수신자 이메일이 없습니다' }
  }

  const tokenClient = {
    id: targetClient.id,
    name: targetClient.name,
    managerName: targetClient.contactName ?? targetClient.staffName ?? '담당자',
  }
  const unresolvedTokens = unresolvedMailConsoleTokens(input, tokenClient)
  if (unresolvedTokens.length > 0) {
    return {
      ...baseResult,
      status: 'failed',
      error: `미치환 식별자: ${unresolvedTokens.join(', ')}`,
    }
  }

  const eventId = deterministicBulkEventId({
    tenantId,
    requestBatchId: input.requestBatchId,
    clientId: targetClient.id,
  })
  const requestKind = requestKindForWorkType(input.workType)
  const frequency = input.frequency
  const title = titleForBulkSend(input)

  if (input.frequency !== 'custom') {
    const duplicateConditions = [
      eq(clientRequestEvent.tenantId, tenantId),
      eq(clientRequestEvent.clientId, targetClient.id),
      eq(clientRequestEvent.accountingPeriod, input.accountingPeriod),
      eq(clientRequestEvent.requestKind, requestKind),
      ne(clientRequestEvent.status, 'cancelled'),
      isNull(clientRequestEvent.deletedAt),
      isNotNull(clientRequestEvent.uploadSessionId),
    ]

    if (requestKind !== 'payroll') {
      duplicateConditions.push(eq(clientRequestEvent.title, title))
    }

    const [duplicateEvent] = await db
      .select({ id: clientRequestEvent.id })
      .from(clientRequestEvent)
      .where(and(...duplicateConditions))
      .limit(1)

    if (duplicateEvent) {
      return {
        ...baseResult,
        status: 'failed',
        error: duplicateBasicRequestMessage(input),
      }
    }
  }

  const dueAt = tokenExpiry(input.dueDate)
  const ts = toDBString(now())
  const subjectSnapshot = applyMailConsoleTokens(input.subject, input, tokenClient)
  const bodySnapshot = appendDefaultCriteriaSection(
    applyMailConsoleTokens(input.body, input, tokenClient),
    input.workType,
  )
  const analysisCriteriaSnapshot =
    input.analysisCriteriaSnapshot?.trim()
    || templateRow?.analysisCriteriaTemplate?.trim()
    || null

  try {
    await db.insert(clientRequestEvent).values({
      id: eventId,
      tenantId,
      clientId: targetClient.id,
      requestScheduleId: null,
      requestTemplateId: input.requestTemplateId ?? null,
      uploadSessionId: null,
      accountingPeriod: input.accountingPeriod,
      frequency,
      requestKind,
      title,
      dueAt: toDBString(dueAt),
      status: 'draft_ready',
      requestItemsSnapshot: templateRow?.requestItems ?? null,
      emailSubjectSnapshot: subjectSnapshot,
      emailBodySnapshot: bodySnapshot,
      emailGreetingSnapshot: null,
      senderPhoneSnapshot: null,
      ccEmailSnapshot: ccEmails,
      analysisCriteriaSnapshot,
      createdByStaffId: staffRecord.id,
      createdAt: ts,
      updatedAt: ts,
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return {
        ...baseResult,
        status: 'failed',
        eventId,
        error: '이미 같은 대량 발송 요청이 생성됐거나 처리 중입니다',
      }
    }
    throw err
  }

  const lockId = await acquireSendLock(tenantId, eventId)
  if (!lockId) {
    return {
      ...baseResult,
      status: 'failed',
      eventId,
      error: '동일 요청이 이미 발송 처리 중입니다',
    }
  }

  let lockOutcome: 'completed' | 'failed' = 'failed'
  try {
    const { sessionId } = await createSessionAndSend({
      tenantId,
      clientId: targetClient.id,
      staffId: staffRecord.id,
      staffName: staffRecord.name,
      staffEmail: staffRecord.email,
      clientEmail,
      clientName: targetClient.name,
      clientContactName: targetClient.contactName,
      accountingPeriod: input.accountingPeriod,
      closingDateISO: input.dueDate,
      requestEmailSubject: subjectSnapshot,
      requestEmailBody: bodySnapshot,
      requestEmailCc: ccEmails,
      analysisNotes: analysisCriteriaSnapshot,
      requestEventId: eventId,
      requestTemplateId: input.requestTemplateId ?? null,
      requestKind,
      defaultCriteriaWorkType: input.workType === 'vat' ? 'vat' : 'bookkeeping',
    })

    const completedAt = toDBString(now())
    await db
      .update(clientRequestEvent)
      .set({ uploadSessionId: sessionId, status: 'sent', updatedAt: completedAt })
      .where(and(
        eq(clientRequestEvent.id, eventId),
        eq(clientRequestEvent.tenantId, tenantId),
        isNull(clientRequestEvent.uploadSessionId),
      ))

    lockOutcome = 'completed'
    return {
      ...baseResult,
      status: 'success',
      eventId,
      sessionId,
      sessionPath: `/dashboard/sessions/${sessionId}`,
    }
  } catch (err) {
    console.error('[bulk-send] 고객사 발송 실패', { clientId: targetClient.id, eventId, err })
    return {
      ...baseResult,
      status: 'failed',
      eventId,
      error: err instanceof Error ? err.message : '발송 실패',
    }
  } finally {
    await releaseSendLock(lockId, lockOutcome).catch((err) =>
      console.error('[bulk-send] releaseSendLock 실패', { eventId, err }),
    )
  }
}

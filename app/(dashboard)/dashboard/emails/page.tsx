import { Suspense } from 'react'
import { and, asc, eq, desc, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  client,
  clientCcGroup,
  inboundEmail,
  inboundEmailAttachment,
  internalCcGroup,
  outboundEmail,
  requestTemplate,
  staff,
  staffMailbox,
  uploadSession,
} from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { EmailWorkspace } from './_components/email-workspace'
import { redirect } from 'next/navigation'
import { pickDefaultCcGroup } from '@/lib/mail-console/cc-group'
import type {
  InboundMailClientOption,
  InboundMailRow,
  MailConsoleCcGroupPurpose,
  MailConsoleClient,
  MailHistoryRow,
  MailTemplateRow,
  WorkEmailAddressRow,
  WorkEmailInternalCcGroupOption,
  WorkEmailStaffOption,
} from './_components/mail-console-types'

const MAIL_HISTORY_PAGE_SIZE = 50

const emailSearchParamsSchema = z.object({
  historyPage: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

type MailClientRow = {
  id: string
  name: string
  email: string
  contactName: string | null
  staffName: string | null
}

type MailCcGroupRow = {
  id: string
  clientId: string
  name: string
  purpose: MailConsoleCcGroupPurpose
  emails: string
  isDefault: boolean
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildMailConsoleClients({
  clients,
  ccGroups,
}: {
  clients: MailClientRow[]
  ccGroups: MailCcGroupRow[]
}): MailConsoleClient[] {
  const groupsByClientId = new Map<string, MailCcGroupRow[]>()

  for (const group of ccGroups) {
    const groups = groupsByClientId.get(group.clientId) ?? []
    groups.push(group)
    groupsByClientId.set(group.clientId, groups)
  }

  return clients.map((mailClient) => {
    const clientCcGroups = groupsByClientId.get(mailClient.id) ?? []
    const selectedCcGroup = pickDefaultCcGroup(clientCcGroups, 'bookkeeping')
    const toEmail = mailClient.email.trim() || null
    const sendReady = toEmail ? 'ready' : 'blocked'

    return {
      id: mailClient.id,
      name: mailClient.name,
      managerName: mailClient.contactName ?? mailClient.staffName ?? '미등록',
      toEmail,
      ccGroups: clientCcGroups.map((group) => ({
        id: group.id,
        name: group.name,
        purpose: group.purpose,
        emails: group.emails,
        isDefault: group.isDefault,
      })),
      ccGroup: selectedCcGroup?.name ?? null,
      ccEmails: selectedCcGroup?.emails ?? null,
      ccGroupPurpose: selectedCcGroup?.purpose ?? null,
      sendReady,
    }
  })
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const parsedSearchParamsResult = emailSearchParamsSchema.safeParse({
    historyPage: singleSearchParam(resolvedSearchParams.historyPage),
  })
  const parsedSearchParams = parsedSearchParamsResult.success
    ? parsedSearchParamsResult.data
    : { historyPage: 1 }

  let tenantId: string
  let userId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    userId = session.user.id
  } catch {
    redirect('/sign-in')
  }

  const [me] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId), eq(staff.active, true)))
    .limit(1)

  const historySelect = {
    id: outboundEmail.id,
    type: outboundEmail.type,
    subject: outboundEmail.subject,
    toEmail: outboundEmail.toEmail,
    ccEmail: outboundEmail.ccEmail,
    status: outboundEmail.status,
    sentAt: outboundEmail.sentAt,
    createdAt: outboundEmail.createdAt,
    sessionId: uploadSession.id,
    accountingPeriod: uploadSession.accountingPeriod,
    clientName: client.name,
  }

  const isAdmin = me?.role === 'TENANT_ADMIN'
  const historyWhere = and(
    eq(outboundEmail.tenantId, tenantId),
    eq(uploadSession.tenantId, tenantId),
    eq(client.tenantId, tenantId),
    inArray(outboundEmail.status, ['sent', 'failed', 'rejected']),
  )
  const [historyMetricRow] = await db
    .select({
      total: sql<number>`count(*)`,
      sentCount: sql<number>`sum(case when ${outboundEmail.status} = 'sent' then 1 else 0 end)`,
      failedCount: sql<number>`sum(case when ${outboundEmail.status} = 'failed' then 1 else 0 end)`,
    })
    .from(outboundEmail)
    .innerJoin(uploadSession, eq(outboundEmail.uploadSessionId, uploadSession.id))
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .where(historyWhere)

  const historyTotal = Number(historyMetricRow?.total ?? 0)
  const historyLastPage = Math.max(1, Math.ceil(historyTotal / MAIL_HISTORY_PAGE_SIZE))
  const historyPage = Math.min(parsedSearchParams.historyPage, historyLastPage)
  const historyOffset = (historyPage - 1) * MAIL_HISTORY_PAGE_SIZE
  const historyPagination = {
    page: historyPage,
    pageSize: MAIL_HISTORY_PAGE_SIZE,
    total: historyTotal,
    sentCount: Number(historyMetricRow?.sentCount ?? 0),
    failedCount: Number(historyMetricRow?.failedCount ?? 0),
  }

  const [historyRows, mailTemplateRows, mailClientRows, mailCcGroupRows, internalCcGroupRows, inboundEmailRows, workEmailStaffRows] = await Promise.all([
    // 발송 이력 (sent / failed / rejected) — 50건 단위 페이지네이션
    db
      .select(historySelect)
      .from(outboundEmail)
      .innerJoin(uploadSession, eq(outboundEmail.uploadSessionId, uploadSession.id))
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .where(historyWhere)
      .orderBy(desc(outboundEmail.createdAt))
      .limit(MAIL_HISTORY_PAGE_SIZE)
      .offset(historyOffset),

    db
      .select({
        id: requestTemplate.id,
        name: requestTemplate.name,
        workType: requestTemplate.workType,
        frequency: requestTemplate.frequency,
        clientName: client.name,
        emailSubjectTemplate: requestTemplate.emailSubjectTemplate,
        emailBodyTemplate: requestTemplate.emailBodyTemplate,
        analysisCriteriaTemplate: requestTemplate.analysisCriteriaTemplate,
        isDefaultForWorkType: requestTemplate.isDefaultForWorkType,
        isActive: requestTemplate.isActive,
        updatedAt: requestTemplate.updatedAt,
        createdAt: requestTemplate.createdAt,
      })
      .from(requestTemplate)
      .leftJoin(client, and(eq(requestTemplate.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(eq(requestTemplate.tenantId, tenantId))
      .orderBy(desc(requestTemplate.isActive), desc(requestTemplate.updatedAt)),

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
      .where(eq(client.tenantId, tenantId))
      .orderBy(asc(client.name)),

    db
      .select({
        id: clientCcGroup.id,
        clientId: clientCcGroup.clientId,
        name: clientCcGroup.name,
        purpose: clientCcGroup.purpose,
        emails: clientCcGroup.emails,
        isDefault: clientCcGroup.isDefault,
      })
      .from(clientCcGroup)
      .where(eq(clientCcGroup.tenantId, tenantId))
      .orderBy(desc(clientCcGroup.isDefault), desc(clientCcGroup.createdAt)),

    db
      .select({
        id: internalCcGroup.id,
        name: internalCcGroup.name,
        purpose: internalCcGroup.purpose,
        emails: internalCcGroup.emails,
        isDefault: internalCcGroup.isDefault,
      })
      .from(internalCcGroup)
      .where(eq(internalCcGroup.tenantId, tenantId))
      .orderBy(desc(internalCcGroup.isDefault), desc(internalCcGroup.createdAt)),

    // 업무 메일함 (TENANT_ADMIN은 전체, STAFF는 본인 메일함만)
    me
      ? db
          .select({
            id: inboundEmail.id,
            staffMailboxId: inboundEmail.staffMailboxId,
            direction: inboundEmail.direction,
            fromEmail: inboundEmail.fromEmail,
            toEmail: inboundEmail.toEmail,
            subject: inboundEmail.subject,
            receivedAt: inboundEmail.receivedAt,
            clientLabelId: inboundEmail.clientLabelId,
            clientLabelName: client.name,
            processingStatus: inboundEmail.processingStatus,
            createdAt: inboundEmail.createdAt,
          })
          .from(inboundEmail)
          .innerJoin(staffMailbox, eq(inboundEmail.staffMailboxId, staffMailbox.id))
          .leftJoin(client, and(eq(inboundEmail.clientLabelId, client.id), eq(client.tenantId, tenantId)))
          .where(
            isAdmin
              ? eq(inboundEmail.tenantId, tenantId)
              : and(
                  eq(inboundEmail.tenantId, tenantId),
                  eq(staffMailbox.currentStaffId, me.id),
                  ne(staffMailbox.state, 'handoff_required'),
                ),
          )
          .orderBy(desc(inboundEmail.receivedAt), desc(inboundEmail.createdAt))
          .limit(50)
      : Promise.resolve([]),

    isAdmin
      ? db
          .select({
            id: staff.id,
            name: staff.name,
            email: staff.email,
            active: staff.active,
          })
          .from(staff)
          .where(eq(staff.tenantId, tenantId))
          .orderBy(desc(staff.active), asc(staff.name))
      : Promise.resolve([]),
  ])

  const history: MailHistoryRow[] = historyRows

  const inboundAttachmentCounts: Record<string, number> = {}
  if (inboundEmailRows.length > 0) {
    const attachmentRows = await db
      .select({ inboundEmailId: inboundEmailAttachment.inboundEmailId })
      .from(inboundEmailAttachment)
      .where(
        and(
          eq(inboundEmailAttachment.tenantId, tenantId),
          inArray(inboundEmailAttachment.inboundEmailId, inboundEmailRows.map((row) => row.id)),
        ),
      )
    for (const row of attachmentRows) {
      inboundAttachmentCounts[row.inboundEmailId] = (inboundAttachmentCounts[row.inboundEmailId] ?? 0) + 1
    }
  }

  const inboundEmails: InboundMailRow[] = inboundEmailRows.map((row) => ({
    ...row,
    attachmentCount: inboundAttachmentCounts[row.id] ?? 0,
  }))

  const inboundLabelClients: InboundMailClientOption[] = mailClientRows.map((row) => ({
    id: row.id,
    name: row.name,
  }))

  const mailClients = buildMailConsoleClients({
    clients: mailClientRows,
    ccGroups: mailCcGroupRows,
  })

  const internalCcGroups: WorkEmailInternalCcGroupOption[] = internalCcGroupRows

  // 메일주소 탭: 일반 직원은 내 메일주소만, TENANT_ADMIN은 전체를 본다 (읽기 전용 —
  // 생성/인계/일시정지/폐기 실제 액션은 설정 화면에서만 한다).
  const addressRows = me
    ? await db
        .select({
          id: staffMailbox.id,
          address: staffMailbox.address,
          state: staffMailbox.state,
          staffId: staffMailbox.currentStaffId,
          staffName: staff.name,
        })
        .from(staffMailbox)
        .leftJoin(staff, and(eq(staffMailbox.currentStaffId, staff.id), eq(staff.tenantId, tenantId)))
        .where(
          isAdmin
            ? and(eq(staffMailbox.tenantId, tenantId), ne(staffMailbox.state, 'retired'))
            : and(
                eq(staffMailbox.tenantId, tenantId),
                eq(staffMailbox.currentStaffId, me.id),
                ne(staffMailbox.state, 'retired'),
              ),
        )
        .orderBy(asc(staffMailbox.address))
    : []

  const workEmailAddresses: WorkEmailAddressRow[] = addressRows
  const workEmailStaffOptions: WorkEmailStaffOption[] = workEmailStaffRows
  // 메일쓰기에서 고를 수 있는 주소: STAFF는 본인 active 주소뿐이라 사실상 1개,
  // TENANT_ADMIN은 API가 모든 active 주소에서 발송을 허용하므로 전체를 노출한다.
  const sendableAddresses = workEmailAddresses.filter((row) => row.state === 'active')

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">메일 발송</h1>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">메일 콘솔을 불러오는 중입니다.</div>}>
        <EmailWorkspace
          history={history}
          historyPagination={historyPagination}
          templates={mailTemplateRows as MailTemplateRow[]}
          clients={mailClients}
          inboundEmails={inboundEmails}
          inboundLabelClients={inboundLabelClients}
          workEmailAddresses={workEmailAddresses}
          workEmailStaffOptions={workEmailStaffOptions}
          sendableAddresses={sendableAddresses}
          internalCcGroups={internalCcGroups}
          currentStaffId={me?.id ?? null}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  )
}

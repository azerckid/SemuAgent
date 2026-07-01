import { and, desc, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, inboundEmail, inboundEmailAttachment, staff, staffMailbox } from '@/lib/db/schema'

const DEFAULT_LIMIT = 50

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

/**
 * Tenant-scoped list of inbound work emails.
 * 열람 범위: TENANT_ADMIN은 테넌트 전체, STAFF는 자기 메일함만 (승인된 정책).
 */
export async function GET(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const mailboxId = new URL(req.url).searchParams.get('mailboxId')

    const [me] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conditions: SQL[] = [eq(inboundEmail.tenantId, tenantId)]
    if (mailboxId) conditions.push(eq(inboundEmail.staffMailboxId, mailboxId))
    // STAFF는 본인이 현재 배정된 메일함으로 한정. handoff_required(인계 필요)
    // 메일함은 tenant admin이 새 담당자를 배정하기 전까지 STAFF에게 노출하지 않는다.
    if (me.role !== 'TENANT_ADMIN') {
      conditions.push(eq(staffMailbox.currentStaffId, me.id))
      conditions.push(ne(staffMailbox.state, 'handoff_required'))
    }

    const rows = await db
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
      .where(and(...conditions))
      .orderBy(desc(inboundEmail.receivedAt), desc(inboundEmail.createdAt))
      .limit(DEFAULT_LIMIT)

    const attachmentCountByEmailId: Record<string, number> = {}
    if (rows.length > 0) {
      const attachmentRows = await db
        .select({ inboundEmailId: inboundEmailAttachment.inboundEmailId })
        .from(inboundEmailAttachment)
        .where(
          and(
            eq(inboundEmailAttachment.tenantId, tenantId),
            inArray(inboundEmailAttachment.inboundEmailId, rows.map((row) => row.id)),
          ),
        )
      for (const row of attachmentRows) {
        attachmentCountByEmailId[row.inboundEmailId] = (attachmentCountByEmailId[row.inboundEmailId] ?? 0) + 1
      }
    }

    const emails = rows.map((row) => ({
      ...row,
      attachmentCount: attachmentCountByEmailId[row.id] ?? 0,
    }))

    return Response.json({ emails })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[GET /api/inbound-emails]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, inboundEmail, inboundEmailAttachment, staff, staffMailbox } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { inboundEmailActionSchema } from '@/lib/validations/inbound-email'

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

/**
 * 권한 스코프 확인: TENANT_ADMIN은 테넌트 전체, STAFF는 현재 배정된 메일함만.
 * handoff_required(인계 필요) 메일함은 새 담당자가 배정되기 전까지 STAFF에게
 * 노출하지 않는다. 권한 밖이거나 존재하지 않으면 null (404로 처리해 존재 여부를
 * 노출하지 않는다).
 */
async function loadAccessibleEmail(tenantId: string, staffId: string, role: string, id: string) {
  const [row] = await db
    .select({
      email: inboundEmail,
      mailboxCurrentStaffId: staffMailbox.currentStaffId,
      mailboxState: staffMailbox.state,
    })
    .from(inboundEmail)
    .innerJoin(staffMailbox, eq(inboundEmail.staffMailboxId, staffMailbox.id))
    .where(and(eq(inboundEmail.id, id), eq(inboundEmail.tenantId, tenantId)))
    .limit(1)

  if (!row) return null
  if (role === 'TENANT_ADMIN') return row
  if (row.mailboxState === 'handoff_required' || row.mailboxCurrentStaffId !== staffId) {
    return null
  }
  return row
}

/**
 * Tenant-scoped inbound email detail + attachment metadata.
 * 열람 범위: TENANT_ADMIN은 테넌트 전체, STAFF는 자기 메일함만. 권한 밖이면 404로
 * 존재 여부를 노출하지 않는다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const [me] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const row = await loadAccessibleEmail(tenantId, me.id, me.role, id)
    if (!row) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    let clientLabelName: string | null = null
    if (row.email.clientLabelId) {
      const [labelRow] = await db
        .select({ name: client.name })
        .from(client)
        .where(and(eq(client.id, row.email.clientLabelId), eq(client.tenantId, tenantId)))
        .limit(1)
      clientLabelName = labelRow?.name ?? null
    }

    const attachments = await db
      .select({
        id: inboundEmailAttachment.id,
        originalFilename: inboundEmailAttachment.originalFilename,
        contentType: inboundEmailAttachment.contentType,
        fileSize: inboundEmailAttachment.fileSize,
        status: inboundEmailAttachment.status,
        downloadReady: inboundEmailAttachment.storageKey,
      })
      .from(inboundEmailAttachment)
      .where(
        and(
          eq(inboundEmailAttachment.inboundEmailId, id),
          eq(inboundEmailAttachment.tenantId, tenantId),
        ),
      )

    return Response.json({
      email: { ...row.email, clientLabelName },
      attachments: attachments.map((attachment) => ({
        ...attachment,
        downloadReady: Boolean(attachment.downloadReady),
      })),
    })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[GET /api/inbound-emails/[id]]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 담당직원 액션: 고객사 라벨 부착/해제(수동), 보류/보류 해제.
 * 권한 스코프는 GET과 동일 (TENANT_ADMIN 전체 / STAFF 자기 메일함만).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const [me] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const row = await loadAccessibleEmail(tenantId, me.id, me.role, id)
    if (!row) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = inboundEmailActionSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const ts = toDBString(now())

    if (parsed.data.action === 'set_label') {
      const { clientLabelId } = parsed.data
      if (clientLabelId) {
        const [clientRow] = await db
          .select({ id: client.id })
          .from(client)
          .where(and(eq(client.id, clientLabelId), eq(client.tenantId, tenantId)))
          .limit(1)
        if (!clientRow) {
          return Response.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
        }
      }
      await db
        .update(inboundEmail)
        .set({ clientLabelId, updatedAt: ts })
        .where(and(eq(inboundEmail.id, id), eq(inboundEmail.tenantId, tenantId)))
    } else if (parsed.data.action === 'hold') {
      await db
        .update(inboundEmail)
        .set({ processingStatus: 'held', updatedAt: ts })
        .where(and(eq(inboundEmail.id, id), eq(inboundEmail.tenantId, tenantId)))
    } else {
      await db
        .update(inboundEmail)
        .set({ processingStatus: 'stored', updatedAt: ts })
        .where(and(eq(inboundEmail.id, id), eq(inboundEmail.tenantId, tenantId)))
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[PATCH /api/inbound-emails/[id]]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

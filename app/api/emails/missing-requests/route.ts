import { NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outboundEmail, uploadSession, client } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const rows = await db
      .select({
        id: outboundEmail.id,
        type: outboundEmail.type,
        subject: outboundEmail.subject,
        body: outboundEmail.body,
        toEmail: outboundEmail.toEmail,
        status: outboundEmail.status,
        appliedAnalysisNotes: outboundEmail.appliedAnalysisNotes,
        criteriaSummary: outboundEmail.criteriaSummary,
        sentAt: outboundEmail.sentAt,
        createdAt: outboundEmail.createdAt,
        sessionId: uploadSession.id,
        accountingPeriod: uploadSession.accountingPeriod,
        clientName: client.name,
        clientEmail: client.email,
      })
      .from(outboundEmail)
      .innerJoin(uploadSession, eq(outboundEmail.uploadSessionId, uploadSession.id))
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .where(
        and(
          eq(outboundEmail.tenantId, tenantId),
          eq(outboundEmail.type, 'missing_request'),
          eq(outboundEmail.status, 'draft'),
          eq(uploadSession.tenantId, tenantId),
          eq(uploadSession.status, 'needs_resubmission'),
          eq(client.tenantId, tenantId),
        ),
      )
      .orderBy(desc(outboundEmail.createdAt))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/emails/missing-requests]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  payrollExcelDraft,
  payrollExtractionBatch,
  payrollExtractionRow,
  staff,
  uploadSession,
} from '@/lib/db/schema'
import { derivePayrollResultExcelDownloadState } from '@/lib/sessions/payroll-source-download'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, draftId } = await params

    const [staffRecord] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const [session] = await db
      .select({
        id: uploadSession.id,
        requestKind: uploadSession.requestKind,
        createdByStaffId: uploadSession.createdByStaffId,
      })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }
    if (staffRecord.role === 'STAFF' && session.createdByStaffId !== staffRecord.id) {
      return NextResponse.json({ error: '자신이 생성한 세션의 결과 엑셀만 다운로드할 수 있습니다' }, { status: 403 })
    }
    if (session.requestKind !== 'payroll') {
      return NextResponse.json({ error: '급여정산 세션이 아닙니다' }, { status: 409 })
    }

    const draftRows = await db
      .select()
      .from(payrollExcelDraft)
      .where(
        and(
          eq(payrollExcelDraft.id, draftId),
          eq(payrollExcelDraft.uploadSessionId, sessionId),
          eq(payrollExcelDraft.tenantId, tenantId),
          eq(payrollExcelDraft.status, 'generated'),
        ),
      )
      .limit(1)

    const draft = draftRows[0]
    if (!draft || !draft.storageKey) {
      return NextResponse.json({ error: '다운로드 파일을 찾을 수 없습니다' }, { status: 404 })
    }

    const [batch] = await db
      .select({ id: payrollExtractionBatch.id, status: payrollExtractionBatch.status })
      .from(payrollExtractionBatch)
      .where(and(eq(payrollExtractionBatch.id, draft.batchId), eq(payrollExtractionBatch.tenantId, tenantId)))
      .limit(1)

    const rowVerdicts = await db
      .select({ aiVerdict: payrollExtractionRow.aiVerdict })
      .from(payrollExtractionRow)
      .where(
        and(
          eq(payrollExtractionRow.batchId, draft.batchId),
          eq(payrollExtractionRow.uploadSessionId, sessionId),
          eq(payrollExtractionRow.tenantId, tenantId),
        ),
      )

    const state = derivePayrollResultExcelDownloadState({
      batchStatus: batch?.status ?? null,
      rowVerdicts: rowVerdicts.map((row) => row.aiVerdict),
    })

    if (!state.enabled) {
      return NextResponse.json({ error: state.detail }, { status: 409 })
    }

    const blob = await get(draft.storageKey, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 })
    }

    const buffer = await new Response(blob.stream).arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(draft.filename)}`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/payroll/drafts/[draftId]/download]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

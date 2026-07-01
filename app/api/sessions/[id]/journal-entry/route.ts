import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  canAccessJournalEntrySession,
  getActiveStaffForUser,
  getLatestBookkeepingJournalEntry,
} from '@/lib/bookkeeping/journal-entry-service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }
    const canAccess = await canAccessJournalEntrySession({ sessionId, tenantId, staffRecord })
    if (!canAccess) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const journalEntry = await getLatestBookkeepingJournalEntry({ sessionId, tenantId })
    return NextResponse.json(journalEntry)
  } catch (err) {
    console.error('[GET /api/sessions/[id]/journal-entry]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

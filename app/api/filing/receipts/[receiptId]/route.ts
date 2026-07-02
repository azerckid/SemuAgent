import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { filingReceipt } from '@/lib/db/schema'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { receiptId } = await params

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [receipt] = await db
      .select({ id: filingReceipt.id })
      .from(filingReceipt)
      .where(and(eq(filingReceipt.id, receiptId), eq(filingReceipt.tenantId, tenantId)))
      .limit(1)

    if (!receipt) {
      return NextResponse.json({ error: '접수증을 찾을 수 없습니다.' }, { status: 404 })
    }

    await db
      .delete(filingReceipt)
      .where(and(eq(filingReceipt.id, receipt.id), eq(filingReceipt.tenantId, tenantId)))

    revalidatePath('/dashboard/filing-support')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/filing/receipts/[receiptId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

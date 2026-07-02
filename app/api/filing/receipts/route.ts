import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { filingItem, filingReceipt } from '@/lib/db/schema'
import {
  buildDefaultFilingItemRecord,
  loadFilingSupportSummary,
} from '@/lib/filing-support/summary'
import { now, toDBString } from '@/lib/time'
import { filingReceiptCreateSchema } from '@/lib/validations/filing-support'

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsed = filingReceiptCreateSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const summary = await loadFilingSupportSummary({
      tenantId,
      periodKey: parsed.data.filingPeriodKey,
    })
    const businessEntity = summary.businessEntity
    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const item = summary.items.find((candidate) => candidate.type === parsed.data.itemType)
    if (!item) {
      return NextResponse.json({ error: '신고 항목을 찾을 수 없습니다.' }, { status: 404 })
    }

    const ts = toDBString(now(summary.tenant.timezone))
    await db
      .insert(filingItem)
      .values(buildDefaultFilingItemRecord({
        tenantId,
        clientId: businessEntity.id,
        period: summary.period,
        item,
        timestamp: ts,
      }))
      .onConflictDoNothing({
        target: [
          filingItem.tenantId,
          filingItem.clientId,
          filingItem.filingPeriodKey,
          filingItem.itemType,
        ],
      })

    const receiptId = randomUUID()
    await db.insert(filingReceipt).values({
      id: receiptId,
      tenantId,
      clientId: businessEntity.id,
      filingItemId: item.id,
      receiptType: parsed.data.receiptType,
      originalFilename: parsed.data.originalFilename,
      storageKey: buildReceiptStorageKey({
        tenantId,
        filingPeriodKey: parsed.data.filingPeriodKey,
        itemType: parsed.data.itemType,
        receiptId,
        originalFilename: parsed.data.originalFilename,
      }),
      fileHash: parsed.data.fileHash ?? null,
      uploadedByStaffId: staffRecord.id,
      uploadedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    })

    await db
      .update(filingItem)
      .set({
        status: 'submitted',
        packageStatus: 'submitted',
        submittedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(filingItem.id, item.id), eq(filingItem.tenantId, tenantId)))

    revalidatePath('/dashboard/filing-support')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, receiptId })
  } catch (err) {
    console.error('[POST /api/filing/receipts]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

function buildReceiptStorageKey(params: {
  tenantId: string
  filingPeriodKey: string
  itemType: string
  receiptId: string
  originalFilename: string
}) {
  const safeName = params.originalFilename.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  return [
    'filing-receipts',
    params.tenantId,
    params.filingPeriodKey,
    params.itemType,
    `${params.receiptId}-${safeName}`,
  ].join('/')
}

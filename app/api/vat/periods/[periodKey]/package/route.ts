import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { client, vatDeductionReview, vatPeriodSummary } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { buildVatPeriodRecalculation } from '@/lib/vat/summary'
import { vatPeriodKeySchema } from '@/lib/validations/vat'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ periodKey: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { periodKey: rawPeriodKey } = await params
    const periodKey = vatPeriodKeySchema.safeParse(rawPeriodKey)

    if (!periodKey.success) {
      return NextResponse.json({ error: periodKey.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [businessEntity] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.tenantId, tenantId))
      .orderBy(client.createdAt)
      .limit(1)

    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const [summary, reviewRows] = await Promise.all([
      db
        .select({
          id: vatPeriodSummary.id,
          outputTaxKrw: vatPeriodSummary.outputTaxKrw,
          inputTaxDeductibleKrw: vatPeriodSummary.inputTaxDeductibleKrw,
          payableTaxKrw: vatPeriodSummary.payableTaxKrw,
          pendingDeductionCount: vatPeriodSummary.pendingDeductionCount,
          packageStatus: vatPeriodSummary.packageStatus,
        })
        .from(vatPeriodSummary)
        .where(and(
          eq(vatPeriodSummary.tenantId, tenantId),
          eq(vatPeriodSummary.clientId, businessEntity.id),
          eq(vatPeriodSummary.periodKey, periodKey.data),
          eq(vatPeriodSummary.filingType, 'final'),
        ))
        .limit(1),
      db
        .select({
          decision: vatDeductionReview.decision,
          inputTaxKrw: vatDeductionReview.inputTaxKrw,
          prorationRateBps: vatDeductionReview.prorationRateBps,
        })
        .from(vatDeductionReview)
        .where(and(
          eq(vatDeductionReview.tenantId, tenantId),
          eq(vatDeductionReview.clientId, businessEntity.id),
          eq(vatDeductionReview.periodKey, periodKey.data),
        )),
    ])

    const periodSummary = summary[0]
    if (!periodSummary) {
      return NextResponse.json({ error: '부가세 summary가 아직 생성되지 않았습니다.' }, { status: 404 })
    }

    const recalculation = reviewRows.length > 0
      ? buildVatPeriodRecalculation(periodSummary, reviewRows)
      : {
        inputTaxDeductibleKrw: periodSummary.inputTaxDeductibleKrw,
        payableTaxKrw: periodSummary.payableTaxKrw,
        pendingDeductionCount: periodSummary.pendingDeductionCount,
      }
    const pendingDeductionCount = recalculation.pendingDeductionCount

    if (pendingDeductionCount > 0) {
      return NextResponse.json({
        error: `공제 검토 ${pendingDeductionCount}건 완료 후 패키지를 생성할 수 있습니다.`,
      }, { status: 409 })
    }

    const ts = toDBString(now())
    await db
      .update(vatPeriodSummary)
      .set({
        inputTaxDeductibleKrw: recalculation.inputTaxDeductibleKrw,
        payableTaxKrw: recalculation.payableTaxKrw,
        pendingDeductionCount: 0,
        packageStatus: 'generated',
        generatedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(vatPeriodSummary.id, periodSummary.id), eq(vatPeriodSummary.tenantId, tenantId)))

    revalidatePath('/dashboard/vat')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true, packageStatus: 'generated' })
  } catch (err) {
    console.error('[POST /api/vat/periods/[periodKey]/package]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

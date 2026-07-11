import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { applyVatTaxTreatmentMutation } from '@/lib/vat/tax-treatment-mutations'
import { vatTaxTreatmentMutationSchema } from '@/lib/validations/vat-tax-treatment'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { rowId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const input = vatTaxTreatmentMutationSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
    }

    const result = await applyVatTaxTreatmentMutation({
      tenantId,
      staffId: staffRecord.id,
      rowId,
      input: input.data,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    revalidatePath('/dashboard/vat')
    revalidatePath('/dashboard')

    return NextResponse.json({
      ok: true,
      status: result.status,
      finalDecision: result.finalDecision,
      undoToken: result.undoToken,
    })
  } catch (error) {
    console.error('[PATCH /api/vat/tax-treatments/[rowId]]', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

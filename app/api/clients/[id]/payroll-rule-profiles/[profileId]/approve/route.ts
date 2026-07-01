import { NextResponse } from 'next/server'
import { z } from 'zod'
import { approveClientPayrollRuleProfile } from '@/lib/payroll/rule-profile-registry'
import { requirePayrollRuleProfileStaffAccess } from '@/lib/payroll/rule-profile-staff-access'
import { payrollPeriodMonthSchema } from '@/lib/validations/payroll-rule-profile'

const approveBodySchema = z
  .object({
    effectiveFrom: payrollPeriodMonthSchema,
    effectiveTo: payrollPeriodMonthSchema.nullish(),
    approvalNotes: z.string().trim().max(5000).nullish(),
    supersedeConfirmed: z.boolean().optional(),
  })
  .refine((input) => !input.effectiveTo || input.effectiveTo >= input.effectiveFrom, {
    message: 'effectiveTo는 effectiveFrom 이상이어야 합니다',
    path: ['effectiveTo'],
  })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; profileId: string }> },
) {
  try {
    const { id: clientId, profileId } = await params
    const access = await requirePayrollRuleProfileStaffAccess(clientId)

    const body = await req.json()
    const parsed = approveBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await approveClientPayrollRuleProfile({
      tenantId: access.tenantId,
      clientId: access.clientId,
      profileId,
      approvedByStaffId: access.staffId,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo ?? null,
      approvalNotes: parsed.data.approvalNotes ?? null,
      supersedeConfirmed: parsed.data.supersedeConfirmed,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      )
    }

    return NextResponse.json({
      id: result.profile.id,
      status: result.profile.status,
      version: result.profile.version,
      effectiveFrom: result.profile.effectiveFrom,
      effectiveTo: result.profile.effectiveTo,
      approvedAt: result.profile.approvedAt,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

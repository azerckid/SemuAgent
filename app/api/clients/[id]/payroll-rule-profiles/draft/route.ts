import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, staff } from '@/lib/db/schema'
import { transformPayrollRuleFileToDraft } from '@/lib/payroll/rule-profile-file-transform'
import { transformNaturalLanguageToRuleDraft } from '@/lib/payroll/rule-profile-nl-transform'
import { createClientPayrollRuleProfileDraft } from '@/lib/payroll/rule-profile-registry'
import { payrollPeriodMonthSchema } from '@/lib/validations/payroll-rule-profile'

const draftBodySchema = z.discriminatedUnion('sourceType', [
  z.object({
    sourceType: z.literal('natural_language'),
    naturalLanguage: z.string().trim().min(1).max(20_000),
    effectiveFrom: payrollPeriodMonthSchema,
    effectiveTo: payrollPeriodMonthSchema.nullish(),
  }).refine((input) => !input.effectiveTo || input.effectiveTo >= input.effectiveFrom, {
    message: 'effectiveTo는 effectiveFrom 이상이어야 합니다',
    path: ['effectiveTo'],
  }),
  z.object({
    sourceType: z.enum(['rule_document', 'excel_embedded']),
    sourceFileId: z.string().min(1),
    effectiveFrom: payrollPeriodMonthSchema,
    effectiveTo: payrollPeriodMonthSchema.nullish(),
  }).refine((input) => !input.effectiveTo || input.effectiveTo >= input.effectiveFrom, {
    message: 'effectiveTo는 effectiveFrom 이상이어야 합니다',
    path: ['effectiveTo'],
  }),
])

type DraftTransformResult =
  | { status: 'blocked_tee' }
  | { status: 'failed'; error: string }
  | { status: 'ok'; sourceHash: string; model: string; profile: Parameters<typeof createClientPayrollRuleProfileDraft>[0]['profile']; sourceSummary: Parameters<typeof createClientPayrollRuleProfileDraft>[0]['sourceSummary'] }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: clientId } = await params

    const body = await req.json()
    const parsed = draftBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [clientRows, staffRows] = await Promise.all([
      db
        .select({ id: client.id, staffId: client.staffId })
        .from(client)
        .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
        .limit(1),
      db
        .select({ id: staff.id, role: staff.role })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
        .limit(1),
    ])

    const clientRow = clientRows[0]
    if (!clientRow) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }
    const staffRow = staffRows[0]
    if (!staffRow) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }
    if (staffRow.role !== 'TENANT_ADMIN' && clientRow.staffId !== staffRow.id) {
      return NextResponse.json({ error: '이 고객사의 담당자 또는 관리자만 급여기준 초안을 만들 수 있습니다' }, { status: 403 })
    }

    let transform: DraftTransformResult
    if (parsed.data.sourceType === 'natural_language') {
      const result = await transformNaturalLanguageToRuleDraft({
        clientId,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveTo: parsed.data.effectiveTo ?? null,
        naturalLanguage: parsed.data.naturalLanguage,
      })
      if (result.status === 'blocked_tee') transform = { status: 'blocked_tee' }
      else if (result.status === 'failed') transform = { status: 'failed', error: result.error }
      else {
        transform = {
          status: 'ok',
          sourceHash: result.sourceHash,
          model: result.model,
          profile: result.profile,
          sourceSummary: result.sourceSummary,
        }
      }
    } else {
      const result = await transformPayrollRuleFileToDraft({
        tenantId,
        clientId,
        sourceFileId: parsed.data.sourceFileId,
        expectedSourceType: parsed.data.sourceType,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveTo: parsed.data.effectiveTo ?? null,
      })
      if (result.status === 'blocked_tee') transform = { status: 'blocked_tee' }
      else if (result.status === 'failed') transform = { status: 'failed', error: result.error }
      else {
        transform = {
          status: 'ok',
          sourceHash: result.sourceHash,
          model: result.model,
          profile: result.profile,
          sourceSummary: result.sourceSummary,
        }
      }
    }

    if (transform.status === 'blocked_tee') {
      return NextResponse.json(
        {
          error: '민감정보 보호 기준상 이 자료는 일반 AI로 처리하지 않습니다. 주민번호·계좌번호·연락처 같은 개인정보를 빼고 규칙만 입력해 주세요.',
          securityLane: 'tee_required',
        },
        { status: 422 },
      )
    }
    if (transform.status === 'failed') {
      return NextResponse.json({ error: transform.error }, { status: 502 })
    }

    let row: Awaited<ReturnType<typeof createClientPayrollRuleProfileDraft>>
    try {
      row = await createClientPayrollRuleProfileDraft({
        tenantId,
        clientId,
        profile: transform.profile,
        sourceSummary: transform.sourceSummary,
        createdByStaffId: staffRow.id,
      })
    } catch {
      return NextResponse.json({ error: '급여기준 초안 저장 중 오류가 발생했습니다' }, { status: 500 })
    }

    return NextResponse.json(
      { id: row.id, sourceHash: transform.sourceHash, model: transform.model },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: '급여기준 초안 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}

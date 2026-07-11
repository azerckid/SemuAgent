import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import {
  client,
  payrollEmployeeLine,
  payrollInsuranceNoticeImport,
  payrollInsuranceNoticeLine,
  payrollPeriodSummary,
} from '@/lib/db/schema'
import { recalculatePayrollPeriodSummary } from '@/lib/payroll-workspace/recalculate'
import { buildPayrollRegisterRow } from '@/lib/payroll-workspace/summary'
import { now, toDBString } from '@/lib/time'
import { payrollInsuranceNoticeImportSchema, payrollPeriodKeySchema } from '@/lib/validations/payroll-workspace'

type EmployeeLineMatchCandidate = {
  id: string
  employeeCode: string | null
  employeeName: string
}

function findEmployeeLineMatch(
  noticeLine: { employeeCode?: string | null; employeeName?: string | null },
  employeeLines: EmployeeLineMatchCandidate[],
) {
  const employeeCode = noticeLine.employeeCode?.trim()
  if (employeeCode) {
    const codeMatches = employeeLines.filter((line) => line.employeeCode === employeeCode)
    if (codeMatches.length === 1) return { status: 'matched' as const, line: codeMatches[0] }
    if (codeMatches.length > 1) return { status: 'ambiguous' as const, line: null }
  }

  const employeeName = noticeLine.employeeName?.trim()
  if (employeeName) {
    const nameMatches = employeeLines.filter((line) => line.employeeName === employeeName)
    if (nameMatches.length === 1) return { status: 'matched' as const, line: nameMatches[0] }
    if (nameMatches.length > 1) return { status: 'ambiguous' as const, line: null }
  }

  return { status: 'unmatched' as const, line: null }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ period: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { period: rawPeriod } = await params
    const period = payrollPeriodKeySchema.safeParse(rawPeriod)

    if (!period.success) {
      return NextResponse.json({ error: period.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const input = payrollInsuranceNoticeImportSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
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

    const [summary] = await db
      .select({
        id: payrollPeriodSummary.id,
        closeStatus: payrollPeriodSummary.closeStatus,
      })
      .from(payrollPeriodSummary)
      .where(and(
        eq(payrollPeriodSummary.tenantId, tenantId),
        eq(payrollPeriodSummary.clientId, businessEntity.id),
        eq(payrollPeriodSummary.payrollPeriod, period.data),
      ))
      .limit(1)

    if (!summary) {
      return NextResponse.json({ error: '급여대장이 아직 생성되지 않았습니다.' }, { status: 404 })
    }
    if (summary.closeStatus === 'closed') {
      return NextResponse.json({ error: '마감된 급여에는 고지내역을 반영할 수 없습니다.' }, { status: 409 })
    }

    const employeeLines = await db
      .select({
        id: payrollEmployeeLine.id,
        employeeCode: payrollEmployeeLine.employeeCode,
        employeeName: payrollEmployeeLine.employeeName,
        department: payrollEmployeeLine.department,
        jobTitle: payrollEmployeeLine.jobTitle,
        jobType: payrollEmployeeLine.jobType,
        baseSalaryKrw: payrollEmployeeLine.baseSalaryKrw,
        mealAllowanceKrw: payrollEmployeeLine.mealAllowanceKrw,
        allowanceKrw: payrollEmployeeLine.allowanceKrw,
        dependentCount: payrollEmployeeLine.dependentCount,
        incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
        localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
        nationalPensionKrw: payrollEmployeeLine.nationalPensionKrw,
        healthInsuranceKrw: payrollEmployeeLine.healthInsuranceKrw,
        longTermCareKrw: payrollEmployeeLine.longTermCareKrw,
        employmentInsuranceKrw: payrollEmployeeLine.employmentInsuranceKrw,
        otherDeductionKrw: payrollEmployeeLine.otherDeductionKrw,
        noticeMatchStatus: payrollEmployeeLine.noticeMatchStatus,
        status: payrollEmployeeLine.status,
        issueCode: payrollEmployeeLine.issueCode,
        issueMessage: payrollEmployeeLine.issueMessage,
      })
      .from(payrollEmployeeLine)
      .where(and(
        eq(payrollEmployeeLine.tenantId, tenantId),
        eq(payrollEmployeeLine.clientId, businessEntity.id),
        eq(payrollEmployeeLine.periodSummaryId, summary.id),
      ))

    const ts = toDBString(now())
    const importId = randomUUID()
    await db.insert(payrollInsuranceNoticeImport).values({
      id: importId,
      tenantId,
      clientId: businessEntity.id,
      payrollPeriod: period.data,
      sourceType: input.data.sourceType,
      originalFilename: input.data.originalFilename ?? null,
      storageKey: null,
      fileHash: input.data.fileHash ?? null,
      status: 'uploaded',
      importedByStaffId: staffRecord.id,
      importedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    })

    let matchedCount = 0
    let ambiguousCount = 0
    const noticeLineValues = input.data.lines.map((noticeLine) => {
      const match = findEmployeeLineMatch(noticeLine, employeeLines)
      if (match.status === 'matched') matchedCount += 1
      if (match.status === 'ambiguous') ambiguousCount += 1
      return {
        id: randomUUID(),
        tenantId,
        clientId: businessEntity.id,
        noticeImportId: importId,
        employeeCode: noticeLine.employeeCode ?? null,
        employeeName: noticeLine.employeeName ?? null,
        matchKeyHash: noticeLine.matchKeyHash ?? null,
        nationalPensionKrw: noticeLine.nationalPensionKrw,
        healthInsuranceKrw: noticeLine.healthInsuranceKrw,
        longTermCareKrw: noticeLine.longTermCareKrw,
        employmentInsuranceKrw: noticeLine.employmentInsuranceKrw,
        matchStatus: match.status,
        matchedEmployeeLineId: match.line?.id ?? null,
        createdAt: ts,
        updatedAt: ts,
      }
    })

    await db.insert(payrollInsuranceNoticeLine).values(noticeLineValues)

    for (const noticeLine of noticeLineValues) {
      if (!noticeLine.matchedEmployeeLineId) continue
      const currentLine = employeeLines.find((line) => line.id === noticeLine.matchedEmployeeLineId)
      if (!currentLine) continue
      const derived = buildPayrollRegisterRow({
        ...currentLine,
        nationalPensionKrw: noticeLine.nationalPensionKrw,
        healthInsuranceKrw: noticeLine.healthInsuranceKrw,
        longTermCareKrw: noticeLine.longTermCareKrw,
        employmentInsuranceKrw: noticeLine.employmentInsuranceKrw,
        noticeMatchStatus: 'matched',
        status: currentLine.status === 'closed' ? 'closed' : 'ready',
        issueCode: null,
        issueMessage: null,
      })
      await db
        .update(payrollEmployeeLine)
        .set({
          nationalPensionKrw: noticeLine.nationalPensionKrw,
          healthInsuranceKrw: noticeLine.healthInsuranceKrw,
          longTermCareKrw: noticeLine.longTermCareKrw,
          employmentInsuranceKrw: noticeLine.employmentInsuranceKrw,
          socialInsuranceKrw: derived.socialInsuranceKrw,
          deductionTotalKrw: derived.deductionTotalKrw,
          netPayKrw: derived.netPayKrw,
          noticeMatchStatus: 'matched',
          noticeLineId: noticeLine.id,
          status: 'ready',
          issueCode: null,
          issueMessage: null,
          editedByStaffId: staffRecord.id,
          editedAt: ts,
          updatedAt: ts,
        })
        .where(and(eq(payrollEmployeeLine.id, noticeLine.matchedEmployeeLineId), eq(payrollEmployeeLine.tenantId, tenantId)))
    }

    const noticeImportStatus = matchedCount === employeeLines.length && ambiguousCount === 0
        ? 'matched'
        : 'partial'

    await db
      .update(payrollInsuranceNoticeImport)
      .set({ status: matchedCount > 0 ? 'matched' : 'parsed', updatedAt: ts })
      .where(and(eq(payrollInsuranceNoticeImport.id, importId), eq(payrollInsuranceNoticeImport.tenantId, tenantId)))

    await db
      .update(payrollPeriodSummary)
      .set({ noticeImportStatus, updatedAt: ts })
      .where(and(eq(payrollPeriodSummary.id, summary.id), eq(payrollPeriodSummary.tenantId, tenantId)))

    await recalculatePayrollPeriodSummary({ tenantId, periodSummaryId: summary.id })
    revalidatePath('/dashboard/payroll')
    revalidatePath('/dashboard')

    return NextResponse.json({
      ok: true,
      importId,
      matchedCount,
      ambiguousCount,
      totalCount: noticeLineValues.length,
    })
  } catch (err) {
    console.error('[POST /api/payroll/periods/[period]/insurance-notices]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

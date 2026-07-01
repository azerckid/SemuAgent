import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  uploadSession, staff,
  payrollExtractionBatch, payrollExtractionRow,
  payrollExcelTemplate, payrollExcelDraft,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  generatePayrollExcelDraft,
  DEFAULT_MAPPING_JSON,
  DEFAULT_TEMPLATE_RELATIVE_PATH,
} from '@/lib/services/payroll-service'
import { deleteSupersededPayrollDraftBlobs } from '@/lib/sessions/blob-cleanup'

const DEDUCTION_COMPONENT_FIELDS = [
  'nationalPension',
  'healthInsurance',
  'longTermCare',
  'employmentInsurance',
  'incomeTax',
  'localIncomeTax',
  'otherDeduction',
] as const

function readDeductionComponents(sourceReference: string | null): Partial<Record<typeof DEDUCTION_COMPONENT_FIELDS[number], number | null>> {
  if (!sourceReference) return {}
  try {
    const parsed = JSON.parse(sourceReference) as { deductionComponents?: Record<string, unknown> }
    const components = parsed.deductionComponents
    if (!components || typeof components !== 'object') return {}
    return Object.fromEntries(
      DEDUCTION_COMPONENT_FIELDS.map((field) => [
        field,
        typeof components[field] === 'number' ? components[field] : null,
      ]),
    )
  } catch {
    return {}
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    // 세션 확인
    const sessionRows = await db
      .select()
      .from(uploadSession)
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    const session = sessionRows[0]
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }
    if (session.requestKind !== 'payroll') {
      return NextResponse.json({ error: '급여정산 세션이 아닙니다' }, { status: 400 })
    }

    // 담당자 조회
    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    // 가장 최신 batch 조회
    const batches = await db
      .select()
      .from(payrollExtractionBatch)
      .where(and(eq(payrollExtractionBatch.uploadSessionId, sessionId), eq(payrollExtractionBatch.tenantId, tenantId)))
      .orderBy(payrollExtractionBatch.createdAt)

    const batch = batches[batches.length - 1]
    if (!batch) {
      return NextResponse.json({ error: '먼저 급여 추출을 실행해 주세요' }, { status: 400 })
    }

    // payroll 출력은 적합(pass) row만 사용한다.
    // 부적합(fail)이 하나라도 있으면 출력 양식 엑셀을 생성하지 않는다.
    const passRows = await db
      .select()
      .from(payrollExtractionRow)
      .where(
        and(
          eq(payrollExtractionRow.batchId, batch.id),
          eq(payrollExtractionRow.uploadSessionId, sessionId),
          eq(payrollExtractionRow.tenantId, tenantId),
          eq(payrollExtractionRow.aiVerdict, 'pass'),
        ),
      )

    const failRows = await db
      .select({
        id: payrollExtractionRow.id,
        employeeCode: payrollExtractionRow.employeeCode,
        employeeName: payrollExtractionRow.employeeName,
        aiVerdictReason: payrollExtractionRow.aiVerdictReason,
      })
      .from(payrollExtractionRow)
      .where(
        and(
          eq(payrollExtractionRow.batchId, batch.id),
          eq(payrollExtractionRow.uploadSessionId, sessionId),
          eq(payrollExtractionRow.tenantId, tenantId),
          eq(payrollExtractionRow.aiVerdict, 'fail'),
        ),
      )

    if (failRows.length > 0) {
      const reasons = failRows
        .slice(0, 5)
        .map((r) => `${r.employeeName ?? r.employeeCode ?? '직원'}: ${r.aiVerdictReason ?? '부적합 사유 확인 필요'}`)
        .join('\n')
      return NextResponse.json(
        { error: `부적합 row가 ${failRows.length}개 있어 출력 엑셀을 생성할 수 없습니다.\n${reasons}` },
        { status: 400 },
      )
    }

    if (passRows.length === 0) {
      return NextResponse.json({
        error: '추출 불가: 출력 엑셀에 반영할 적합 급여 row가 없습니다. 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드하거나, 부적합 row를 수정한 뒤 다시 시도해 주세요.',
      }, { status: 400 })
    }

    // 템플릿 조회 (tenant 기본 템플릿 우선, 없으면 자동 생성)
    const templates = await db
      .select()
      .from(payrollExcelTemplate)
      .where(
        and(
          eq(payrollExcelTemplate.tenantId, tenantId),
          isNull(payrollExcelTemplate.clientId),
          eq(payrollExcelTemplate.status, 'active'),
        ),
      )
      .limit(1)

    let template = templates[0]
    if (!template) {
      // 테넌트 기본 템플릿 자동 생성 (MVP A안)
      const templateId = randomUUID()
      const ts = toDBString(now())
      await db.insert(payrollExcelTemplate).values({
        id: templateId,
        tenantId,
        clientId: null,
        name: '기본 급여정산 양식',
        originalFilename: '업로드용_엑셀파일.xlsx',
        storageKey: DEFAULT_TEMPLATE_RELATIVE_PATH,
        sheetName: 'Sheet1',
        headerRow: 1,
        subHeaderRow: 2,
        dataStartRow: 3,
        mappingJson: DEFAULT_MAPPING_JSON,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      })
      const newTemplate = await db.select().from(payrollExcelTemplate).where(and(eq(payrollExcelTemplate.id, templateId), eq(payrollExcelTemplate.tenantId, tenantId))).limit(1)
      template = newTemplate[0]
    }

    const ts = toDBString(now())
    const draftId = randomUUID()

    // 엑셀 초안 생성
    const result = await generatePayrollExcelDraft(
      passRows.map((r) => {
        const deductionComponents = readDeductionComponents(r.sourceReference)
        return {
          payrollPeriod: r.payrollPeriod,
          paymentDate: null,
          employeeCode: r.employeeCode,
          employeeName: r.employeeName,
          department: r.department,
          jobTitle: r.jobTitle,
          jobType: r.jobType,
          baseSalary: r.baseSalary,
          bonus: r.bonus,
          mealAllowance: r.mealAllowance,
          transportationAllowance: r.transportationAllowance,
          holidayWorkAllowance: r.holidayWorkAllowance,
          domesticTravelAllowance: r.domesticTravelAllowance,
          annualLeaveAllowance: r.annualLeaveAllowance,
          rndAllowance: r.rndAllowance,
          otherAllowance: r.otherAllowance,
          performanceIncentive: r.performanceIncentive,
          nightWorkAllowance: r.nightWorkAllowance,
          vehicleMaintenanceAllowance: r.vehicleMaintenanceAllowance,
          retroactivePay: r.retroactivePay,
          overtimeAllowance: r.overtimeAllowance,
          childcareAllowance: r.childcareAllowance,
          nationalPension: deductionComponents.nationalPension ?? null,
          healthInsurance: deductionComponents.healthInsurance ?? null,
          longTermCare: deductionComponents.longTermCare ?? null,
          employmentInsurance: deductionComponents.employmentInsurance ?? null,
          incomeTax: deductionComponents.incomeTax ?? null,
          localIncomeTax: deductionComponents.localIncomeTax ?? null,
          otherDeduction: deductionComponents.otherDeduction ?? null,
          deductionAmount: r.deductionAmount,
          memo: r.memo,
        }
      }),
      template.mappingJson,
      template.dataStartRow,
      template.sheetName,
      session.accountingPeriod,
      sessionId,
      template.storageKey,
      draftId,
    )

    await db.insert(payrollExcelDraft).values({
      id: draftId,
      tenantId,
      uploadSessionId: sessionId,
      batchId: batch.id,
      templateId: template.id,
      status: result.success ? 'generated' : 'failed',
      storageKey: result.success ? result.blobUrl : null,
      filename: result.success ? result.filename : `payroll_draft_${sessionId}_failed.xlsx`,
      passRowCount: passRows.length,
      excludedRowCount: failRows.length,
      errorMessage: result.success ? null : result.error,
      generatedByStaffId: staffRow[0].id,
      generatedAt: ts,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    try {
      await deleteSupersededPayrollDraftBlobs({
        tenantId,
        uploadSessionId: sessionId,
        keepDraftId: draftId,
      })
    } catch (cleanupErr) {
      console.error(`[POST /api/sessions/[id]/payroll/drafts] 이전 결과 엑셀 Blob 정리 실패 (non-fatal, sessionId=${sessionId})`, cleanupErr)
    }

    return NextResponse.json({ draftId, filename: result.filename }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/payroll/drafts]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

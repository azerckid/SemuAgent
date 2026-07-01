import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  uploadSession, client, staff, tenant,
  uploadFile, materialMatch, analysisRun,
  clientChecklist, checklistTemplate, checklistItem,
  auditProof, requestItemValidation, requestItemValidationFile,
  payrollExtractionBatch, payrollExtractionRow, payrollExcelDraft,
} from '@/lib/db/schema'
import { SessionDetail } from './_components/session-detail'
import { PayrollSection } from './_components/payroll-section'
import { fromISO } from '@/lib/time'
import {
  derivePayrollResultExcelDownloadState,
} from '@/lib/sessions/payroll-source-download'

interface PageProps {
  params: Promise<{ id: string }>
}

type UploadFileRow = typeof uploadFile.$inferSelect
type UploadSessionRow = typeof uploadSession.$inferSelect
type StaffRow = typeof staff.$inferSelect

const SESSION_STATUS: Record<string, string> = {
  requested: '업로드 대기',
  active: '업로드 중',
  submitted: '제출 완료',
  ai_checking: 'AI 판단 중',
  needs_resubmission: '자료 보완 필요',
  ready_for_accountant: '매칭 완료',
  completed: '완료',
  expired: '만료',
  revoked: '취소',
  draft: '초안',
}

const SESSION_STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  ready_for_accountant: 'bg-green-50 text-green-700',
  submitted: 'bg-purple-100 text-purple-700',
  ai_checking: 'bg-blue-100 text-blue-700',
  active: 'bg-blue-100 text-blue-700',
  needs_resubmission: 'bg-orange-100 text-orange-700',
  requested: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-500',
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function PayrollSessionHeader({
  session,
  displayClientName,
  staffRecord,
}: {
  session: UploadSessionRow
  displayClientName: string
  staffRecord: StaffRow
}) {
  const expiryLabel = session.source === 'staff_direct' ? '테스트 세션 만료' : '제출 기한'

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">
              {displayClientName} — {session.accountingPeriod} 급여정산
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              급여 세션
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SESSION_STATUS_COLOR[session.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {SESSION_STATUS[session.status] ?? session.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            담당: {staffRecord.name} · {expiryLabel}: {fromISO(session.expiresAt).toFormat('yyyy년 M월 d일')}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        이 화면은 급여 row 적합/부적합 판정과 결과 엑셀표 작성을 기준으로 봅니다.
        일반 자료 분석의 선택/미선택 파일 표시는 급여 세션의 운영 판단에 사용하지 않습니다.
      </div>
    </section>
  )
}

function PayrollUploadedFilesPanel({ files, sessionId }: { files: UploadFileRow[]; sessionId: string }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">업로드된 급여 자료</h2>
        <p className="mt-1 text-sm text-gray-500">
          급여 세션에서는 파일을 선택/미선택으로 나누지 않고, 추출 대상 원본 자료로만 표시합니다.
        </p>
      </div>
      {files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
          아직 업로드된 급여 자료가 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{file.originalFilename}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatBytes(file.fileSize)} · {fromISO(file.uploadedAt).toFormat('MM/dd HH:mm')}
                </p>
              </div>
              <a
                href={`/api/sessions/${sessionId}/payroll/source-files/download?fileId=${encodeURIComponent(file.id)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                다운로드
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { tenantId } = await requireTenantSession()
  const { id } = await params

  const sessionRows = await db
    .select({
      session: uploadSession,
      clientRecord: client,
      tenantRecord: tenant,
      staffRecord: staff,
    })
    .from(uploadSession)
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .innerJoin(tenant, eq(uploadSession.tenantId, tenant.id))
    .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
    .where(and(eq(uploadSession.id, id), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!sessionRows[0]) notFound()

  const { session, clientRecord, tenantRecord, staffRecord } = sessionRows[0]
  const displayClientName = session.staffDirectLabel ?? clientRecord.name

  const files = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, id), eq(uploadFile.tenantId, tenantId)))

  const matches = files.length > 0
    ? await db.select().from(materialMatch).where(
        and(
          inArray(materialMatch.uploadFileId, files.map((f) => f.id)),
          eq(materialMatch.tenantId, tenantId),
        ),
      )
    : []

  const analysisRuns = files.length > 0
    ? await db.select().from(analysisRun).where(
        and(
          inArray(analysisRun.uploadFileId, files.map((f) => f.id)),
          eq(analysisRun.tenantId, tenantId),
        ),
      )
    : []

  const itemRows = await db
    .select({ item: checklistItem })
    .from(clientChecklist)
    .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
    .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
    .where(and(eq(clientChecklist.clientId, clientRecord.id), eq(clientChecklist.tenantId, tenantId)))
    .orderBy(checklistItem.sortOrder)

  const proofRecords = await db
    .select()
    .from(auditProof)
    .where(and(eq(auditProof.uploadSessionId, id), eq(auditProof.tenantId, tenantId)))

  const itemValidations = await db
    .select()
    .from(requestItemValidation)
    .where(and(eq(requestItemValidation.uploadSessionId, id), eq(requestItemValidation.tenantId, tenantId)))

  const validationFiles = itemValidations.length > 0
    ? await db
        .select()
        .from(requestItemValidationFile)
        .where(
          and(
            inArray(requestItemValidationFile.validationId, itemValidations.map((v) => v.id)),
            eq(requestItemValidationFile.tenantId, tenantId),
          ),
        )
    : []

  // payroll 세션인 경우 추가 데이터 로드
  const isPayroll = session.requestKind === 'payroll'

  const payrollBatches = isPayroll
    ? await db
        .select()
        .from(payrollExtractionBatch)
        .where(and(eq(payrollExtractionBatch.uploadSessionId, id), eq(payrollExtractionBatch.tenantId, tenantId)))
        .orderBy(payrollExtractionBatch.createdAt)
    : []

  const latestBatch = payrollBatches.length > 0 ? payrollBatches[payrollBatches.length - 1] : null

  const payrollRows = latestBatch
    ? await db
        .select()
        .from(payrollExtractionRow)
        .where(and(eq(payrollExtractionRow.batchId, latestBatch.id), eq(payrollExtractionRow.tenantId, tenantId)))
        .orderBy(payrollExtractionRow.createdAt)
    : []

  const payrollDrafts = isPayroll
    ? await db
        .select()
        .from(payrollExcelDraft)
        .where(and(eq(payrollExcelDraft.uploadSessionId, id), eq(payrollExcelDraft.tenantId, tenantId)))
        .orderBy(payrollExcelDraft.generatedAt)
    : []

  const data = {
    session,
    client: clientRecord,
    tenant: tenantRecord,
    staff: staffRecord,
    files,
    matches,
    analysisRuns,
    checklistItems: itemRows.map((r) => r.item),
    proofRecords,
    itemValidations,
    validationFiles,
  }
  const payrollResultDownloadState = derivePayrollResultExcelDownloadState({
    batchStatus: latestBatch?.status ?? null,
    rowVerdicts: payrollRows.map((row) => row.aiVerdict),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard" className="hover:text-gray-700">대시보드</Link>
        <span>/</span>
        <span className="text-gray-900">{displayClientName} — {session.accountingPeriod}</span>
      </div>

      {isPayroll ? (
        <div className="space-y-4">
          <PayrollSessionHeader
            session={session}
            displayClientName={displayClientName}
            staffRecord={staffRecord}
          />
          <PayrollSection
            sessionId={id}
            clientName={displayClientName}
            batch={latestBatch}
            rows={payrollRows}
            drafts={payrollDrafts}
            resultDownloadState={payrollResultDownloadState}
          />
          <PayrollUploadedFilesPanel files={files} sessionId={id} />
        </div>
      ) : (
        <SessionDetail data={data} sessionId={id} />
      )}
    </div>
  )
}

import { and, desc, eq, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getOrCreateFiscalYearLedgerSummary } from '@/lib/bookkeeping/fiscal-year-ledger'
import { db } from '@/lib/db'
import {
  client,
  clientCcGroup,
  clientDocument,
  clientRequestEvent,
  staff,
  uploadSession,
} from '@/lib/db/schema'
import { loadPayrollDerivedStatusBySessionId } from '@/lib/payroll/load-payroll-derived-status'
import {
  PAYROLL_RULE_CLIENT_SUBMIT_MEMO,
  isPayrollRuleDocumentType,
  resolvePayrollRuleSourceTypeFromContentType,
} from '@/lib/payroll/payroll-rule-document-types'
import { loadReviewDerivedStatusBySessionId } from '@/lib/reviews/load-review-derived-status'
import { now } from '@/lib/time'
import {
  countApprovalBlockingConflicts,
  countNeedsReviewRows,
} from '@/lib/payroll/rule-profile-lifecycle'
import {
  getActiveClientPayrollRuleProfile,
  listClientPayrollRuleProfileSourcesByClient,
  listClientPayrollRuleProfiles,
  readProfileJson,
} from '@/lib/payroll/rule-profile-registry'
import {
  PAYROLL_RULE_SOURCE_TYPE_LABEL,
  type PayrollRuleDraftReviewRow,
  type PayrollRuleProfileView,
} from './_components/client-payroll-rule-profile-panel'
import type { PayrollRuleFormulaJson } from '@/lib/validations/payroll-rule-profile'
import { ClientDetailHeader } from './_components/client-detail-header'
import { ClientDetailTabs } from './_components/client-detail-tabs'
import { BookkeepingFiscalYearPanel } from './_components/bookkeeping-fiscal-year-panel'
import { BOOKKEEPING_FISCAL_YEAR_PANEL_HIDDEN_V1 } from './_components/bookkeeping-fiscal-year-panel-helpers'
import { ToastHandler } from './_components/toast-handler'
import type { ClientDetailDocument } from './_components/client-detail-types'

const searchParamsSchema = z.object({
  ledgerYear: z.coerce.number().int().min(2000).max(2100).optional(),
})

function formatRuleFormulaSummary(formula: PayrollRuleFormulaJson): string | null {
  const summary = formula.summary?.trim()
  return summary ? summary : null
}

function formatRuleLawBasisLabels(formula: PayrollRuleFormulaJson): string[] {
  return (formula.lawBasis ?? []).map((basis) => {
    const head = `${basis.lawName} ${basis.article}`.trim()
    return basis.summary ? `${head}(${basis.summary})` : head
  })
}

function formatRuleCalculationLabels(formula: PayrollRuleFormulaJson): string[] {
  const calculation = formula.calculation
  if (!calculation) return []
  const labels: string[] = []
  if (calculation.expression) labels.push(calculation.expression)
  if (calculation.unitAmount !== null && calculation.unitAmount !== undefined) {
    labels.push(`단가 ${calculation.unitAmount.toLocaleString('ko-KR')}`)
  }
  if (calculation.unit) labels.push(`단위 ${calculation.unit}`)
  if (calculation.quantityInputKey) labels.push(`수량 ${calculation.quantityInputKey}`)
  if (calculation.multiplier !== null && calculation.multiplier !== undefined) {
    labels.push(`배율 ${calculation.multiplier}`)
  }
  return labels
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenantId } = await requireTenantSession()
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const parsedSearchParams = searchParamsSchema.safeParse({
    ledgerYear: Array.isArray(resolvedSearchParams?.ledgerYear)
      ? resolvedSearchParams?.ledgerYear[0]
      : resolvedSearchParams?.ledgerYear,
  })
  const fiscalYear = parsedSearchParams.success && parsedSearchParams.data.ledgerYear
    ? parsedSearchParams.data.ledgerYear
    : now().setZone('Asia/Seoul').year

  const clientRows = await db
    .select({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      createdAt: client.createdAt,
      staffName: staff.name,
      staffId: staff.id,
    })
    .from(client)
    .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(and(eq(client.id, id), eq(client.tenantId, tenantId)))
    .limit(1)

  const currentClient = clientRows[0]
  if (!currentClient) notFound()

  const [sessions, events, ccGroups, documentRows, fiscalLedgerSummary] = await Promise.all([
    db
      .select({
        id: uploadSession.id,
        accountingPeriod: uploadSession.accountingPeriod,
        status: uploadSession.status,
        expiresAt: uploadSession.expiresAt,
        lastAccessedAt: uploadSession.lastAccessedAt,
        createdAt: uploadSession.createdAt,
        requestEventId: uploadSession.requestEventId,
        requestKind: uploadSession.requestKind,
      })
      .from(uploadSession)
      .where(and(
        eq(uploadSession.clientId, id),
        eq(uploadSession.tenantId, tenantId),
        isNull(uploadSession.deletedAt),
      ))
      .orderBy(desc(uploadSession.createdAt))
      .limit(100),
    db
      .select({
        id: clientRequestEvent.id,
        accountingPeriod: clientRequestEvent.accountingPeriod,
        frequency: clientRequestEvent.frequency,
        requestKind: clientRequestEvent.requestKind,
        title: clientRequestEvent.title,
        dueAt: clientRequestEvent.dueAt,
        status: clientRequestEvent.status,
        uploadSessionId: clientRequestEvent.uploadSessionId,
        createdAt: clientRequestEvent.createdAt,
      })
      .from(clientRequestEvent)
      .where(and(
        eq(clientRequestEvent.clientId, id),
        eq(clientRequestEvent.tenantId, tenantId),
        isNull(clientRequestEvent.deletedAt),
      ))
      .orderBy(desc(clientRequestEvent.createdAt))
      .limit(100),
    db
      .select({
        id: clientCcGroup.id,
        name: clientCcGroup.name,
        purpose: clientCcGroup.purpose,
        emails: clientCcGroup.emails,
        isDefault: clientCcGroup.isDefault,
      })
      .from(clientCcGroup)
      .where(and(eq(clientCcGroup.clientId, id), eq(clientCcGroup.tenantId, tenantId)))
      .orderBy(desc(clientCcGroup.isDefault), desc(clientCcGroup.createdAt)),
    db
      .select({
        id: clientDocument.id,
        documentType: clientDocument.documentType,
        originalFilename: clientDocument.originalFilename,
        contentType: clientDocument.contentType,
        fileSize: clientDocument.fileSize,
        memo: clientDocument.memo,
        uploadedByStaffName: staff.name,
        createdAt: clientDocument.createdAt,
      })
      .from(clientDocument)
      .leftJoin(staff, and(eq(clientDocument.uploadedByStaffId, staff.id), eq(staff.tenantId, tenantId)))
      .where(and(eq(clientDocument.clientId, id), eq(clientDocument.tenantId, tenantId)))
      .orderBy(desc(clientDocument.createdAt)),
    getOrCreateFiscalYearLedgerSummary({ tenantId, clientId: id, fiscalYear }),
  ])

  const documents: ClientDetailDocument[] = documentRows

  // 자료검토(기장/일반) 세션만 — 급여정산 세션은 별도 진행도 기준을 쓰므로 제외.
  const reviewSessionIds = sessions
    .filter((session) => session.requestKind !== 'payroll')
    .map((session) => session.id)
  const payrollSessionIds = sessions
    .filter((session) => session.requestKind === 'payroll')
    .map((session) => session.id)

  const [reviewStatusBySessionId, payrollStatusBySessionId] = await Promise.all([
    loadReviewDerivedStatusBySessionId({
      tenantId,
      sessionIds: reviewSessionIds,
      clientId: currentClient.id,
      clientName: currentClient.name,
      // deriveSessionStatus는 clientEmail을 읽지 않음 — 여기서는 다시 조회하지 않는다.
      clientEmail: '',
      staffName: currentClient.staffName,
    }),
    loadPayrollDerivedStatusBySessionId({
      tenantId,
      clientId: currentClient.id,
      sessionIds: payrollSessionIds,
    }),
  ])

  // 사내급여기준 프로필(Slice 2: 읽기/상태 전용) — 현재 월 기준 active 프로필 해석
  const currentMonth = now().setZone('Asia/Seoul').toFormat('yyyy-MM')
  const [allRuleProfiles, activeRuleProfile, ruleProfileSources] = await Promise.all([
    listClientPayrollRuleProfiles({ tenantId, clientId: currentClient.id }),
    getActiveClientPayrollRuleProfile({ tenantId, clientId: currentClient.id, payrollPeriod: currentMonth }),
    listClientPayrollRuleProfileSourcesByClient({ tenantId, clientId: currentClient.id }),
  ])

  // 충돌/TEE 상태는 active가 없어도(승인 전 draft만 있어도) 보여야 한다.
  // active + draft 프로필을 모두 집계 대상으로 본다.
  const relevantRuleProfiles = allRuleProfiles.filter(
    (profile) => profile.status === 'active' || profile.status === 'draft',
  )
  const relevantRuleProfileIds = new Set(relevantRuleProfiles.map((profile) => profile.id))
  const ruleProfileConflictCount = relevantRuleProfiles.reduce(
    (sum, profile) => {
      const parsed = readProfileJson(profile)
      return sum + (parsed ? countApprovalBlockingConflicts(parsed) : 0)
    },
    0,
  )
  const ruleProfileTeePending = ruleProfileSources.some(
    (source) => relevantRuleProfileIds.has(source.profileId) && source.securityLane === 'tee_required',
  )

  let activeRuleProfileView: PayrollRuleProfileView['active'] = null
  if (activeRuleProfile) {
    const activeSourceTypeLabels = [
      ...new Set(
        ruleProfileSources
          .filter((source) => source.profileId === activeRuleProfile.id)
          .map((source) => source.sourceType),
      ),
    ].map((type) => PAYROLL_RULE_SOURCE_TYPE_LABEL[type])
    activeRuleProfileView = {
      profileId: activeRuleProfile.id,
      label: `사내급여기준 v${activeRuleProfile.version}`,
      effectiveFrom: activeRuleProfile.effectiveFrom,
      effectiveTo: activeRuleProfile.effectiveTo,
      approvedAt: activeRuleProfile.approvedAt,
      sourceTypeLabels: activeSourceTypeLabels,
    }
  }

  const latestDraftProfile = allRuleProfiles
    .filter((profile) => profile.status === 'draft')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const latestDraftProfileJson = latestDraftProfile ? readProfileJson(latestDraftProfile) : null
  const latestDraftSources = latestDraftProfile
    ? ruleProfileSources.filter((source) => source.profileId === latestDraftProfile.id)
    : []
  const latestDraftReviewRows: PayrollRuleDraftReviewRow[] = latestDraftProfileJson
    ? [...latestDraftProfileJson.allowanceRules, ...latestDraftProfileJson.deductionRules].map((rule) => ({
      sourceRuleId: rule.sourceRuleId,
      displayName: rule.displayName,
      category: rule.category,
      targetField: rule.targetField,
      taxableTreatment: rule.taxableTreatment,
      formulaKind: rule.formulaKind,
      formulaSummary: formatRuleFormulaSummary(rule.formulaJson),
      basisType: rule.formulaJson.basisType ?? null,
      lawBasisLabels: formatRuleLawBasisLabels(rule.formulaJson),
      calculationLabels: formatRuleCalculationLabels(rule.formulaJson),
      requiredInputs: rule.requiredInputs,
      source: rule.sourceCitations.map((citation) => citation.reference).join(', '),
      status: rule.status,
    }))
    : []

  const payrollRuleProfileView: PayrollRuleProfileView = {
    total: allRuleProfiles.length,
    defaultEffectiveFrom: currentMonth,
    active: activeRuleProfileView,
    draftCount: allRuleProfiles.filter((profile) => profile.status === 'draft').length,
    conflictCount: ruleProfileConflictCount,
    teePending: ruleProfileTeePending,
    latestDraft: latestDraftProfile && latestDraftProfileJson && latestDraftReviewRows.length > 0
      ? {
        profileId: latestDraftProfile.id,
        label: `사내급여기준 초안 v${latestDraftProfile.version}`,
        createdAt: latestDraftProfile.createdAt,
        effectiveFrom: latestDraftProfile.effectiveFrom,
        effectiveTo: latestDraftProfile.effectiveTo,
        needsReviewCount: countNeedsReviewRows(latestDraftProfileJson),
        conflictRowCount: countApprovalBlockingConflicts(latestDraftProfileJson),
        teeBlocked: latestDraftSources.some((source) => source.securityLane === 'tee_required'),
        activeProfilePeriod: activeRuleProfile
          ? {
            effectiveFrom: activeRuleProfile.effectiveFrom,
            effectiveTo: activeRuleProfile.effectiveTo,
          }
          : null,
        rows: latestDraftReviewRows,
      }
      : null,
    clientSubmittedRuleDocuments: documents
      .filter((doc) => isPayrollRuleDocumentType(doc.documentType))
      .map((doc) => {
        const submittedBy = doc.memo === PAYROLL_RULE_CLIENT_SUBMIT_MEMO ? 'client' : 'staff'
        return {
          id: doc.id,
          originalFilename: doc.originalFilename,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt,
          submittedBy,
          uploadedByStaffName: submittedBy === 'staff' ? doc.uploadedByStaffName : null,
          // 엑셀 규정 파일은 excel_embedded, 그 외(txt/pdf/doc)는 rule_document로
          // 도출해 draft API에 전달한다. 형식과 요청 유형이 맞아야 변환이 성공한다.
          sourceType: resolvePayrollRuleSourceTypeFromContentType(doc.contentType) === 'excel_embedded'
            ? ('excel_embedded' as const)
            : ('rule_document' as const),
        }
      }),
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <Suspense fallback={null}>
        <ToastHandler />
      </Suspense>

      <ClientDetailHeader
        clientId={currentClient.id}
        clientName={currentClient.name}
        contactName={currentClient.contactName}
        staffName={currentClient.staffName}
      />

      <ClientDetailTabs
        clientId={currentClient.id}
        events={events}
        sessions={sessions}
        reviewStatusBySessionId={Object.fromEntries(reviewStatusBySessionId)}
        payrollStatusBySessionId={Object.fromEntries(payrollStatusBySessionId)}
        ccGroups={ccGroups}
        documents={documents}
        payrollRuleProfile={payrollRuleProfileView}
        initialTab={
          typeof resolvedSearchParams?.tab === 'string' ? resolvedSearchParams.tab : undefined
        }
      />

      {!BOOKKEEPING_FISCAL_YEAR_PANEL_HIDDEN_V1 && fiscalLedgerSummary ? (
        <BookkeepingFiscalYearPanel
          clientId={currentClient.id}
          summary={fiscalLedgerSummary}
        />
      ) : null}
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PayrollRuleSourceType } from '@/lib/validations/payroll-rule-profile'
import { ClientSubmittedRuleDocs } from './client-submitted-rule-docs'
import { FileRuleDraftForm } from './file-rule-draft-form'
import { NlRuleDraftForm } from './nl-rule-draft-form'
import { PayrollRuleProfileApprovalPanel } from './payroll-rule-profile-approval-panel'
import { PayrollRuleProfileRetirePanel } from './payroll-rule-profile-retire-panel'

export type PayrollRuleProfileView = {
  total: number
  defaultEffectiveFrom: string
  active: {
    profileId: string
    label: string
    effectiveFrom: string
    effectiveTo: string | null
    approvedAt: string | null
    sourceTypeLabels: string[]
  } | null
  draftCount: number
  conflictCount: number
  teePending: boolean
  latestDraft: {
    profileId: string
    label: string
    createdAt: string
    effectiveFrom: string
    effectiveTo: string | null
    needsReviewCount: number
    conflictRowCount: number
    teeBlocked: boolean
    activeProfilePeriod: {
      effectiveFrom: string
      effectiveTo: string | null
    } | null
    rows: PayrollRuleDraftReviewRow[]
  } | null
  /** 사업장 또는 담당자가 올린 사내규정 자료(아직 초안 미생성 가능). */
  clientSubmittedRuleDocuments: ClientSubmittedRuleDocument[]
}

export type ClientSubmittedRuleDocument = {
  id: string
  originalFilename: string
  fileSize: number
  createdAt: string
  submittedBy: 'client' | 'staff'
  uploadedByStaffName: string | null
  /** 파일 형식에서 도출한 draft 입력 유형. 엑셀=excel_embedded, 그 외=rule_document. */
  sourceType: 'rule_document' | 'excel_embedded'
}

export type PayrollRuleDraftReviewRow = {
  sourceRuleId: string
  displayName: string
  category: string
  targetField: string
  taxableTreatment: string
  formulaKind: string
  formulaSummary: string | null
  basisType: string | null
  lawBasisLabels: string[]
  calculationLabels: string[]
  requiredInputs: string[]
  source: string
  status: 'ready' | 'needs_review' | 'conflict' | 'excluded'
}

export const PAYROLL_RULE_SOURCE_TYPE_LABEL: Record<PayrollRuleSourceType, string> = {
  natural_language: '자연어 설명',
  mapping_table: '수당 매핑표',
  rule_document: '사내 규칙 문서',
  excel_embedded: '엑셀 내장 규칙',
  statutory_default: '법정 기본',
}

const categoryLabels: Record<string, string> = {
  allowance: '수당',
  deduction: '공제',
  tax: '세금',
  insurance: '보험',
  other: '기타',
}

const taxableLabels: Record<string, string> = {
  taxable: '과세',
  non_taxable: '비과세',
  partially_non_taxable: '일부비과세',
  unknown: '미정',
}

const formulaLabels: Record<string, string> = {
  fixed_amount: '고정금액',
  unit_rate: '단가x수량',
  rate: '요율',
  hours_multiplier: '시간배수',
  table_lookup: '표조회',
  manual_input: '수기입력',
  not_applicable: '해당없음',
}

const basisTypeLabels: Record<string, string> = {
  company_rule: '사내규정',
  statutory_default: '법정기준',
  source_amount: '월별 원자료',
  tax_treatment: '세무처리',
  unknown: '미정',
}

const statusLabels: Record<PayrollRuleDraftReviewRow['status'], string> = {
  ready: '준비됨',
  needs_review: '검토필요',
  conflict: '충돌',
  excluded: '제외',
}

/**
 * 사내급여기준 프로필 패널 (읽기/상태 전용).
 *
 * 승인된 기준과 초안/충돌 상태를 보여준다. 사내규칙 입력은 담당자가 CSV를
 * 작성하는 방식이 아니라, 자연어/파일을 AI가 구조화하는 방식으로 다음 단계에서
 * 제공된다(방향 정정 2026-06-28). 초안은 승인 전에는 적용되지 않음을 명확히
 * 표시한다(초록 badge로 위장 금지).
 */
export function ClientPayrollRuleProfilePanel({
  clientId,
  view,
}: {
  clientId: string
  view: PayrollRuleProfileView
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-semibold text-gray-950">사내급여기준 프로필</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          사업장 사내 급여 규칙을 승인된 기준으로 만들어 월 급여정산에 적용합니다. AI 초안은 담당자 승인 전에는 급여 계산에 적용되지 않습니다.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {view.active ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">승인된 기준</Badge>
              <span className="font-medium text-gray-950">{view.active.label}</span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-gray-500">유효기간</dt>
                <dd className="font-medium text-gray-900">
                  {view.active.effectiveFrom} ~ {view.active.effectiveTo ?? '무제한'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-gray-500">승인일</dt>
                <dd className="font-medium text-gray-900">{view.active.approvedAt ?? '-'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2 sm:block">
                <dt className="text-gray-500">출처</dt>
                <dd className="font-medium text-gray-900">
                  {view.active.sourceTypeLabels.length > 0 ? view.active.sourceTypeLabels.join(', ') : '-'}
                </dd>
              </div>
            </dl>
            <PayrollRuleProfileRetirePanel clientId={clientId} profileId={view.active.profileId} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            승인된 사내급여기준 프로필이 없습니다. 아래에서 급여 규칙을 자연어로 설명하거나 파일을 업로드하면 AI가 초안을 만듭니다.
            <p className="mt-1 text-xs text-gray-400">
              현재 급여정산은 기본 법정 기준 + 자료 기반 계산으로 처리됩니다.
            </p>
          </div>
        )}

        {(view.draftCount > 0 || view.conflictCount > 0 || view.teePending) && (
          <div className="flex flex-wrap items-center gap-2">
            {view.draftCount > 0 && (
              <Badge variant="warning">초안 {view.draftCount}건 · 아직 적용되지 않음</Badge>
            )}
            {view.conflictCount > 0 && (
              <Badge variant="warning">충돌 {view.conflictCount}건 · 검토필요</Badge>
            )}
            {view.teePending && (
              <Badge variant="secondary">민감정보 보안 처리 경로 확인 필요</Badge>
            )}
          </div>
        )}

        <ClientSubmittedRuleDocs
          clientId={clientId}
          documents={view.clientSubmittedRuleDocuments}
          defaultEffectiveFrom={view.defaultEffectiveFrom}
        />

        <NlRuleDraftForm clientId={clientId} defaultEffectiveFrom={view.defaultEffectiveFrom} />
        <FileRuleDraftForm clientId={clientId} defaultEffectiveFrom={view.defaultEffectiveFrom} />

        {view.latestDraft && (
          <>
            <LatestDraftTable draft={view.latestDraft} />
            <PayrollRuleProfileApprovalPanel
              clientId={clientId}
              profileId={view.latestDraft.profileId}
              defaultEffectiveFrom={view.latestDraft.effectiveFrom}
              defaultEffectiveTo={view.latestDraft.effectiveTo}
              needsReviewCount={view.latestDraft.needsReviewCount}
              conflictRowCount={view.latestDraft.conflictRowCount}
              teeBlocked={view.latestDraft.teeBlocked}
              activeProfilePeriod={view.latestDraft.activeProfilePeriod}
            />
          </>
        )}
      </div>
    </section>
  )
}

function LatestDraftTable({ draft }: { draft: NonNullable<PayrollRuleProfileView['latestDraft']> }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">최근 프로필 초안</h3>
          <p className="text-xs text-gray-500">
            {draft.label} · {draft.createdAt}
          </p>
        </div>
        <Badge variant="warning">승인 전 미적용</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>항목명</TableHead>
            <TableHead>분류</TableHead>
            <TableHead>출력 필드</TableHead>
            <TableHead>과세</TableHead>
            <TableHead>계산 기준</TableHead>
            <TableHead>필요 입력</TableHead>
            <TableHead>출처</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draft.rows.map((row) => (
            <TableRow key={row.sourceRuleId}>
              <TableCell className="font-medium text-gray-900">{row.displayName}</TableCell>
              <TableCell>{categoryLabels[row.category] ?? row.category}</TableCell>
              <TableCell className="font-mono text-xs">{row.targetField}</TableCell>
              <TableCell>{taxableLabels[row.taxableTreatment] ?? row.taxableTreatment}</TableCell>
              <TableCell className="min-w-64">
                <div className="font-medium text-gray-900">
                  {formulaLabels[row.formulaKind] ?? row.formulaKind}
                </div>
                {row.formulaSummary && (
                  <p className="mt-1 text-xs text-gray-600">{row.formulaSummary}</p>
                )}
                {row.basisType && (
                  <p className="mt-1 text-xs text-gray-500">
                    근거: {basisTypeLabels[row.basisType] ?? row.basisType}
                  </p>
                )}
                {row.lawBasisLabels.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    법령: {row.lawBasisLabels.join(', ')}
                  </p>
                )}
                {row.calculationLabels.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    계산: {row.calculationLabels.join(' · ')}
                  </p>
                )}
              </TableCell>
              <TableCell>{row.requiredInputs.length > 0 ? row.requiredInputs.join(', ') : '-'}</TableCell>
              <TableCell>{row.source || '-'}</TableCell>
              <TableCell>
                <Badge variant={row.status === 'ready' ? 'success' : 'warning'}>
                  {statusLabels[row.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

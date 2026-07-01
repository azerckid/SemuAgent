'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, RefreshCw, Check, X, FileSpreadsheet, Pencil, ReceiptText } from 'lucide-react'
import { formatDateTimeLong } from '@/lib/client-format'
import type {
  PayrollResultExcelDownloadState,
} from '@/lib/sessions/payroll-source-download'
import {
  buildWageStatementDraft,
  type WageStatementAmountItem,
  type WageStatementBasisItem,
  type WageStatementDraft,
} from '@/lib/payroll/wage-statement-draft'
import type { PayrollExtractedRow } from '@/lib/validations/payroll'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayrollBatch {
  id: string
  status: string
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface PayrollRow {
  id: string
  payrollPeriod: string
  employeeCode: string | null
  employeeName: string | null
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalary: number | null
  bonus: number | null
  mealAllowance: number | null
  transportationAllowance: number | null
  holidayWorkAllowance: number | null
  domesticTravelAllowance: number | null
  annualLeaveAllowance: number | null
  rndAllowance: number | null
  otherAllowance: number | null
  performanceIncentive: number | null
  nightWorkAllowance: number | null
  vehicleMaintenanceAllowance: number | null
  retroactivePay: number | null
  overtimeAllowance: number | null
  childcareAllowance: number | null
  nationalPension?: number | null
  healthInsurance?: number | null
  longTermCare?: number | null
  employmentInsurance?: number | null
  incomeTax?: number | null
  localIncomeTax?: number | null
  otherDeduction?: number | null
  deductionAmount: number | null
  memo: string | null
  confidence: string
  aiVerdict: string | null
  aiVerdictReason: string | null
  reviewStatus: string
  sourceReference: string | null
}

export interface PayrollDraft {
  id: string
  status: string
  filename: string
  passRowCount: number
  excludedRowCount: number
  generatedAt: string
}

interface Props {
  sessionId: string
  clientName: string
  batch: PayrollBatch | null
  rows: PayrollRow[]
  drafts: PayrollDraft[]
  resultDownloadState: PayrollResultExcelDownloadState
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_CONFIG: Record<string, { label: string; style: string }> = {
  high:    { label: '고', style: 'text-green-600' },
  medium:  { label: '중', style: 'text-yellow-600' },
  low:     { label: '저', style: 'text-red-600' },
  unknown: { label: '-',  style: 'text-gray-400' },
}

type PayrollOutputAmountKey =
  | 'baseSalary'
  | 'bonus'
  | 'mealAllowance'
  | 'transportationAllowance'
  | 'holidayWorkAllowance'
  | 'domesticTravelAllowance'
  | 'annualLeaveAllowance'
  | 'rndAllowance'
  | 'otherAllowance'
  | 'performanceIncentive'
  | 'nightWorkAllowance'
  | 'vehicleMaintenanceAllowance'
  | 'retroactivePay'
  | 'overtimeAllowance'
  | 'childcareAllowance'

type PayrollDeductionAmountKey =
  | 'nationalPension'
  | 'healthInsurance'
  | 'longTermCare'
  | 'employmentInsurance'
  | 'incomeTax'
  | 'localIncomeTax'
  | 'otherDeduction'

const OUTPUT_AMOUNT_FIELDS: { key: PayrollOutputAmountKey; label: string }[] = [
  { key: 'baseSalary',              label: '기본급' },
  { key: 'bonus',                   label: '상여' },
  { key: 'mealAllowance',           label: '식대' },
  { key: 'transportationAllowance', label: '교통비' },
  { key: 'holidayWorkAllowance',    label: '휴일근무' },
  { key: 'domesticTravelAllowance', label: '국내출장' },
  { key: 'annualLeaveAllowance',    label: '연차수당' },
  { key: 'rndAllowance',            label: '연구개발비' },
  { key: 'otherAllowance',          label: '기타수당' },
  { key: 'performanceIncentive',    label: '성과인센티브' },
  { key: 'nightWorkAllowance',      label: '심야근무' },
  { key: 'vehicleMaintenanceAllowance', label: '차량유지비' },
  { key: 'retroactivePay',          label: '소급적용' },
  { key: 'overtimeAllowance',       label: '연장근무' },
  { key: 'childcareAllowance',      label: '보육수당' },
]

const DEDUCTION_AMOUNT_FIELDS: { key: PayrollDeductionAmountKey; label: string }[] = [
  { key: 'nationalPension',     label: '국민연금' },
  { key: 'healthInsurance',     label: '건강보험' },
  { key: 'longTermCare',        label: '장기요양' },
  { key: 'employmentInsurance', label: '고용보험' },
  { key: 'incomeTax',           label: '소득세' },
  { key: 'localIncomeTax',      label: '지방소득세' },
  { key: 'otherDeduction',      label: '기타공제' },
]

const NUM_FIELDS: { key: PayrollOutputAmountKey | 'deductionAmount'; label: string }[] = [
  ...OUTPUT_AMOUNT_FIELDS,
  { key: 'deductionAmount',         label: '공제' },
]


function fmtAmount(v: number | null): string {
  if (v === null) return '-'
  return v.toLocaleString('ko-KR')
}

function getRowDisplayAmount(row: PayrollRow, key: PayrollOutputAmountKey | PayrollDeductionAmountKey): number | null {
  if (key in row && typeof row[key as keyof PayrollRow] === 'number') {
    return row[key as keyof PayrollRow] as number
  }
  const deductionComponents = readDeductionComponents(row.sourceReference)
  const value = deductionComponents[key as PayrollDeductionAmountKey]
  return typeof value === 'number' ? value : null
}

function fmtDraftAmount(v: number | null): string {
  if (v === null) return '자료없음'
  return `${v.toLocaleString('ko-KR')}원`
}

function fmtDraftValue(v: string | number | null): string {
  if (v === null) return '자료없음'
  return typeof v === 'number' ? v.toLocaleString('ko-KR') : v
}

function getDraftStatusStyle(status: WageStatementAmountItem['status']): string {
  return status === 'calculated'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-gray-200 bg-gray-50 text-gray-500'
}

function getConfidence(value: string): PayrollExtractedRow['confidence'] {
  return value === 'high' || value === 'medium' || value === 'low' || value === 'unknown'
    ? value
    : 'unknown'
}

function readDeductionComponents(sourceReference: string | null): Partial<Pick<
  PayrollExtractedRow,
  'nationalPension' | 'healthInsurance' | 'longTermCare' | 'employmentInsurance' | 'incomeTax' | 'localIncomeTax' | 'otherDeduction'
>> {
  if (!sourceReference) return {}
  try {
    const parsed = JSON.parse(sourceReference) as { deductionComponents?: Record<string, unknown> }
    const components = parsed.deductionComponents
    if (!components || typeof components !== 'object') return {}
    return {
      nationalPension: typeof components.nationalPension === 'number' ? components.nationalPension : null,
      healthInsurance: typeof components.healthInsurance === 'number' ? components.healthInsurance : null,
      longTermCare: typeof components.longTermCare === 'number' ? components.longTermCare : null,
      employmentInsurance: typeof components.employmentInsurance === 'number' ? components.employmentInsurance : null,
      incomeTax: typeof components.incomeTax === 'number' ? components.incomeTax : null,
      localIncomeTax: typeof components.localIncomeTax === 'number' ? components.localIncomeTax : null,
      otherDeduction: typeof components.otherDeduction === 'number' ? components.otherDeduction : null,
    }
  } catch {
    return {}
  }
}

function toExtractedRow(row: PayrollRow): PayrollExtractedRow {
  const storedDeductionComponents = readDeductionComponents(row.sourceReference)
  const deductionComponents = {
    ...storedDeductionComponents,
    nationalPension: row.nationalPension ?? storedDeductionComponents.nationalPension ?? null,
    healthInsurance: row.healthInsurance ?? storedDeductionComponents.healthInsurance ?? null,
    longTermCare: row.longTermCare ?? storedDeductionComponents.longTermCare ?? null,
    employmentInsurance: row.employmentInsurance ?? storedDeductionComponents.employmentInsurance ?? null,
    incomeTax: row.incomeTax ?? storedDeductionComponents.incomeTax ?? null,
    localIncomeTax: row.localIncomeTax ?? storedDeductionComponents.localIncomeTax ?? null,
    otherDeduction: row.otherDeduction ?? storedDeductionComponents.otherDeduction ?? null,
  }
  return {
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    department: row.department,
    jobTitle: row.jobTitle,
    jobType: row.jobType,
    baseSalary: row.baseSalary,
    bonus: row.bonus,
    mealAllowance: row.mealAllowance,
    transportationAllowance: row.transportationAllowance,
    holidayWorkAllowance: row.holidayWorkAllowance,
    domesticTravelAllowance: row.domesticTravelAllowance,
    annualLeaveAllowance: row.annualLeaveAllowance,
    rndAllowance: row.rndAllowance,
    otherAllowance: row.otherAllowance,
    performanceIncentive: row.performanceIncentive,
    nightWorkAllowance: row.nightWorkAllowance,
    vehicleMaintenanceAllowance: row.vehicleMaintenanceAllowance,
    retroactivePay: row.retroactivePay,
    overtimeAllowance: row.overtimeAllowance,
    childcareAllowance: row.childcareAllowance,
    nationalPension: deductionComponents.nationalPension,
    healthInsurance: deductionComponents.healthInsurance,
    longTermCare: deductionComponents.longTermCare,
    employmentInsurance: deductionComponents.employmentInsurance,
    incomeTax: deductionComponents.incomeTax,
    localIncomeTax: deductionComponents.localIncomeTax,
    otherDeduction: deductionComponents.otherDeduction,
    deductionAmount: row.deductionAmount,
    memo: row.memo,
    confidence: getConfidence(row.confidence),
    aiVerdict: row.aiVerdict === 'pass' || row.aiVerdict === 'fail' ? row.aiVerdict : undefined,
    aiVerdictReason: row.aiVerdictReason,
    sourceReference: row.sourceReference ? { raw: row.sourceReference } : null,
  }
}

function WageStatementLineItem({ item }: { item: WageStatementAmountItem }) {
  return (
    <div className="rounded-md border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.label}</p>
          <p className="mt-1 text-xs leading-snug text-gray-500">{item.formula}</p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${getDraftStatusStyle(item.status)}`}>
          {fmtDraftAmount(item.amount)}
        </span>
      </div>
    </div>
  )
}

function WageStatementBasisLine({ item }: { item: WageStatementBasisItem }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{item.label}</p>
        <p className="truncate text-[11px] text-gray-400">{item.description}</p>
      </div>
      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${getDraftStatusStyle(item.status)}`}>
        {fmtDraftValue(item.value)}
      </span>
    </div>
  )
}

function WageStatementPreviewModal({
  draft,
  onClose,
}: {
  draft: WageStatementDraft
  onClose: () => void
}) {
  const visibleMissingItems = draft.missingItems.slice(0, 10)
  const remainingMissingCount = draft.missingItems.length - visibleMissingItems.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-indigo-100 bg-white p-5 shadow-xl">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-indigo-600" />
              <p className="text-base font-semibold text-gray-900">임금명세서 초안</p>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                내부 검토
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {draft.employee.name ?? '이름 없음'} · {draft.employee.code ?? '사번 없음'} · {draft.payrollPeriod}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            닫기
          </button>
        </div>

        <div className="mb-4 flex justify-end">
          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
            자료없음 {draft.missingItems.length}개
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">총지급액</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{fmtDraftAmount(draft.summary.grossPay)}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">공제 합계</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{fmtDraftAmount(draft.summary.deductionTotal)}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">실지급액</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{fmtDraftAmount(draft.summary.netPay)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-gray-100 bg-white p-3">
            <p className="mb-2 text-sm font-medium text-gray-900">근로/계산 기준</p>
            {draft.workBasisItems.map((item) => (
              <WageStatementBasisLine key={item.key} item={item} />
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">지급 항목</p>
              <div className="grid gap-2 md:grid-cols-2">
                {draft.earningItems.map((item) => (
                  <WageStatementLineItem key={item.key} item={item} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">공제 항목</p>
              <div className="grid gap-2">
                {draft.deductionItems.map((item) => (
                  <WageStatementLineItem key={item.key} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {draft.missingItems.length > 0 && (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-600">자료없음 항목</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {visibleMissingItems.join(', ')}
              {remainingMissingCount > 0 ? ` 외 ${remainingMissingCount}개` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row Edit Form (inline)
// ---------------------------------------------------------------------------

type EditState = Partial<{
  employeeCode: string
  employeeName: string
  department: string
  jobTitle: string
  jobType: string
  baseSalary: string
  bonus: string
  mealAllowance: string
  transportationAllowance: string
  holidayWorkAllowance: string
  domesticTravelAllowance: string
  annualLeaveAllowance: string
  rndAllowance: string
  otherAllowance: string
  performanceIncentive: string
  nightWorkAllowance: string
  vehicleMaintenanceAllowance: string
  retroactivePay: string
  overtimeAllowance: string
  childcareAllowance: string
  deductionAmount: string
  memo: string
}>

function rowToEditState(row: PayrollRow): EditState {
  return {
    employeeCode:             row.employeeCode ?? '',
    employeeName:             row.employeeName ?? '',
    department:               row.department ?? '',
    jobTitle:                 row.jobTitle ?? '',
    jobType:                  row.jobType ?? '',
    baseSalary:               row.baseSalary?.toString() ?? '',
    bonus:                    row.bonus?.toString() ?? '',
    mealAllowance:            row.mealAllowance?.toString() ?? '',
    transportationAllowance:  row.transportationAllowance?.toString() ?? '',
    holidayWorkAllowance:     row.holidayWorkAllowance?.toString() ?? '',
    domesticTravelAllowance:  row.domesticTravelAllowance?.toString() ?? '',
    annualLeaveAllowance:     row.annualLeaveAllowance?.toString() ?? '',
    rndAllowance:             row.rndAllowance?.toString() ?? '',
    otherAllowance:           row.otherAllowance?.toString() ?? '',
    performanceIncentive:     row.performanceIncentive?.toString() ?? '',
    nightWorkAllowance:       row.nightWorkAllowance?.toString() ?? '',
    vehicleMaintenanceAllowance: row.vehicleMaintenanceAllowance?.toString() ?? '',
    retroactivePay:           row.retroactivePay?.toString() ?? '',
    overtimeAllowance:        row.overtimeAllowance?.toString() ?? '',
    childcareAllowance:       row.childcareAllowance?.toString() ?? '',
    deductionAmount:          row.deductionAmount?.toString() ?? '',
    memo:                     row.memo ?? '',
  }
}

function validateNumericFields(s: EditState): string | null {
  for (const { key, label } of NUM_FIELDS) {
    const val = (s as Record<string, string>)[key as string]
    if (val && val.trim() !== '') {
      const n = Number(val.replace(/,/g, ''))
      if (isNaN(n)) return `"${label}" 값이 유효한 숫자가 아닙니다: "${val}"`
    }
  }
  return null
}

function editStateToPayload(s: EditState) {
  const parseNum = (v: string | undefined) => {
    if (!v || v.trim() === '') return null
    const n = Number(v.replace(/,/g, ''))
    return isNaN(n) ? null : Math.round(n)
  }
  return {
    employeeCode:             s.employeeCode?.trim() || null,
    employeeName:             s.employeeName?.trim() || null,
    department:               s.department?.trim() || null,
    jobTitle:                 s.jobTitle?.trim() || null,
    jobType:                  s.jobType?.trim() || null,
    baseSalary:               parseNum(s.baseSalary),
    bonus:                    parseNum(s.bonus),
    mealAllowance:            parseNum(s.mealAllowance),
    transportationAllowance:  parseNum(s.transportationAllowance),
    holidayWorkAllowance:     parseNum(s.holidayWorkAllowance),
    domesticTravelAllowance:  parseNum(s.domesticTravelAllowance),
    annualLeaveAllowance:     parseNum(s.annualLeaveAllowance),
    rndAllowance:             parseNum(s.rndAllowance),
    otherAllowance:           parseNum(s.otherAllowance),
    performanceIncentive:     parseNum(s.performanceIncentive),
    nightWorkAllowance:       parseNum(s.nightWorkAllowance),
    vehicleMaintenanceAllowance: parseNum(s.vehicleMaintenanceAllowance),
    retroactivePay:           parseNum(s.retroactivePay),
    overtimeAllowance:        parseNum(s.overtimeAllowance),
    childcareAllowance:       parseNum(s.childcareAllowance),
    deductionAmount:          parseNum(s.deductionAmount),
    memo:                     s.memo?.trim() || null,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayrollSection({
  sessionId,
  clientName,
  batch,
  rows,
  drafts,
  resultDownloadState,
}: Props) {
  const router = useRouter()
  const [isPendingExtract, startExtract] = useTransition()
  const [isPendingDraft, startDraft] = useTransition()
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [selectedWageStatementRowId, setSelectedWageStatementRowId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({})
  const latestDraft = useMemo(() => (
    drafts.reduce<PayrollDraft | null>((latest, draft) => {
      if (!latest) return draft
      return draft.generatedAt.localeCompare(latest.generatedAt) > 0 ? draft : latest
    }, null)
  ), [drafts])

  const aiPassCount = rows.filter((r) => (r.aiVerdict ?? 'fail') === 'pass').length
  const aiFailCount = rows.length - aiPassCount
  const canGenerateDraft = aiPassCount > 0 && aiFailCount === 0
  const selectedWageStatementRow = selectedWageStatementRowId
    ? rows.find((row) => row.id === selectedWageStatementRowId) ?? null
    : null
  const selectedWageStatementDraft = useMemo(() => {
    if (!selectedWageStatementRow) return null
    return buildWageStatementDraft({
      row: toExtractedRow(selectedWageStatementRow),
      payrollPeriod: selectedWageStatementRow.payrollPeriod,
      companyName: clientName,
    })
  }, [clientName, selectedWageStatementRow])

  async function handleExtract() {
    startExtract(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/payroll/extract`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? '추출 실패')
          return
        }
        toast.success(`${data.rowCount}명 추출 완료`)
        router.refresh()
      } catch {
        toast.error('네트워크 오류')
      }
    })
  }

  async function patchRow(rowId: string, payload: Record<string, unknown>): Promise<boolean> {
    setPendingRowId(rowId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/payroll/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '저장 실패')
        return false
      }
      router.refresh()
      return true
    } catch {
      toast.error('네트워크 오류')
      return false
    } finally {
      setPendingRowId(null)
    }
  }

  function startEdit(row: PayrollRow) {
    setEditingRowId(row.id)
    setEditState(rowToEditState(row))
  }

  async function saveEdit(rowId: string) {
    const validationError = validateNumericFields(editState)
    if (validationError) {
      toast.error(validationError)
      return
    }
    const ok = await patchRow(rowId, editStateToPayload(editState))
    if (ok) setEditingRowId(null)
  }

  async function handleGenerateDraft() {
    startDraft(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/payroll/drafts`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? '엑셀 작성 실패')
          return
        }
        toast.success('결과 엑셀표가 작성되었습니다')
        router.refresh()
      } catch {
        toast.error('네트워크 오류')
      }
    })
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          결과 엑셀표 작성
        </h2>
        <button
          onClick={handleExtract}
          disabled={isPendingExtract}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isPendingExtract ? 'animate-spin' : ''}`} />
          {batch ? '재추출' : '급여 정보 추출'}
        </button>
      </div>

      {/* 직원별 추출 결과 */}
      {rows.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              총 {rows.length}명 · 적합 {aiPassCount}명 · 부적합 {aiFailCount}명
              {aiFailCount > 0 && (
                <span className="ml-2 text-red-600">— 부적합 row가 있으면 엑셀 작성 불가</span>
              )}
            </p>
            <button
              onClick={handleGenerateDraft}
              disabled={isPendingDraft || !canGenerateDraft}
              title={aiFailCount > 0 ? '부적합 row가 있어 출력 엑셀을 생성할 수 없습니다' : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {isPendingDraft ? '작성 중…' : `엑셀 초안 작성 (${aiPassCount}명)`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    '사원코드',
                    '사원명',
                    '부서',
                    '직급',
                    '직종',
                    ...OUTPUT_AMOUNT_FIELDS.map((field) => field.label),
                    ...DEDUCTION_AMOUNT_FIELDS.map((field) => field.label),
                    '공제합계',
                    '신뢰도',
                    '액션',
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const conf = CONFIDENCE_CONFIG[row.confidence] ?? CONFIDENCE_CONFIG.unknown
                  const isEditing = editingRowId === row.id
                  const isPendingThis = pendingRowId === row.id

                  return (
                    <Fragment key={row.id}>
                      {/* 요약 행 */}
                      <tr className={row.aiVerdict === 'fail' ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 text-gray-500">
                          {isEditing ? (
                            <input className="w-20 rounded border px-1 py-0.5" value={editState.employeeCode ?? ''} onChange={(e) => setEditState((s) => ({ ...s, employeeCode: e.target.value }))} />
                          ) : (row.employeeCode ?? '-')}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {isEditing ? (
                            <input className="w-24 rounded border px-1 py-0.5" value={editState.employeeName ?? ''} onChange={(e) => setEditState((s) => ({ ...s, employeeName: e.target.value }))} />
                          ) : (row.employeeName ?? '-')}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {isEditing ? (
                            <input className="w-20 rounded border px-1 py-0.5" value={editState.department ?? ''} onChange={(e) => setEditState((s) => ({ ...s, department: e.target.value }))} />
                          ) : (row.department ?? '-')}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {isEditing ? (
                            <input className="w-16 rounded border px-1 py-0.5" value={editState.jobTitle ?? ''} onChange={(e) => setEditState((s) => ({ ...s, jobTitle: e.target.value }))} />
                          ) : (row.jobTitle ?? '-')}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {isEditing ? (
                            <input className="w-16 rounded border px-1 py-0.5" value={editState.jobType ?? ''} onChange={(e) => setEditState((s) => ({ ...s, jobType: e.target.value }))} />
                          ) : (row.jobType ?? '-')}
                        </td>
                        {OUTPUT_AMOUNT_FIELDS.map(({ key }) => (
                          <td key={key} className="px-3 py-2 text-right tabular-nums">
                            {isEditing ? (
                              <input
                                className="w-24 rounded border px-1 py-0.5 text-right"
                                value={(editState as Record<string, string>)[key] ?? ''}
                                onChange={(e) => setEditState((s) => ({ ...s, [key]: e.target.value }))}
                              />
                            ) : fmtAmount(row[key])}
                          </td>
                        ))}
                        {DEDUCTION_AMOUNT_FIELDS.map(({ key }) => (
                          <td key={key} className="px-3 py-2 text-right tabular-nums">
                            {fmtAmount(getRowDisplayAmount(row, key))}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtAmount(row.deductionAmount)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${conf.style}`}>{conf.label}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(row.id)} disabled={isPendingThis} className="rounded p-1 text-blue-600 hover:bg-blue-50" title="저장">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setEditingRowId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="취소">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setSelectedWageStatementRowId(row.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                                  title="임금명세서 초안 보기"
                                >
                                  <ReceiptText className="h-3.5 w-3.5" />
                                  명세서
                                </button>
                                <button onClick={() => startEdit(row)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="수정">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {row.aiVerdict === 'fail' && (
                                  <button
                                    onClick={() => patchRow(row.id, { aiVerdict: 'pass', aiVerdictReason: null })}
                                    disabled={isPendingThis}
                                    className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-40"
                                    title="적합 처리"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 수정 모드 — 잔여 수당 컬럼 확장 행 */}
                      {isEditing && (
                        <tr className="bg-blue-50">
                          <td colSpan={30} className="px-4 py-3">
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <label className="flex flex-col gap-0.5">
                                <span className="text-gray-500">공제</span>
                                <input
                                  className="rounded border px-2 py-1 text-right"
                                  value={editState.deductionAmount ?? ''}
                                  onChange={(e) => setEditState((s) => ({ ...s, deductionAmount: e.target.value }))}
                                />
                              </label>
                              <label className="flex flex-col gap-0.5 col-span-2">
                                <span className="text-gray-500">메모</span>
                                <input
                                  className="rounded border px-2 py-1"
                                  value={editState.memo ?? ''}
                                  onChange={(e) => setEditState((s) => ({ ...s, memo: e.target.value }))}
                                />
                              </label>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedWageStatementDraft && (
        <WageStatementPreviewModal
          draft={selectedWageStatementDraft}
          onClose={() => setSelectedWageStatementRowId(null)}
        />
      )}

      {/* 최신 엑셀 초안 */}
      {latestDraft && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">작성된 결과 엑셀표</p>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{latestDraft.filename}</p>
              <p className="text-xs text-gray-500">
                적합 {latestDraft.passRowCount}명 · 부적합 {latestDraft.excludedRowCount}명 ·{' '}
                {formatDateTimeLong(latestDraft.generatedAt)}
              </p>
            </div>
            {latestDraft.status === 'generated' && resultDownloadState.enabled && (
              <a
                href={`/api/sessions/${sessionId}/payroll/drafts/${latestDraft.id}/download`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                결과 엑셀 다운로드
              </a>
            )}
            {latestDraft.status === 'generated' && !resultDownloadState.enabled && (
              <button
                type="button"
                disabled
                title={resultDownloadState.detail}
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400"
              >
                <Download className="h-4 w-4" />
                결과 엑셀 다운로드
              </button>
            )}
          </div>
        </div>
      )}

      {!batch && rows.length === 0 && (
        <p className="text-sm text-gray-500">업로드된 급여 자료가 있으면 추출 버튼으로 시작하세요.</p>
      )}
    </section>
  )
}

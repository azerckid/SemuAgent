'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDateTimeSlash, formatDateKorean, formatDateTimeISO } from '@/lib/client-format'
import { providerPriority } from '@/lib/ai/provider-order'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import {
  CompletionApprovalPanel,
  type CompletionAcceptedFile,
} from '@/app/(dashboard)/dashboard/_components/completion-approval-panel'
import { computeCompletionEligibility } from '@/lib/sessions/completion-eligibility'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface UploadFile {
  id: string
  originalFilename: string
  fileType: string
  fileSize: number
  status: string
  uploadedAt: string
  storageKey: string
}

interface MaterialMatch {
  id: string
  uploadFileId: string
  checklistItemId: string
  status: string
  confidence: string
  explanation: string | null
}

interface AnalysisRun {
  id: string
  uploadFileId: string
  provider: string
  model: string
  parsedOutput: string | null
  confidence: string
  consensusGroup: string | null
  status: string
  errorMessage: string | null
  criteriaSummary: string | null
  createdAt: string
}

interface ParsedAnalysisOutput {
  detected_file_type?: string
  routing_status?: string
  explanation?: string
  uncertainty?: string
  recommended_action?: string
  risk_flags?: string[]
  criteria_summary?: string
}

interface ChecklistItem {
  id: string
  name: string
  required: boolean
}

interface ProofRecord {
  id: string
  proofType: 'file_received' | 'session_completed'
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  txHash: string | null
  explorerUrl: string | null
  payloadHash: string | null
  chain: string | null
  confirmedAt: string | null
  createdAt: string
  uploadFileId: string | null
  errorMessage: string | null
}

interface ItemValidation {
  id: string
  itemName: string
  criterionType: 'material' | 'reconciliation' | 'format_check' | 'other' | null
  validationStatus: string
  reviewStatus: string
  aiReasoning: string | null
  requestedAction: string | null
  requiredness: string
  conditionText: string | null
}

interface ValidationFile {
  id: string
  validationId: string
  uploadFileId: string
  contribution: string | null
}

interface SessionData {
  session: {
    id: string
    accountingPeriod: string
    status: string
    expiresAt: string
    analysisNotes: string | null
    requestEmailSubject: string | null
    requestEmailBody: string | null
    extractedCriteria: string | null
    additionalCriteria: string | null
    sessionEvaluation: string | null
  }
  client: { id: string; name: string; email: string; analysisNotes: string | null }
  staff: { name: string }
  tenant: { name: string }
  files: UploadFile[]
  matches: MaterialMatch[]
  analysisRuns: AnalysisRun[]
  checklistItems: ChecklistItem[]
  proofRecords: ProofRecord[]
  itemValidations: ItemValidation[]
  validationFiles: ValidationFile[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '고신뢰', medium: '중신뢰', low: '저신뢰', unknown: '-',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-green-700', medium: 'text-yellow-700', low: 'text-red-600', unknown: 'text-gray-400',
}
const VALIDATION_STATUS_CONFIG: Record<string, { label: string; style: string; short: string }> = {
  satisfied:           { label: '충족',      style: 'bg-green-100 text-green-700',   short: '충족' },
  partially_satisfied: { label: '일부 충족', style: 'bg-yellow-100 text-yellow-700', short: '일부' },
  missing:             { label: '누락',      style: 'bg-red-100 text-red-700',       short: '누락' },
  non_compliant:       { label: '불일치',    style: 'bg-orange-100 text-orange-700', short: '불일치' },
  uncertain:           { label: '판독 불가', style: 'bg-gray-100 text-gray-600',     short: '판독 불가' },
}

const NON_REQUEST_VALIDATION_PATTERNS = ['확인', '검증', '적절성', '대사']
type CriterionType = 'material' | 'reconciliation' | 'format_check' | 'other'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseAnalysisOutput(value: string | null): ParsedAnalysisOutput | null {
  if (!value) return null
  try { return JSON.parse(value) as ParsedAnalysisOutput } catch { return null }
}

function inferCriterionTypeFromText(itemName: string): CriterionType {
  if (NON_REQUEST_VALIDATION_PATTERNS.some(pattern => itemName.includes(pattern))) {
    return itemName.includes('대사') ? 'reconciliation' : 'format_check'
  }
  return 'material'
}

function getCriterionType(validation: ItemValidation): CriterionType {
  return validation.criterionType ?? inferCriterionTypeFromText(validation.itemName)
}

function isRequestedMaterialValidation(validation: ItemValidation) {
  return getCriterionType(validation) === 'material'
}

function getDisplayValidationStatus(status: string, itemName?: string, criterionType?: CriterionType | null) {
  void itemName
  void criterionType

  return VALIDATION_STATUS_CONFIG[status]
    ?? { label: status, short: status, style: 'bg-gray-100 text-gray-600' }
}

function getRepresentativeRun(runs: AnalysisRun[], fileId: string) {
  return runs
    .filter((r) => r.uploadFileId === fileId)
    .sort((a, b) => {
      const s = (r: AnalysisRun) => r.status === 'completed' && r.parsedOutput ? 0 : r.status === 'completed' ? 1 : 2
      const d = s(a) - s(b)
      return d !== 0 ? d : providerPriority(a.provider) - providerPriority(b.provider)
    })[0]
}

function getAcceptedFilesForDisplay({
  files,
  itemValidations,
  validationFiles,
  matches,
}: {
  files: UploadFile[]
  itemValidations: ItemValidation[]
  validationFiles: ValidationFile[]
  matches: MaterialMatch[]
}): CompletionAcceptedFile[] {
  const fileById = new Map(files.map(file => [file.id, file]))
  const satisfiedValidationIds = new Set(
    itemValidations
      .filter(validation => validation.validationStatus === 'satisfied')
      .map(validation => validation.id),
  )

  const acceptedByValidation = validationFiles
    .filter(link =>
      satisfiedValidationIds.has(link.validationId) &&
      link.contribution === 'satisfied' &&
      fileById.has(link.uploadFileId),
    )
    .map(link => fileById.get(link.uploadFileId))
    .filter(Boolean) as CompletionAcceptedFile[]

  if (acceptedByValidation.length > 0) {
    return [...new Map(acceptedByValidation.map(file => [file.id, file])).values()]
  }

  const acceptedByMatch = matches
    .filter(match =>
      ['matched', 'manual_approved'].includes(match.status) &&
      fileById.has(match.uploadFileId),
    )
    .map(match => fileById.get(match.uploadFileId))
    .filter(Boolean) as CompletionAcceptedFile[]

  return [...new Map(acceptedByMatch.map(file => [file.id, file])).values()]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type StepState = 'done' | 'active' | 'pending'

function SessionProgressStepper({ status, files, sessionId }: {
  status: string
  files: Array<{ status: string }>
  sessionId: string
}) {
  const [triggering, setTriggering] = useState(false)
  const router = useRouter()
  const [, startTransition] = useTransition()

  const handleStartEvaluation = async () => {
    setTriggering(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/start-evaluation`, { method: 'POST' })
      if (!res.ok) {
        toast.error('AI 선검증을 시작하지 못했습니다.')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('AI 선검증을 시작하지 못했습니다.')
    } finally { setTriggering(false) }
  }

  const handleResetAndRetry = async () => {
    setTriggering(true)
    try {
      const resetRes = await fetch(`/api/sessions/${sessionId}/reset-evaluation`, { method: 'POST' })
      if (!resetRes.ok) {
        toast.error('AI 선검증을 초기화하지 못했습니다.')
        return
      }
      const startRes = await fetch(`/api/sessions/${sessionId}/start-evaluation`, { method: 'POST' })
      if (!startRes.ok) {
        toast.error('AI 선검증을 다시 시작하지 못했습니다.')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('AI 선검증을 다시 시도하지 못했습니다.')
    } finally { setTriggering(false) }
  }

  const allFilesAnalyzed =
    files.length > 0 && files.every((f) => !['uploaded', 'analyzing'].includes(f.status))

  const steps: { label: string; state: StepState; detail?: string }[] = [
    { label: '요청 발송', state: 'done' },
    {
      label: '파일 업로드',
      state: ['submitted', 'ai_checking', 'needs_resubmission', 'ready_for_accountant', 'completed'].includes(status)
        ? 'done' : status === 'active' ? 'active' : 'pending',
      detail: files.length > 0 ? `${files.length}개 파일` : undefined,
    },
    {
      label: '파일 분석',
      state: allFilesAnalyzed ? 'done'
        : files.some((f) => ['analyzing', 'uploaded'].includes(f.status)) ? 'active' : 'pending',
      detail: allFilesAnalyzed ? `${files.length}개 완료`
        : files.filter(f => f.status === 'analyzing').length > 0 ? '분석 중…' : undefined,
    },
    {
      label: 'AI 선검증',
      state: ['needs_resubmission', 'ready_for_accountant', 'completed'].includes(status) ? 'done'
        : status === 'ai_checking' ? 'active' : 'pending',
      detail: status === 'ai_checking' ? '판단 중…' : undefined,
    },
    {
      label: '결과',
      state: status === 'completed' ? 'done'
        : ['needs_resubmission', 'ready_for_accountant'].includes(status) ? 'active' : 'pending',
      detail: status === 'needs_resubmission' ? '자료 보완 필요'
        : status === 'ready_for_accountant' ? '검토 가능'
        : status === 'completed' ? '완료' : undefined,
    },
  ]

  const canTriggerEval = status === 'submitted' && allFilesAnalyzed && files.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-6 py-4">
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center min-w-0">
              <div className="relative shrink-0 flex items-center justify-center">
                {step.state === 'active' && (
                  <span className="absolute inline-flex w-7 h-7 rounded-full bg-blue-400 opacity-50 animate-ping" />
                )}
                <div className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step.state === 'done' ? 'bg-green-500 text-white'
                  : step.state === 'active' ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.state === 'done' ? '✓' : i + 1}
                </div>
              </div>
              <p className={`mt-1.5 text-xs font-medium text-center ${
                step.state === 'done' ? 'text-green-700'
                : step.state === 'active' ? 'text-blue-700'
                : 'text-gray-400'
              }`}>{step.label}</p>
              {step.detail && (
                <p className={`text-[10px] text-center mt-0.5 ${step.state === 'active' ? 'text-blue-500' : 'text-gray-400'}`}>
                  {step.detail}
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-5 ${step.state === 'done' ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {canTriggerEval && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">파일 분석이 완료됐습니다. AI 선검증을 시작하세요.</p>
          <button
            onClick={handleStartEvaluation}
            disabled={triggering}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? '시작 중…' : 'AI 선검증 시작'}
          </button>
        </div>
      )}

      {status === 'ai_checking' && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">오래 걸린다면 다시 시도하세요.</p>
          <button
            onClick={handleResetAndRetry}
            disabled={triggering}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? '초기화 중…' : '다시 시도'}
          </button>
        </div>
      )}
    </div>
  )
}

// 종합 판단 카드 — 담당자 업무 언어 중심
function DecisionCard({ session, itemValidations, sessionId }: {
  session: SessionData['session']
  itemValidations: ItemValidation[]
  sessionId: string
}) {
  const DECISION_CONFIG: Record<string, {
    label: string; sublabel: string
    bg: string; border: string; labelStyle: string
  }> = {
    ready_for_accountant: {
      label: '매칭 완료',
      sublabel: '요청 자료가 충분히 갖춰져 있습니다. 최종 확인 후 완료 처리하세요.',
      bg: 'bg-green-50', border: 'border-green-200', labelStyle: 'text-green-800',
    },
    needs_resubmission: {
      label: '자료 보완 필요',
      sublabel: '누락되거나 기준에 맞지 않는 자료가 있습니다. 보충 요청 초안을 확인하세요.',
      bg: 'bg-orange-50', border: 'border-orange-200', labelStyle: 'text-orange-800',
    },
    ai_checking: {
      label: 'AI 검토 중',
      sublabel: '잠시 후 결과를 자동으로 확인합니다.',
      bg: 'bg-blue-50', border: 'border-blue-200', labelStyle: 'text-blue-800',
    },
    completed: {
      label: '완료',
      sublabel: '담당자가 자료 확인을 완료하고 세션을 닫았습니다.',
      bg: 'bg-green-50', border: 'border-green-200', labelStyle: 'text-green-800',
    },
  }

  const cfg = DECISION_CONFIG[session.status]
  if (!cfg) return null

  const requestedValidations = itemValidations.filter(isRequestedMaterialValidation)
  const countBase = requestedValidations.length > 0 ? requestedValidations : itemValidations
  const satisfiedCount = countBase.filter(v => v.validationStatus === 'satisfied').length
  const missingCount = countBase.filter(v => v.validationStatus === 'missing').length
  const mismatchCount = countBase.filter(v => v.validationStatus === 'non_compliant').length
  const unreadableCount = countBase.filter(v => v.validationStatus === 'uncertain').length

  let evalSummary: string | null = null
  if (session.sessionEvaluation) {
    try {
      const ev = JSON.parse(session.sessionEvaluation) as { summary?: string }
      evalSummary = ev.summary ?? null
    } catch { /* ignore */ }
  }

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} px-5 py-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${cfg.labelStyle}`}>{cfg.label}</p>
          <p className="text-xs text-gray-600 mt-0.5">{evalSummary ?? cfg.sublabel}</p>
        </div>
        {countBase.length > 0 && (
          <div className="shrink-0 flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-gray-500">
              요청자료 {countBase.length}
            </span>
            {satisfiedCount > 0 && (
              <span className="flex items-center gap-1 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                충족 {satisfiedCount}
              </span>
            )}
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                누락 {missingCount}
              </span>
            )}
            {mismatchCount > 0 && (
              <span className="flex items-center gap-1 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                불일치 {mismatchCount}
              </span>
            )}
            {unreadableCount > 0 && (
              <span className="flex items-center gap-1 text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                판독 불가 {unreadableCount}
              </span>
            )}
          </div>
        )}
      </div>
      {session.status === 'needs_resubmission' && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <Link href={`/dashboard/reviews?sessionId=${sessionId}`} className="text-xs font-medium text-orange-700 underline">
            보충 요청 메일 초안 확인 →
          </Link>
        </div>
      )}
    </div>
  )
}

// 요구한 데이터 - 합당한 파일 대응표
function MatchingTable({ itemValidations, validationFiles, files }: {
  itemValidations: ItemValidation[]
  validationFiles: ValidationFile[]
  files: UploadFile[]
}) {
  if (itemValidations.length === 0) return null

  const fileById = new Map(files.map(f => [f.id, f]))
  const requestedValidations = itemValidations.filter(isRequestedMaterialValidation)
  const tableItems = requestedValidations.length > 0 ? requestedValidations : itemValidations

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-medium text-gray-900">요구한 데이터 — 합당한 파일</h2>
        <p className="text-xs text-gray-400 mt-0.5">메일에서 요청한 자료 기준입니다.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-2/5">요구한 데이터</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-2/5">합당한 파일</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-1/5">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tableItems.map((v) => {
            const matchedFiles = validationFiles
              .filter(vf => vf.validationId === v.id && vf.contribution === 'satisfied')
              .map(vf => fileById.get(vf.uploadFileId))
              .filter(Boolean) as UploadFile[]

            const cfg = VALIDATION_STATUS_CONFIG[v.validationStatus]
              ?? { label: v.validationStatus, style: 'bg-gray-100 text-gray-500', short: v.validationStatus }

            return (
              <tr key={v.id}>
                <td className="px-5 py-3 align-top">
                  <p className="text-sm text-gray-900">{v.itemName}</p>
                  {v.requestedAction && (
                    <p className="text-xs text-orange-600 mt-0.5">→ {v.requestedAction}</p>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  {matchedFiles.length > 0 ? (
                    <div className="space-y-0.5">
                      {matchedFiles.map(f => (
                        <p key={f.id} className="text-xs text-gray-700 font-mono truncate max-w-xs">
                          {f.originalFilename}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">합당한 파일 없음</span>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.style}`}>
                    {cfg.short}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const SELECTION_CONTRIBUTION_PRIORITY: Record<string, number> = {
  satisfied: 0, partial: 1, uncertain: 2, non_compliant: 3, unrelated: 4,
}

function getFileReason({
  file,
  selected,
  selectedItemNames,
  links,
  validationById,
  analysisRuns,
}: {
  file: UploadFile
  selected: boolean
  selectedItemNames: string[]
  links: ValidationFile[]
  validationById: Map<string, ItemValidation>
  analysisRuns: AnalysisRun[]
}) {
  if (selected && selectedItemNames.length > 0) {
    return `${selectedItemNames.join(', ')} 자료로 판단되어 요청자료에 연결됐습니다.`
  }

  const linkedValidations = links
    .map(link => validationById.get(link.validationId))
    .filter(Boolean) as ItemValidation[]
  const action = linkedValidations.find(v => v.requestedAction)?.requestedAction
  if (action) return action

  const reasoning = linkedValidations.find(v => v.aiReasoning)?.aiReasoning
  if (reasoning) return reasoning

  const repRun = getRepresentativeRun(analysisRuns, file.id)
  const parsed = parseAnalysisOutput(repRun?.parsedOutput ?? null)
  if (parsed?.explanation) return parsed.explanation

  return selected ? '요청자료 판단에 사용할 파일로 선택됐습니다.' : '현재 요청자료 판단에 사용되지 않습니다.'
}

// 업로드된 파일들 — 요청자료 매칭 파일 / 매칭되지 않은 파일 / 파일별 이유
function UploadedFilesPanel({ files, validationFiles, itemValidations, analysisRuns }: {
  files: UploadFile[]
  validationFiles: ValidationFile[]
  itemValidations: ItemValidation[]
  analysisRuns: AnalysisRun[]
}) {
  if (files.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-sm text-gray-400 text-center">
        아직 업로드된 파일이 없습니다.
      </div>
    )
  }

  const fileById = new Map(files.map(file => [file.id, file]))
  const validationById = new Map(itemValidations.map(validation => [validation.id, validation]))
  const requestedValidations = itemValidations
    .filter(isRequestedMaterialValidation)
    .filter(validation => validation.validationStatus === 'satisfied')
  const selectedByFile = new Map<string, string[]>()

  for (const validation of requestedValidations) {
    const candidates = validationFiles
      .filter(link =>
        link.validationId === validation.id &&
        fileById.has(link.uploadFileId) &&
        link.contribution === 'satisfied',
      )
      .sort((a, b) => {
        const contributionDelta =
          (SELECTION_CONTRIBUTION_PRIORITY[a.contribution ?? 'unrelated'] ?? 99) -
          (SELECTION_CONTRIBUTION_PRIORITY[b.contribution ?? 'unrelated'] ?? 99)
        if (contributionDelta !== 0) return contributionDelta

        const fileA = fileById.get(a.uploadFileId)
        const fileB = fileById.get(b.uploadFileId)
        return (fileB?.uploadedAt ?? '').localeCompare(fileA?.uploadedAt ?? '')
      })

    const selected = candidates[0]
    if (!selected) continue
    const names = selectedByFile.get(selected.uploadFileId) ?? []
    names.push(validation.itemName)
    selectedByFile.set(selected.uploadFileId, names)
  }

  const fileRows = files.map(file => {
    const links = validationFiles.filter(link => link.uploadFileId === file.id)
    const selectedItemNames = selectedByFile.get(file.id) ?? []
    const selected = selectedItemNames.length > 0

    return {
      file,
      selected,
      selectedItemNames,
      reason: getFileReason({
        file,
        selected,
        selectedItemNames,
        links,
        validationById,
        analysisRuns,
      }),
    }
  })

  const renderFileList = (
    items: typeof fileRows,
    emptyText: string,
    badgeClassName: string,
    badgeText: string,
  ) => (
    items.length > 0 ? (
      <ul className="space-y-2 p-4">
        {items.map(({ file, reason }) => (
          <li key={file.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{file.originalFilename}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatBytes(file.fileSize)} · {formatDateTimeSlash(file.uploadedAt)}
                </p>
              </div>
              <span className={`shrink-0 self-start inline-flex h-6 items-center rounded-full px-2 text-xs font-medium leading-none whitespace-nowrap ${badgeClassName}`}>
                {badgeText}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">{reason}</p>
          </li>
        ))}
      </ul>
    ) : (
      <div className="px-5 py-6 text-sm text-gray-400 text-center">{emptyText}</div>
    )
  )

  const selectedRows = fileRows.filter(row => row.selected)
  const unselectedRows = fileRows.filter(row => !row.selected)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <h2 className="font-medium text-gray-900">업로드된 파일들</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          총 {files.length}개 업로드 · 요청자료 매칭 {selectedRows.length}개 · 매칭되지 않음 {unselectedRows.length}개
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-green-50 flex items-center justify-between">
          <h3 className="text-sm font-medium text-green-800">요청자료로 매칭된 파일</h3>
          <span className="text-xs text-green-700">{selectedRows.length}개</span>
        </div>
        {renderFileList(
          selectedRows,
          '요청자료로 매칭된 파일이 없습니다.',
          'bg-green-100 text-green-700',
          '선택됨',
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-800">요청자료로 매칭되지 않은 파일</h3>
          <span className="text-xs text-gray-500">{unselectedRows.length}개</span>
        </div>
        {renderFileList(
          unselectedRows,
          '요청자료로 매칭되지 않은 파일이 없습니다.',
          'bg-gray-100 text-gray-500',
          '선택 안 됨',
        )}
      </section>
    </div>
  )
}

function ReconciliationPanel({ itemValidations, validationFiles, files }: {
  itemValidations: ItemValidation[]
  validationFiles: ValidationFile[]
  files: UploadFile[]
}) {
  const fileById = new Map(files.map(file => [file.id, file]))
  const checkItems = itemValidations
    .filter(validation => !isRequestedMaterialValidation(validation))
    .filter(validation => validation.validationStatus !== 'satisfied')

  if (checkItems.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-medium text-gray-900">대사검증</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          제출된 자료끼리 금액, 기간, 거래 흐름이 맞는지 AI가 1차로 비교한 결과입니다.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-2/5">검증 항목</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-1/5">관련 파일</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-2/5">불일치 원인</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {checkItems.map(item => {
            const relatedFiles = validationFiles
              .filter(link => link.validationId === item.id)
              .map(link => fileById.get(link.uploadFileId))
              .filter(Boolean) as UploadFile[]
            const status = getDisplayValidationStatus(item.validationStatus, item.itemName, getCriterionType(item))

            return (
              <tr key={item.id}>
                <td className="px-5 py-3 align-top">
                  <p className="text-sm text-gray-900">{item.itemName}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.style}`}>
                    {status.short}
                  </span>
                </td>
                <td className="px-5 py-3 align-top text-xs text-gray-500">
                  {relatedFiles.length > 0 ? (
                    <ul className="space-y-1">
                      {relatedFiles.map(file => (
                        <li key={file.id} className="font-mono truncate">{file.originalFilename}</li>
                      ))}
                    </ul>
                  ) : '없음'}
                </td>
                <td className="px-5 py-3 align-top">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {item.aiReasoning ?? item.requestedAction ?? '금액, 기간, 거래 흐름 중 맞지 않는 항목이 있습니다.'}
                  </p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SessionDetail({ data, sessionId }: {
  data: SessionData
  sessionId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const {
    session, client, staff, files, matches, analysisRuns,
    checklistItems, proofRecords, itemValidations, validationFiles,
  } = data

  const hasAiInProgress = files.some(f => ['uploaded', 'analyzing'].includes(f.status))
  const acceptedFiles = getAcceptedFilesForDisplay({ files, itemValidations, validationFiles, matches })
  const completionEligibility = computeCompletionEligibility(itemValidations.map((validation) => ({
    criterionType: validation.criterionType,
    requiredness: validation.requiredness,
    validationStatus: validation.validationStatus,
    reviewStatus: validation.reviewStatus,
  })))
  const completionKind = completionEligibility.eligible ? completionEligibility.completionKind : null

  useEffect(() => {
    if (session.status !== 'ai_checking') return
    const id = setInterval(() => startTransition(() => router.refresh()), 5000)
    return () => clearInterval(id)
  }, [session.status, router, startTransition])

  const getMatchForItem = (itemId: string) => matches.find(m => m.checklistItemId === itemId)
  const getFileForMatch = (fileId: string) => files.find(f => f.id === fileId)

  const handleMatchUpdate = async (matchId: string, status: 'manual_approved' | 'manual_rejected') => {
    setUpdating(matchId)
    await fetch(`/api/sessions/${sessionId}/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(null)
    startTransition(() => router.refresh())
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? '요청 메일을 삭제하지 못했습니다')
      return
    }
    router.push(`/dashboard/clients/${client.id}?toast=deleted`)
    router.refresh()
  }

  const SESSION_STATUS: Record<string, string> = {
    requested: '업로드 대기', active: '업로드 중', submitted: '제출 완료',
    ai_checking: 'AI 판단 중', needs_resubmission: '자료 보완 필요',
    ready_for_accountant: '매칭 완료', completed: '완료',
    expired: '만료', revoked: '취소', draft: '초안',
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

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {client.name} — {session.accountingPeriod}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              담당: {staff.name} · 제출 기한: {formatDateKorean(session.expiresAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${SESSION_STATUS_COLOR[session.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {SESSION_STATUS[session.status] ?? session.status}
            </span>
          </div>
        </div>

        {hasAiInProgress && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            AI가 업로드 파일을 판단 중입니다. 완료되면 결과가 갱신됩니다.
          </div>
        )}

        {/* 요청 메일/기준 — 접힘 처리 */}
        {(client.analysisNotes || session.analysisNotes || session.extractedCriteria ||
          session.additionalCriteria || session.requestEmailSubject || session.requestEmailBody) && (
          <details className="mt-3 border-t border-gray-100 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
              요청 메일 / 분석 기준 보기
            </summary>
            <div className="mt-3 space-y-3 text-xs text-gray-500">
              {(client.analysisNotes || session.analysisNotes || session.extractedCriteria || session.additionalCriteria) && (
                <div className="rounded-lg bg-gray-50 p-3 space-y-1">
                  {client.analysisNotes && <p><span className="font-medium text-gray-600">회사 기준:</span> {client.analysisNotes}</p>}
                  {session.analysisNotes && <p><span className="font-medium text-gray-600">세션 기준:</span> {session.analysisNotes}</p>}
                  {session.extractedCriteria && <p className="whitespace-pre-wrap"><span className="font-medium text-gray-600">본문 추출 기준:</span> {session.extractedCriteria}</p>}
                  {session.additionalCriteria && <p className="whitespace-pre-wrap"><span className="font-medium text-gray-600">추가 기준:</span> {session.additionalCriteria}</p>}
                </div>
              )}
              {(session.requestEmailSubject || session.requestEmailBody) && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="font-medium text-gray-600">요청 메일 원문</p>
                  {session.requestEmailSubject && <p className="mt-1 font-medium text-gray-900">{session.requestEmailSubject}</p>}
                  {session.requestEmailBody && <p className="mt-2 whitespace-pre-wrap leading-5">{session.requestEmailBody}</p>}
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* ── 진행 상태 ── */}
      <SessionProgressStepper status={session.status} files={files} sessionId={sessionId} />

      {/* ── 종합 판단 카드 ── */}
      <DecisionCard session={session} itemValidations={itemValidations} sessionId={sessionId} />

      {/* ── 요구한 데이터 - 합당한 파일 대응표 ── */}
      <MatchingTable
        itemValidations={itemValidations}
        validationFiles={validationFiles}
        files={files}
      />

      {/* ── 업로드된 파일들 ── */}
      <UploadedFilesPanel
        files={files}
        validationFiles={validationFiles}
        itemValidations={itemValidations}
        analysisRuns={analysisRuns}
      />

      <CompletionApprovalPanel
        sessionId={sessionId}
        status={session.status}
        clientName={client.name}
        clientEmail={client.email}
        staffName={staff.name}
        accountingPeriod={session.accountingPeriod}
        acceptedFiles={acceptedFiles}
        completionKind={completionKind}
      />

      {/* ── 대사검증 ── */}
      <ReconciliationPanel
        itemValidations={itemValidations}
        validationFiles={validationFiles}
        files={files}
      />

      {/* ── AI 선검증 원문 (접힘) ── */}
      {session.sessionEvaluation && (() => {
        let ev: { criteria?: unknown[]; overall_verdict?: string; summary?: string } | null = null
        try { ev = JSON.parse(session.sessionEvaluation) } catch { /* ignore */ }
        if (!ev?.criteria?.length) return null
        return (
          <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary className="cursor-pointer px-5 py-4 font-medium text-gray-900 hover:bg-gray-50 flex items-center justify-between">
              <span>AI 선검증 상세 근거</span>
              <span className="text-xs text-gray-400">펼치기 ▼</span>
            </summary>
            <div className="px-5 pb-5 pt-1">
              <p className="text-xs text-gray-500 mb-3">{ev.summary}</p>
              <div className="space-y-2">
                {(ev.criteria as Array<{
                  criterion_text: string; status: string; reason: string; requested_action?: string | null
                }>).map((c, i) => {
                  const matchedValidation = itemValidations.find(item => item.itemName === c.criterion_text)
                  const cfg = getDisplayValidationStatus(
                    c.status,
                    matchedValidation?.itemName ?? c.criterion_text,
                    matchedValidation ? getCriterionType(matchedValidation) : undefined,
                  )
                  return (
                    <div key={i} className="rounded-lg bg-gray-50 px-4 py-3 text-xs">
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.style}`}>
                          {cfg.short}
                        </span>
                        <div>
                          <p className="font-medium text-gray-800">{c.criterion_text}</p>
                          <p className="text-gray-500 mt-0.5">{c.reason}</p>
                          {c.requested_action && (
                            <p className="text-orange-600 mt-0.5">→ {c.requested_action}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </details>
        )
      })()}

      {/* ── 자료관리기준 (비어 있으면 숨김, 있으면 접힘) ── */}
      {checklistItems.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 font-medium text-gray-900 hover:bg-gray-50 flex items-center justify-between">
            <span>자료관리기준 매칭 결과 <span className="text-xs text-gray-400 font-normal">({checklistItems.length}개 항목)</span></span>
            <span className="text-xs text-gray-400">펼치기 ▼</span>
          </summary>
          <ul className="divide-y divide-gray-100">
            {checklistItems.map((item) => {
              const match = getMatchForItem(item.id)
              const matchedFile = match ? getFileForMatch(match.uploadFileId) : null
              const isSatisfied = match?.status === 'matched' || match?.status === 'manual_approved'
              const needsReview = match?.status === 'needs_review'
              return (
                <li key={item.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.name}
                        {item.required && <span className="ml-1 text-xs text-blue-500">요청 항목</span>}
                      </p>
                      {matchedFile && <p className="text-xs text-gray-400 mt-0.5 truncate">{matchedFile.originalFilename}</p>}
                      {match?.explanation && <p className="text-xs text-gray-400 mt-0.5">{match.explanation}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      {isSatisfied ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">충족</span>
                      ) : needsReview ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">검토 필요</span>
                          {match && (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => handleMatchUpdate(match.id, 'manual_approved')}
                                disabled={updating === match.id}
                                className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >충족 처리</button>
                              <button
                                onClick={() => handleMatchUpdate(match.id, 'manual_rejected')}
                                disabled={updating === match.id}
                                className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                              >거부</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">미제출</span>
                      )}
                      {match && (
                        <p className={`text-xs mt-0.5 ${CONFIDENCE_COLOR[match.confidence]}`}>
                          {CONFIDENCE_LABEL[match.confidence]}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {/* ── Giwa Chain 온체인 증명 ── */}
      {proofRecords.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Giwa Chain 온체인 증명</h2>
            <p className="text-xs text-gray-400 mt-0.5">파일 수신·세션 완료 해시가 블록체인에 기록됩니다</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {proofRecords.map((proof) => {
              const sc = { pending: { label: '대기 중', color: 'bg-gray-100 text-gray-500' }, submitted: { label: '전송 완료', color: 'bg-blue-100 text-blue-700' }, confirmed: { label: '확인 완료', color: 'bg-green-100 text-green-700' }, failed: { label: '실패', color: 'bg-red-100 text-red-700' } }[proof.status]
              return (
                <li key={proof.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">
                          {proof.proofType === 'file_received' ? '파일 수신' : '세션 완료'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                      </div>
                      {proof.txHash && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                          {proof.txHash.slice(0, 18)}…{proof.txHash.slice(-6)}
                        </p>
                      )}
                      {proof.confirmedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          확인: {formatDateTimeISO(proof.confirmedAt)}
                        </p>
                      )}
                      {proof.status === 'failed' && proof.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{proof.errorMessage}</p>
                      )}
                    </div>
                    {proof.explorerUrl && (
                      <a href={proof.explorerUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs text-blue-600 hover:text-blue-800 underline">
                        Explorer →
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title="요청 메일을 삭제할까요?"
        description={`이 요청 메일은 화면에서 숨겨집니다.\n고객의 자료 제출 링크가 더 이상 열리지 않습니다.\n기존 메일, 업로드, 분석 기록은 내부 기록으로 보관됩니다.`}
        loading={deleting}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

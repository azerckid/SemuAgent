'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { ReviewAdaptiveStructuringEligibility } from '@/lib/reviews/adaptive-structuring-eligibility'
import type { ReviewAdaptiveCommonEngineResult } from '@/lib/reviews/adaptive-structuring-common-engine'
import type { ReviewAdaptiveStructuringProposalResponse } from '@/lib/reviews/adaptive-structuring-proposal-schema'

const detectedRoleLabel: Record<string, string> = {
  business_data_candidate: '업무 데이터 후보',
}

const STATUS_LABEL: Record<ReviewAdaptiveStructuringProposalResponse['status'], string> = {
  proposal_ready: '제안 가능',
  not_eligible: '제안 대상 아님',
  needs_more_information: '정보 부족',
}

const IGNORED_REGION_REASON_LABEL: Record<string, string> = {
  metadata: '메타정보',
  company_policy: '사내 규칙',
  result_only: '결과성 자료',
  footer_or_total: '합계/꼬리말',
  sample_or_instruction: '안내/예시',
  unsupported: '미지원',
  uncertain: '불확실',
}

function ProposalResult({ proposal }: { proposal: ReviewAdaptiveStructuringProposalResponse }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <Badge variant="outline" className="mb-1">{STATUS_LABEL[proposal.status]}</Badge>
        <p>{proposal.reason}</p>
      </div>

      {proposal.candidateSheets.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">후보 시트</p>
          <ul className="space-y-1">
            {proposal.candidateSheets.map((sheet) => (
              <li key={sheet.sheetName} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {sheet.sheetName} · {sheet.role} · 신뢰도 {Math.round(sheet.confidence * 100)}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.proposedMappings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">제안된 컬럼 매핑</p>
          <ul className="space-y-1">
            {proposal.proposedMappings.map((mapping, index) => (
              <li
                key={`${mapping.sheetName}-${mapping.sourceColumn}-${index}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                [{mapping.sheetName}] {mapping.sourceColumn} → {mapping.targetField}
                {mapping.required ? ' (필수)' : ''} · 신뢰도 {mapping.confidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.ignoredRegions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">제외된 영역</p>
          <ul className="space-y-1">
            {proposal.ignoredRegions.map((region, index) => (
              <li
                key={`${region.sheetName}-${region.sourceColumnOrRegion}-${index}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                [{region.sheetName}] {region.sourceColumnOrRegion} —{' '}
                {IGNORED_REGION_REASON_LABEL[region.reason] ?? region.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.sampleRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">샘플 row (최대 5개, 일부 정보 마스킹됨)</p>
          <ul className="space-y-1">
            {proposal.sampleRows.map((row, index) => (
              <li
                key={`${row.sheetName}-${row.sourceRowRef}-${index}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
              >
                <p className="mb-1 font-medium text-foreground">[{row.sheetName}] {row.sourceRowRef}</p>
                {Object.entries(row.values).map(([key, value]) => (
                  <span key={key} className="mr-3 inline-block">
                    {key}: {value}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposal.missingRequiredFields.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">누락된 필수 항목</p>
          <ul className="list-inside list-disc text-sm text-destructive">
            {proposal.missingRequiredFields.map((field) => <li key={field}>{field}</li>)}
          </ul>
        </div>
      )}

      {proposal.warnings.length > 0 && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {proposal.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        </div>
      )}
    </div>
  )
}

// AI가 proposal_ready를 반환했다는 것과, 그 매핑이 같은 워크북에서 실제로 재현된다는 것은
// 다른 판단이다. 이 패널은 항상 별도 배지로 분리해서 보여준다 — AI 제안 자체의
// 성공/실패와 엔진 재실행 검증의 성공/실패를 절대 같은 배지로 합치지 않는다.
function EnginePreview({ enginePreview }: { enginePreview: ReviewAdaptiveCommonEngineResult }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Badge variant={enginePreview.matched ? 'outline' : 'destructive'}>
          {enginePreview.matched ? '엔진 재실행 검증 통과' : '엔진 재실행 검증 실패 — 아직 적용 불가'}
        </Badge>
        <p className="text-xs text-muted-foreground">
          AI 제안을 같은 워크북에 결정론적으로 다시 실행한 결과입니다. 저장되지 않습니다.
        </p>
      </div>

      {enginePreview.blockers.length > 0 && (
        <ul className="list-inside list-disc text-sm text-destructive">
          {enginePreview.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}
        </ul>
      )}

      {enginePreview.matched && (
        <>
          <p className="text-xs text-muted-foreground">
            검증된 row {enginePreview.standardRows.length}개
            {enginePreview.blockedRowCount > 0 && ` · 거래일/금액 누락으로 제외된 row ${enginePreview.blockedRowCount}개`}
          </p>
          {enginePreview.standardRows.length > 0 && (
            <ul className="space-y-1">
              {enginePreview.standardRows.slice(0, 5).map((row, index) => (
                <li
                  key={`${row.sheetName}-${row.sourceRowRef}-${index}`}
                  className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
                >
                  <p className="mb-1 font-medium text-foreground">[{row.sheetName}] {row.sourceRowRef}</p>
                  {Object.entries(row.values).map(([key, value]) => (
                    <span key={key} className="mr-3 inline-block">
                      {key}: {value ?? '-'}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function ReviewAdaptiveStructuringButton({
  sessionId,
  eligibility,
}: {
  sessionId: string
  eligibility: ReviewAdaptiveStructuringEligibility
}) {
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [proposal, setProposal] = useState<ReviewAdaptiveStructuringProposalResponse | null>(null)
  const [enginePreview, setEnginePreview] = useState<ReviewAdaptiveCommonEngineResult | null>(null)
  const [registeredModelId, setRegisteredModelId] = useState<string | null>(null)

  const handlePropose = async () => {
    setLoading(true)
    const response = await fetch(`/api/sessions/${sessionId}/review/adaptive/propose`, {
      method: 'POST',
    })

    if (!response.ok) {
      setLoading(false)
      const data = await response.json().catch(() => null)
      toast.error(data?.error ?? '구조화 제안을 생성하지 못했습니다')
      return
    }

    const data = await response.json().catch(() => null)
    setLoading(false)
    if (!data?.proposal) {
      toast.error('구조화 제안 응답을 읽지 못했습니다')
      return
    }
    setProposal(data.proposal as ReviewAdaptiveStructuringProposalResponse)
    setEnginePreview((data.enginePreview as ReviewAdaptiveCommonEngineResult | null) ?? null)
    setRegisteredModelId(null)
  }

  const handleRegister = async () => {
    setRegistering(true)
    const response = await fetch('/api/review/adaptive-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = await response.json().catch(() => null)
    setRegistering(false)
    if (!response.ok) {
      toast.error(data?.error ?? '제안을 등록하지 못했습니다')
      return
    }
    setRegisteredModelId(data.modelId as string)
    toast.success('제안을 등록했습니다. 구조화 모델 관리 화면에서 승인할 수 있습니다.')
  }

  if (!eligibility.eligible) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        title={eligibility.reason}
        className="w-full sm:w-auto"
      >
        <Sparkles className="size-3.5" />
        구조화 제안
      </Button>
    )
  }

  return (
    <Sheet onOpenChange={(open) => {
      if (!open) { setProposal(null); setEnginePreview(null); setRegisteredModelId(null) }
    }}>
      <SheetTrigger className={buttonVariants({ variant: 'outline', className: 'w-full sm:w-auto' })}>
        <Sparkles className="size-3.5" />
        구조화 제안
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>구조화 제안 후보</SheetTitle>
          <SheetDescription>
            제안일 뿐 적용이 아닙니다. 이 단계에서는 귀속기간, 계정항목, 전표, 고객사 데이터가 변경되지 않습니다.
          </SheetDescription>
        </SheetHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {eligibility.reason}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">후보 파일</p>
          <ul className="space-y-2">
            {eligibility.candidateFiles.map((file) => (
              <li key={file.id} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{file.originalFilename}</span>
                  <Badge variant="outline">{detectedRoleLabel[file.detectedRole] ?? file.detectedRole}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{file.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        {eligibility.blockedFiles.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">제외된 파일</p>
            <ul className="space-y-1">
              {eligibility.blockedFiles.slice(0, 6).map((file) => (
                <li key={file.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{file.originalFilename}</span>
                  {' '}· {file.label}
                  {file.reason ? ` · ${file.reason}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button type="button" size="sm" onClick={handlePropose} disabled={loading}>
          {loading ? '구조화 분석 중...' : proposal ? '다시 제안' : '제안 생성'}
        </Button>

        {proposal && <ProposalResult proposal={proposal} />}
        {enginePreview && <EnginePreview enginePreview={enginePreview} />}
        {proposal?.status === 'proposal_ready' && !enginePreview && (
          <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            엔진 재실행 검증을 만들 수 있는 컬럼 매핑이 없습니다 — 아직 적용 불가로 봐야 합니다.
          </div>
        )}

        <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          제안과 엔진 재실행 검증은 별개입니다. AI가 제안해도 엔진 검증을 통과하지 못하면 적용할 수 없습니다.
        </div>

        {proposal?.status === 'proposal_ready' && enginePreview?.matched && (
          registeredModelId ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <p>제안을 등록했습니다. 승인은 별도 화면에서 관리자가 진행합니다.</p>
              <Link
                href="/dashboard/reviews/adaptive-models"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                구조화 모델 관리로 이동
              </Link>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleRegister} disabled={registering}>
              {registering ? '등록 중...' : '제안 등록'}
            </Button>
          )
        )}
      </SheetContent>
    </Sheet>
  )
}

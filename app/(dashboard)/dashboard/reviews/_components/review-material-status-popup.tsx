'use client'

import Link from 'next/link'
import { Upload } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DisplayStatus } from '@/lib/status-tone'
import { cn } from '@/lib/utils'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { CriterionReviewActions } from './criterion-review-actions'
import { ReviewAdaptiveStructuringButton } from './review-adaptive-structuring-button'
import type { ReviewAdaptiveStructuringEligibility } from '@/lib/reviews/adaptive-structuring-eligibility'
import {
  formatReviewFileBytes,
  formatReviewFileUploadedAt,
  getStaffDirectContinueUploadHref,
  ReviewBulkDownloadButton,
  ReviewFileDownloadLink,
} from './review-file-actions'
import { RerunReviewEvaluationButton } from './rerun-review-evaluation-button'
import { UnlinkedFileExcludeControl } from './unlinked-file-exclude-control'
import { buildReviewSubmissionPresentation, formatRequestItemName } from '@/lib/reviews/review-submission-status'
import type { ReviewFile, ReviewSession } from '@/lib/reviews/review-workspace-types'

const SUBMISSION_BADGE_CLASS: Record<'success' | 'warning' | 'secondary', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  secondary: 'border-border bg-muted/40 text-muted-foreground',
}

const REQUIREDNESS_BADGE_CLASS: Record<'secondary' | 'outline', string> = {
  secondary: 'border-blue-200 bg-blue-50 text-blue-700',
  outline: 'border-border bg-background text-muted-foreground',
}

function ReviewMaterialItemName({
  itemName,
  requiredness,
}: {
  itemName: string
  requiredness: { label: string; variant: 'secondary' | 'outline' }
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <span className="font-medium text-foreground">{formatRequestItemName(itemName)}</span>
      <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', REQUIREDNESS_BADGE_CLASS[requiredness.variant])}>
        {requiredness.label}
      </span>
    </div>
  )
}

function ReviewMatchedFileNames({ files }: { files: ReviewFile[] }) {
  if (files.length === 0) return <span className="text-xs text-muted-foreground">-</span>

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {files.map((file) => (
        <span key={file.id} className="max-w-64 truncate text-xs text-muted-foreground" title={file.originalFilename}>
          {file.originalFilename}
        </span>
      ))}
    </div>
  )
}

function ReviewSubmittedFilesSection({ session }: { session: ReviewSession }) {
  return (
    <section className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">제출 파일</h3>
          <p className="text-xs text-muted-foreground">업로드된 원본 파일을 내려받습니다.</p>
        </div>
        {session.files.length > 0 && <ReviewBulkDownloadButton sessionId={session.id} />}
      </div>
      {session.files.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">제출된 파일이 없습니다.</div>
      ) : (
        <div className="divide-y">
          {session.files.map((file) => (
            <div key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={file.originalFilename}>
                  {file.originalFilename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatReviewFileBytes(file.fileSize)} · {formatReviewFileUploadedAt(file.uploadedAt)}
                </p>
              </div>
              <ReviewFileDownloadLink
                sessionId={session.id}
                fileId={file.id}
                filename={file.originalFilename}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const DECLARATION_LABEL: Record<'none' | 'later', string> = {
  none: '없음 표시',
  later: '나중에 제출',
}

const DECLARATION_BADGE_CLASS: Record<'none' | 'later', string> = {
  none: 'border-purple-200 bg-purple-50 text-purple-700',
  later: 'border-amber-200 bg-amber-50 text-amber-700',
}

// 고객이 포털에서 표시한 선언(없음/나중에)을 담당자에게 보여준다. 담당자 확정은
// 기존 criterion review(excluded/overridden)로 하며, 이 블록은 확인용 신호다.
function ReviewClientDeclarationsSection({ session }: { session: ReviewSession }) {
  const declarations = session.itemDeclarations ?? []
  if (declarations.length === 0) return null

  return (
    <section className="rounded-lg border border-purple-100 bg-purple-50/40">
      <div className="border-b border-purple-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-purple-900">고객이 표시한 항목</h3>
        <p className="text-xs text-purple-700">고객이 직접 없음/나중에로 표시했습니다. 확인 후 담당자가 확정해 주세요.</p>
      </div>
      <ul className="divide-y divide-purple-100">
        {declarations.map((d) => (
          <li key={d.checklistItemId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground" title={d.itemName}>{d.itemName}</p>
              {d.note && <p className="truncate text-xs text-muted-foreground" title={d.note}>사유: {d.note}</p>}
            </div>
            <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', DECLARATION_BADGE_CLASS[d.declaration])}>
              고객: {DECLARATION_LABEL[d.declaration]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ReviewMaterialStatusPopup({
  status,
  displayClientName,
  accountingPeriod,
  session,
  adaptiveStructuring,
}: {
  status: DisplayStatus
  displayClientName: string
  accountingPeriod: string
  session: ReviewSession
  adaptiveStructuring: {
    eligibility: ReviewAdaptiveStructuringEligibility
  }
}) {
  const presentation = buildReviewSubmissionPresentation(session)
  const continueUploadHref = getStaffDirectContinueUploadHref(session)

  return (
    <StatusModal
      status={status}
      title="자료 상태"
      subtitle={`${displayClientName} · ${accountingPeriod}`}
      footerActions={
        <>
          {continueUploadHref && (
            <Link href={continueUploadHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              <Upload className="size-4" />
              업로드 이어하기
            </Link>
          )}
          <ReviewAdaptiveStructuringButton
            sessionId={session.id}
            eligibility={adaptiveStructuring.eligibility}
          />
          <RerunReviewEvaluationButton sessionId={session.id} disabled={session.files.length === 0} />
        </>
      }
    >
      <ReviewSubmittedFilesSection session={session} />

      <ReviewClientDeclarationsSection session={session} />

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[760px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">자료 항목</TableHead>
              <TableHead className="w-[92px]">제출 상태</TableHead>
              <TableHead>연결 파일</TableHead>
              <TableHead className="w-[104px] text-right">조치</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presentation.presentedRows.map(({ validation, displayMatchedFiles, requiredness, submissionStatus, submissionStatusKey }) => (
              <TableRow key={validation.id}>
                <TableCell className="align-top">
                  <ReviewMaterialItemName itemName={validation.itemName} requiredness={requiredness} />
                </TableCell>
                <TableCell className="align-top">
                  <span className={cn('inline-flex whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', SUBMISSION_BADGE_CLASS[submissionStatus.variant])}>
                    {submissionStatus.label}
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  <ReviewMatchedFileNames files={displayMatchedFiles} />
                </TableCell>
                <TableCell className="align-top text-right">
                  <CriterionReviewActions
                    sessionId={session.id}
                    sessionStatus={session.status}
                    validation={validation}
                    submissionStatusKey={submissionStatusKey}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {presentation.unlinkedFiles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>미연결 파일</TableHead>
                <TableHead>분류</TableHead>
                <TableHead>용량/업로드 시각</TableHead>
                <TableHead className="w-[120px] text-right">검토 제외</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presentation.unlinkedFiles.map(({ file, classification, badgeLabel }) => (
                <TableRow key={file.id}>
                  <TableCell className="whitespace-nowrap font-medium">{file.originalFilename}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" title={classification.reason}>{badgeLabel}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatReviewFileBytes(file.fileSize)} · {formatReviewFileUploadedAt(file.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UnlinkedFileExcludeControl
                      sessionId={session.id}
                      file={file}
                      classification={classification}
                      compact
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StatusModal>
  )
}

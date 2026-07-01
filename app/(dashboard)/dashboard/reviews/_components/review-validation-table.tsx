import { Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ReviewBulkDownloadButton,
  ReviewStaffDirectContinueUploadLink,
  formatReviewFileBytes,
  formatReviewFileUploadedAt,
  getReviewFilePipelineStatus,
  partitionReviewFilesByPipelineStatus,
} from './review-file-actions'
import {
  buildReviewSubmissionPresentation,
  formatRequestItemName,
} from '@/lib/reviews/review-submission-status'
import { CriterionReviewActions } from './criterion-review-actions'
import {
  hasStaffCriterionResolution,
  isEligibleCriterionReviewTarget,
  shouldShowOptionalReasonInput,
} from './criterion-review-ui'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'
import { FilePasswordInput } from '@/components/upload/file-password-input'
import { isPasswordSubmittable } from '@/lib/upload/file-display'
import { UnlinkedFileExcludeControl } from './unlinked-file-exclude-control'
import { countActionableUnlinkedFiles } from '@/lib/reviews/review-submission-status'

function unlinkedFileSectionTone(unlinkedFiles: ReturnType<typeof buildReviewSubmissionPresentation>['unlinkedFiles']) {
  return unlinkedFiles.every((item) => item.classification.status === 'unsuitable')
    ? {
        border: 'border-red-100',
        background: 'bg-red-50/40',
        title: 'text-red-700',
        itemBorder: 'border-red-100',
        reason: 'text-red-700',
      }
    : {
        border: 'border-amber-100',
        background: 'bg-amber-50/40',
        title: 'text-amber-700',
        itemBorder: 'border-amber-100',
        reason: 'text-amber-700',
      }
}

function ReviewPipelineStatusAlert({ session }: { session: ReviewSession }) {
  const { analyzingFiles, failedFiles } = partitionReviewFilesByPipelineStatus(session.files)
  if (analyzingFiles.length === 0 && failedFiles.length === 0) return null

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
      {analyzingFiles.length > 0 ? (
        <p className="text-muted-foreground">
          분석 중 {analyzingFiles.length}개: {analyzingFiles.map((file) => file.originalFilename).join(', ')}
        </p>
      ) : null}
      {failedFiles.length > 0 ? (
        <div className="grid gap-2">
          <p className="font-medium text-red-700">분석 실패 또는 제외 {failedFiles.length}개</p>
          {failedFiles.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-100 bg-background px-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{file.originalFilename}</p>
                <p className="text-muted-foreground">
                  {formatReviewFileBytes(file.fileSize)} · {formatReviewFileUploadedAt(file.uploadedAt)}
                </p>
              </div>
              <Badge variant={getReviewFilePipelineStatus(file).variant}>
                {getReviewFilePipelineStatus(file).label}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ReviewValidationTable({
  session,
  embedded = false,
}: {
  session: ReviewSession | null
  embedded?: boolean
}) {
  if (!session) return null

  const { rows, presentedRows, unlinkedFiles } = buildReviewSubmissionPresentation(session)
  const actionableUnlinkedCount = countActionableUnlinkedFiles(unlinkedFiles)
  const unlinkedTone = unlinkedFileSectionTone(unlinkedFiles)

  const content = (
    <>
      {session.files.length > 0 ? (
        <div className="flex justify-end">
          <ReviewBulkDownloadButton sessionId={session.id} />
        </div>
      ) : null}

      <ReviewPipelineStatusAlert session={session} />

      {session.files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">이 세션에는 아직 업로드된 파일이 없습니다.</p>
          <ReviewStaffDirectContinueUploadLink session={session} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          이 세션에는 아직 제출 자료 현황 결과가 없습니다.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">자료 항목</TableHead>
              <TableHead className="w-[16%]">제출 상태</TableHead>
              <TableHead>연결 파일</TableHead>
              <TableHead className="w-[14%] text-right">조치</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presentedRows.map((row) => (
              <Fragment key={row.validation.id}>
                <TableRow>
                  <TableCell>
                    <p className="font-medium text-foreground">{formatRequestItemName(row.validation.itemName)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.submissionStatus.variant}>{row.submissionStatus.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.displayMatchedFiles.length > 0 ? (
                      <ul className="space-y-1">
                        {row.displayMatchedFiles.map((file) => (
                          <li
                            key={file.id}
                            className="max-w-xs truncate text-xs text-muted-foreground"
                            title={file.originalFilename}
                          >
                            {file.originalFilename}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    {isEligibleCriterionReviewTarget(row.validation) &&
                    (shouldShowOptionalReasonInput({
                      sessionStatus: session.status,
                      validation: row.validation,
                      submissionStatusKey: row.submissionStatusKey,
                    }) || hasStaffCriterionResolution(row.validation)) ? (
                      <CriterionReviewActions
                        sessionId={session.id}
                        sessionStatus={session.status}
                        validation={row.validation}
                        submissionStatusKey={row.submissionStatusKey}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
                {row.submissionStatusKey === 'needs_check' ? (
                  <TableRow className="bg-amber-50/40 hover:bg-amber-50/40">
                    <TableCell colSpan={4} className="py-2 text-xs text-amber-800">
                      {row.memo}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      {unlinkedFiles.length > 0 && (
        <div className={`rounded-lg border ${unlinkedTone.border} ${unlinkedTone.background} p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-semibold ${unlinkedTone.title}`}>자료항목과 연결되지 않는 파일</p>
            <Badge variant="warning">{actionableUnlinkedCount}개</Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {unlinkedFiles.map((item) => {
              const pipelineStatus = getReviewFilePipelineStatus(item.file)
              return (
                <div key={item.file.id} className={`rounded-md border ${unlinkedTone.itemBorder} bg-background px-3 py-2`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.file.originalFilename}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatReviewFileBytes(item.file.fileSize)} · {formatReviewFileUploadedAt(item.file.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>
                      {pipelineStatus.variant !== 'success' && pipelineStatus.variant !== 'info' ? (
                        <Badge variant={pipelineStatus.variant}>{pipelineStatus.label}</Badge>
                      ) : null}
                      <UnlinkedFileExcludeControl
                        sessionId={session.id}
                        file={item.file}
                        classification={item.classification}
                      />
                    </div>
                  </div>
                  <p className={`mt-2 text-xs ${unlinkedTone.reason}`}>
                    {item.classification.reason || '미연결 사유가 없습니다. 「자료 다시 검토」를 실행해 주세요.'}
                  </p>
                  {isPasswordSubmittable(item.file.passwordStatus) ? (
                    <FilePasswordInput
                      fileId={item.file.id}
                      mode="staff"
                      variant="dashboard"
                      className="mt-3"
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="grid gap-3 border-t border-border pt-4">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>제출 자료 현황</CardTitle>
        <CardDescription>
          고객이 제출한 자료를 요청자료 기준에 맞춰 정리합니다. 제출되지 않은 자료는 바로 보충 요청으로 판단하지 않고 제출 여부를 먼저 확인합니다.
          <span className="mt-1 block text-xs text-muted-foreground/80">
            참고 항목은 제출되지 않아도 바로 보충 요청으로 판단하지 않습니다.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {content}
      </CardContent>
    </Card>
  )
}

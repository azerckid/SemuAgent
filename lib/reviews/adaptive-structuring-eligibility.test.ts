import { describe, expect, it } from 'vitest'
import { deriveReviewAdaptiveStructuringEligibility } from './adaptive-structuring-eligibility'
import type { ReviewAnalysisRun, ReviewFile, ReviewSession } from '@/lib/reviews/review-workspace-types'

function mockFile(overrides: Partial<ReviewFile> = {}): ReviewFile {
  return {
    id: overrides.id ?? 'file-1',
    uploadSessionId: 'session-1',
    originalFilename: overrides.originalFilename ?? 'unknown-format.xlsx',
    fileType: overrides.fileType ?? 'excel',
    fileSize: 1024,
    status: overrides.status ?? 'matched',
    passwordStatus: overrides.passwordStatus,
    uploadedAt: '2026-06-20T10:00:00.000+09:00',
  }
}

function mockRun(
  file: ReviewFile,
  parsedOutput: Record<string, unknown>,
): ReviewAnalysisRun {
  return {
    id: `run-${file.id}`,
    uploadFileId: file.id,
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    confidence: 'medium',
    consensusGroup: 'medium_confidence',
    status: 'completed',
    parsedOutput: JSON.stringify(parsedOutput),
    errorMessage: null,
    criteriaSummary: null,
    createdAt: '2026-06-20T10:01:00.000+09:00',
  }
}

function mockSession(
  files: ReviewFile[],
  analysisRuns: ReviewAnalysisRun[] = [],
  overrides: Partial<ReviewSession> = {},
): ReviewSession {
  return {
    id: 'session-1',
    clientId: 'client-1',
    clientName: '솔메이트',
    clientEmail: 'solmate.dev@gmail.com',
    staffName: '춘심이',
    accountingPeriod: '2026-06',
    status: 'needs_resubmission',
    hasSessionEvaluation: true,
    expiresAt: '2026-06-30T23:59:59.000+09:00',
    createdAt: '2026-06-20T10:00:00.000+09:00',
    requestEmailSubject: '기장 자료 요청',
    requestEmailBody: null,
    source: 'customer_upload',
    latestAnalysisAt: null,
    workType: 'bookkeeping',
    bookkeepingPeriodType: 'monthly',
    bookkeepingPeriodStart: '2026-06',
    bookkeepingPeriodEnd: '2026-06',
    files,
    validations: [],
    validationFiles: [],
    analysisRuns,
    materialAttributions: [],
    materialAttributionSummary: null,
    acceptedFiles: [],
    counts: {
      satisfied: 0,
      missing: 0,
      nonCompliant: 0,
      partial: 0,
      uncertain: 0,
    },
    derivedStatus: {
      label: '검토필요',
      detail: '테스트',
      tone: 'warning',
    },
    completionKind: null,
    ...overrides,
  }
}

describe('deriveReviewAdaptiveStructuringEligibility', () => {
  it('returns no-candidate when the session has no files', () => {
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([]))

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('구조화 후보 없음')
  })

  it('blocks while review file analysis is still pending', () => {
    const file = mockFile({ status: 'uploaded' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file]))

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('검토 완료 후 가능')
  })

  it('blocks when a file needs an Excel password', () => {
    const file = mockFile({ passwordStatus: 'required' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file]))

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('파일 확인 필요')
  })

  it('does not propose when existing review logic already handles a suitable bank statement', () => {
    const file = mockFile({ originalFilename: '기업은행 거래내역.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '은행 거래내역',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '거래일자와 입출금액이 있는 통장 거래내역입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('기존 자료검토 로직으로 처리 가능한 자료입니다.')
  })

  it('offers a candidate for an unmatched tabular business-data-looking file', () => {
    const file = mockFile({ originalFilename: '새양식_정산목록.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '기타 엑셀 자료',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '요청자료 항목에는 자동 연결되지 않았지만 일자, 상대방, 금액 열이 있는 표입니다.',
        staff_unlinked_reason: '자동 연결 기준에는 없지만 행 단위 업무 금액 자료로 보입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(true)
    expect(result.candidateFiles).toHaveLength(1)
    expect(result.candidateFiles[0]?.originalFilename).toBe('새양식_정산목록.xlsx')
  })

  it('does not offer a candidate for a known unsuitable file', () => {
    const file = mockFile({ originalFilename: '네이버페이-4~6월.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '월별 부가세 매출 집계표',
        material_status: 'insufficient',
        routing_status: 'needs_review',
        explanation: '거래 상세가 아닌 월별 집계표입니다.',
        risk_flags: ['not_transaction_detail'],
      }),
    ]))

    expect(result.eligible).toBe(false)
    expect(result.candidateFiles).toEqual([])
  })

  it('does not offer a candidate for a metadata-only workbook even when unmatched', () => {
    const file = mockFile({ originalFilename: '회사정보.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '회사 정보 안내',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '회사명, 대표자, 담당자 정보만 있는 메타정보 시트입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(false)
    expect(result.candidateFiles).toEqual([])
    expect(result.reason).toBe('구조화 후보 없음')
  })

  it('does not offer a candidate for a company-policy-only workbook even when unmatched', () => {
    const file = mockFile({ originalFilename: '사규.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '사내 규정 안내',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '식대 비과세 한도와 지급 기준 안내만 있는 사내 규정 메모입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(false)
    expect(result.candidateFiles).toEqual([])
  })

  it('does not offer a candidate for a result-only workbook even when unmatched', () => {
    const file = mockFile({ originalFilename: '집계표.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([file], [
      mockRun(file, {
        detected_file_type: '월별 결과 요약',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '이미 계산된 부서별 집계 결과만 있는 합계 표입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(false)
    expect(result.candidateFiles).toEqual([])
  })

  it('still offers the genuine candidate when a metadata-only file is mixed in', () => {
    const candidateFile = mockFile({ id: 'file-candidate', originalFilename: '새양식_정산목록.xlsx' })
    const metadataFile = mockFile({ id: 'file-metadata', originalFilename: '회사정보.xlsx' })
    const result = deriveReviewAdaptiveStructuringEligibility(mockSession([candidateFile, metadataFile], [
      mockRun(candidateFile, {
        detected_file_type: '기타 엑셀 자료',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '요청자료 항목에는 자동 연결되지 않았지만 일자, 상대방, 금액 열이 있는 표입니다.',
        staff_unlinked_reason: '자동 연결 기준에는 없지만 행 단위 업무 금액 자료로 보입니다.',
        risk_flags: [],
      }),
      mockRun(metadataFile, {
        detected_file_type: '회사 정보 안내',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '회사명, 대표자, 담당자 정보만 있는 메타정보 시트입니다.',
        risk_flags: [],
      }),
    ]))

    expect(result.eligible).toBe(true)
    expect(result.candidateFiles).toHaveLength(1)
    expect(result.candidateFiles[0]?.id).toBe('file-candidate')
    expect(result.blockedFiles.some((blocked) => blocked.id === 'file-metadata')).toBe(true)
  })
})

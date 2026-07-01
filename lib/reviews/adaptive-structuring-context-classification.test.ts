import { describe, expect, it } from 'vitest'
import { detectReviewAdaptiveContextSignal } from './adaptive-structuring-context-classification'
import type { ReviewAnalysisRun, ReviewFile } from '@/lib/reviews/review-workspace-types'

function mockFile(overrides: Partial<ReviewFile> = {}): ReviewFile {
  return {
    id: overrides.id ?? 'file-1',
    uploadSessionId: 'session-1',
    originalFilename: overrides.originalFilename ?? 'unknown-format.xlsx',
    fileType: overrides.fileType ?? 'excel',
    fileSize: 1024,
    status: overrides.status ?? 'matched',
    passwordStatus: overrides.passwordStatus,
    uploadedAt: '2026-06-21T10:00:00.000+09:00',
  }
}

function mockRun(file: ReviewFile, parsedOutput: Record<string, unknown>): ReviewAnalysisRun {
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
    createdAt: '2026-06-21T10:01:00.000+09:00',
  }
}

describe('detectReviewAdaptiveContextSignal', () => {
  it('returns null when there is no analysis run yet', () => {
    const file = mockFile()
    expect(detectReviewAdaptiveContextSignal(file, [])).toBeNull()
  })

  it('returns null for plausible new business-data content', () => {
    const file = mockFile({ originalFilename: '새양식_정산목록.xlsx' })
    const run = mockRun(file, {
      detected_file_type: '기타 엑셀 자료',
      explanation: '일자, 상대방, 금액 열이 있는 표입니다.',
      staff_unlinked_reason: '자동 연결 기준에는 없지만 행 단위 업무 금액 자료로 보입니다.',
      risk_flags: [],
    })
    expect(detectReviewAdaptiveContextSignal(file, [run])).toBeNull()
  })

  it('detects a metadata-only workbook from AI-read content', () => {
    const file = mockFile({ originalFilename: '회사정보.xlsx' })
    const run = mockRun(file, {
      detected_file_type: '회사 정보 안내',
      explanation: '회사명, 대표자, 담당자 정보만 있는 메타정보 시트입니다.',
      risk_flags: [],
    })
    expect(detectReviewAdaptiveContextSignal(file, [run])).toBe('metadata_reference')
  })

  it('detects a company-policy-only workbook from AI-read content', () => {
    const file = mockFile({ originalFilename: '사규.xlsx' })
    const run = mockRun(file, {
      detected_file_type: '사내 규정 안내',
      explanation: '식대 비과세 한도와 지급 기준 안내만 있는 사내 규정 메모입니다.',
      risk_flags: [],
    })
    expect(detectReviewAdaptiveContextSignal(file, [run])).toBe('company_policy')
  })

  it('detects a result-only workbook from AI-read content', () => {
    const file = mockFile({ originalFilename: '집계표.xlsx' })
    const run = mockRun(file, {
      detected_file_type: '월별 결과 요약',
      explanation: '이미 계산된 부서별 집계 결과만 있는 합계 표입니다.',
      risk_flags: [],
    })
    expect(detectReviewAdaptiveContextSignal(file, [run])).toBe('result_only')
  })
})

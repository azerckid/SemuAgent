import { describe, expect, it } from 'vitest'
import { canStaffExcludeUnlinkedFile, isStaffExcludedUnlinkedFile } from './unlinked-file-review'
import {
  buildReviewSubmissionPresentation,
  countActionableUnlinkedFiles,
  deriveSessionStatus,
} from './review-submission-status'
import type { ReviewFile, ReviewSession, ReviewValidation } from './review-workspace-types'

function mockValidation(overrides: Partial<ReviewValidation> = {}): ReviewValidation {
  return {
    id: 'validation-1',
    uploadSessionId: 'session-1',
    itemName: '통장 거래내역',
    itemGroup: 'bank_statement',
    criterionType: 'material',
    requiredness: 'required',
    validationStatus: 'satisfied',
    reviewStatus: 'pending',
    aiReasoning: null,
    requestedAction: null,
    staffNote: null,
    reviewedAt: null,
    ...overrides,
  }
}

function mockFile(overrides: Partial<ReviewFile> = {}): ReviewFile {
  return {
    id: 'file-unlinked',
    uploadSessionId: 'session-1',
    originalFilename: '네이버페이-4~6월.xlsx',
    fileType: 'excel',
    fileSize: 1024,
    status: 'matched',
    uploadedAt: '2026-06-03T22:38:00.000Z',
    ...overrides,
  }
}

function mockSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    id: 'session-1',
    clientId: 'client-1',
    clientName: '솔메이트',
    clientEmail: 'solmate.dev@gmail.com',
    staffName: '춘심이',
    accountingPeriod: '2026-06',
    status: 'submitted',
    hasSessionEvaluation: true,
    expiresAt: '2026-06-23T23:59:00.000Z',
    createdAt: '2026-06-03T22:38:00.000Z',
    requestEmailSubject: null,
    requestEmailBody: null,
    source: 'customer_upload',
    latestAnalysisAt: '2026-06-03T22:39:00.000Z',
    workType: 'bookkeeping',
    bookkeepingPeriodType: 'monthly',
    bookkeepingPeriodStart: '2026-06-01',
    bookkeepingPeriodEnd: '2026-06-30',
    files: [],
    validations: [],
    validationFiles: [],
    analysisRuns: [],
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
      label: '제출 확인',
      detail: '',
      tone: 'info',
    },
    completionKind: null,
    itemDeclarations: [],
    ...overrides,
  }
}

describe('unlinked file staff exclusion', () => {
  it('treats staff-excluded unlinked files as non-actionable', () => {
    const file = mockFile({ staffReviewStatus: 'excluded' })
    const session = mockSession({
      files: [file],
      validations: [mockValidation()],
      analysisRuns: [{
        id: 'run-1',
        uploadFileId: file.id,
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          routing_status: 'needs_review',
          staff_unlinked_reason: '월별 집계표라 요청자료에 연결하지 않습니다.',
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-03T22:39:00.000Z',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.unlinkedFiles).toHaveLength(1)
    expect(countActionableUnlinkedFiles(presentation.unlinkedFiles)).toBe(0)
    expect(presentation.actionableUnlinkedCount).toBe(0)

    const derived = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: session.latestAnalysisAt,
    })

    expect(derived.label).toBe('제출 확인')
  })

  it('blocks exclusion while password is required or analysis is pending', () => {
    expect(canStaffExcludeUnlinkedFile(
      mockFile({ passwordStatus: 'required' }),
      { status: 'password_required' } as never,
    )).toBe(false)

    expect(canStaffExcludeUnlinkedFile(
      mockFile({ status: 'analyzing' }),
      { status: 'pending' } as never,
    )).toBe(false)
  })

  it('identifies excluded review status', () => {
    expect(isStaffExcludedUnlinkedFile({ staffReviewStatus: 'excluded' })).toBe(true)
    expect(isStaffExcludedUnlinkedFile({ staffReviewStatus: 'none' })).toBe(false)
  })
})

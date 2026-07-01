import { describe, expect, it } from 'vitest'
import {
  buildReviewSubmissionPresentation,
  deriveSessionStatus,
  formatRequestItemName,
  getSubmissionMemo,
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
    validationStatus: 'missing',
    reviewStatus: 'pending',
    aiReasoning: null,
    requestedAction: null,
    staffNote: null,
    reviewedAt: null,
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
    status: 'needs_resubmission',
    hasSessionEvaluation: true,
    expiresAt: '2026-06-23T23:59:00.000Z',
    createdAt: '2026-06-03T22:38:00.000Z',
    requestEmailSubject: null,
    requestEmailBody: null,
    source: 'customer_upload',
    latestAnalysisAt: null,
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
      label: '보충 필요',
      detail: 'placeholder',
      tone: 'warning',
    },
    completionKind: null,
    ...overrides,
  }
}

describe('buildReviewSubmissionPresentation', () => {
  it('labels missing required rows as 제출 없음 without treating them as 검토필요', () => {
    const session = mockSession({
      validations: [mockValidation()],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.noSubmissionCount).toBe(1)
    expect(presentation.needsCheckCount).toBe(0)
    expect(presentation.presentedRows[0]?.submissionStatus.label).toBe('제출 없음')
    expect(getSubmissionMemo(
      presentation.presentedRows[0]!.validation,
      'none',
      false,
    )).toContain('정상일 수 있으며')
  })

  it('counts linked but non-compliant rows as 검토필요', () => {
    const file: ReviewFile = {
      id: 'file-1',
      uploadSessionId: 'session-1',
      originalFilename: '기업은행 거래내역조회.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'matched',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const validation = mockValidation({
      id: 'validation-2',
      validationStatus: 'non_compliant',
      requestedAction: '기간 확인 필요',
    })
    const session = mockSession({
      files: [file],
      validations: [validation],
      validationFiles: [{
        id: 'link-1',
        validationId: validation.id,
        uploadFileId: file.id,
        contribution: 'partial',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.needsCheckCount).toBe(1)
    expect(presentation.presentedRows[0]?.submissionStatus.label).toBe('검토필요')
  })

  it('lists uploaded files that are not connected to any submission row as 미연결 파일', () => {
    const file: ReviewFile = {
      id: 'file-unlinked',
      uploadSessionId: 'session-1',
      originalFilename: '2026.지출결의서.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'matched',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const session = mockSession({
      files: [file],
      validations: [mockValidation()],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.linkedFileCount).toBe(0)
    expect(presentation.unlinkedFiles).toHaveLength(1)
    expect(presentation.unlinkedFiles[0]?.file.id).toBe(file.id)
    expect(presentation.unlinkedFiles[0]?.badgeLabel).toBe('연결 필요')
  })

  it('does not count deterministically matched uploaded files as 미연결 파일', () => {
    const file: ReviewFile = {
      id: 'file-bank',
      uploadSessionId: 'session-1',
      originalFilename: '하나은행2024.01.01-12.31.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'matched',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const session = mockSession({
      files: [file],
      validations: [mockValidation()],
      analysisRuns: [{
        id: 'run-1',
        uploadFileId: file.id,
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '은행 거래내역',
          explanation: '하나은행 통장 거래내역 파일입니다.',
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-03T22:39:00.000Z',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.linkedFileCount).toBe(1)
    expect(presentation.unlinkedFiles).toHaveLength(0)
    expect(presentation.presentedRows[0]?.displayMatchedFiles).toHaveLength(1)
    expect(presentation.linkedFileCount + presentation.unlinkedFiles.length).toBe(session.files.length)
  })

  it('does not hide files linked only to non-material validations', () => {
    const file: ReviewFile = {
      id: 'file-format-only',
      uploadSessionId: 'session-1',
      originalFilename: '참고자료.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'matched',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const materialValidation = mockValidation({ id: 'validation-material' })
    const formatValidation = mockValidation({
      id: 'validation-format',
      itemName: '파일 형식 확인',
      criterionType: 'format_check',
      validationStatus: 'satisfied',
    })
    const session = mockSession({
      files: [file],
      validations: [materialValidation, formatValidation],
      validationFiles: [{
        id: 'link-format',
        validationId: formatValidation.id,
        uploadFileId: file.id,
        contribution: 'satisfied',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.linkedFileCount).toBe(0)
    expect(presentation.unlinkedFiles).toHaveLength(1)
    expect(presentation.unlinkedFiles[0]?.file.id).toBe(file.id)
    expect(presentation.linkedFileCount + presentation.unlinkedFiles.length).toBe(session.files.length)
  })

  it('does not leave files unlinked when the AI reason identifies the requested material', () => {
    const file: ReviewFile = {
      id: 'file-bank-from-reason',
      uploadSessionId: 'session-1',
      originalFilename: '농협.xls',
      fileType: 'excel',
      fileSize: 1024,
      status: 'needs_review',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const session = mockSession({
      files: [file],
      validations: [mockValidation()],
      analysisRuns: [{
        id: 'run-1',
        uploadFileId: file.id,
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '기타 엑셀 자료',
          material_status: 'sufficient',
          routing_status: 'needs_review',
          explanation: '자동 연결 체크리스트 항목이 지정되지 않았습니다.',
          staff_unlinked_reason: '농협 보통예금 입출금 거래내역이므로 통장 거래내역으로 검토할 수 있습니다.',
          risk_flags: [],
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-03T22:39:00.000Z',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.linkedFileCount).toBe(1)
    expect(presentation.unlinkedFiles).toHaveLength(0)
    expect(presentation.presentedRows[0]?.displayMatchedFiles[0]?.id).toBe(file.id)
  })

  it('deterministically links card statement files to card checklist rows', () => {
    const file: ReviewFile = {
      id: 'file-card',
      uploadSessionId: 'session-1',
      originalFilename: 'KCP-4~6월.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'needs_review',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const session = mockSession({
      files: [file],
      validations: [
        mockValidation({
          id: 'validation-card',
          itemName: '카드 사용내역',
          itemGroup: 'card_statement',
        }),
      ],
      analysisRuns: [{
        id: 'run-card',
        uploadFileId: file.id,
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '카드 사용내역',
          material_status: 'sufficient',
          routing_status: 'needs_review',
          explanation: '카드 승인일자와 이용금액이 있는 카드 사용내역입니다.',
          risk_flags: [],
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-03T22:39:00.000Z',
      }],
    })

    const presentation = buildReviewSubmissionPresentation(session)

    expect(presentation.linkedFileCount).toBe(1)
    expect(presentation.unlinkedFiles).toHaveLength(0)
    expect(presentation.presentedRows[0]?.submissionStatusKey).toBe('submitted')
    expect(presentation.presentedRows[0]?.displayMatchedFiles[0]?.id).toBe(file.id)
  })
})

describe('deriveSessionStatus', () => {
  it('uses 제출 없음 when the session has no uploaded files', () => {
    const session = mockSession({
      status: 'needs_resubmission',
      validations: [
        mockValidation({ id: 'validation-a' }),
        mockValidation({ id: 'validation-b', itemName: '카드 매출내역' }),
      ],
    })

    const derivedStatus = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: null,
    })

    expect(derivedStatus.label).toBe('제출 없음')
    expect(derivedStatus.tone).toBe('default')
    expect(derivedStatus.detail).toContain('제출 없음')
    expect(derivedStatus.detail).toContain('정상일 수 있습니다')
  })

  it('uses 평가 필요 when analysis is done but session evaluation is missing', () => {
    const session = mockSession({
      status: 'submitted',
      hasSessionEvaluation: false,
      files: [{
        id: 'file-bank',
        uploadSessionId: 'session-1',
        originalFilename: 'bank.xlsx',
        fileType: 'excel',
        fileSize: 1024,
        status: 'matched',
        uploadedAt: '2026-06-03T22:38:00.000Z',
      }],
    })

    const derivedStatus = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: '2026-06-03T22:39:00.000Z',
    })

    expect(derivedStatus.label).toBe('평가 필요')
    expect(derivedStatus.tone).toBe('warning')
    expect(derivedStatus.detail).toContain('자료 다시 검토')
  })

  it('uses 검토필요 when uploaded files exist but none are connected to requested rows', () => {
    const session = mockSession({
      status: 'needs_resubmission',
      files: [{
        id: 'file-other',
        uploadSessionId: 'session-1',
        originalFilename: '참고자료.xlsx',
        fileType: 'excel',
        fileSize: 1024,
        status: 'matched',
        uploadedAt: '2026-06-03T22:38:00.000Z',
      }],
      validations: [
        mockValidation({ id: 'validation-a' }),
        mockValidation({ id: 'validation-b', itemName: '카드 매출내역' }),
      ],
      analysisRuns: [{
        id: 'run-1',
        uploadFileId: 'file-other',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '참고자료',
          explanation: '요청 기준과 직접 연결되지 않는 참고자료입니다.',
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-03T22:39:00.000Z',
      }],
    })

    const derivedStatus = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: null,
    })

    expect(derivedStatus.label).toBe('검토필요')
    expect(derivedStatus.tone).toBe('warning')
  })

  it('uses 검토필요 when failed files or needs_check rows exist', () => {
    const session = mockSession({
      status: 'submitted',
      files: [{
        id: 'file-failed',
        uploadSessionId: 'session-1',
        originalFilename: 'broken.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        status: 'failed',
        uploadedAt: '2026-06-03T22:38:00.000Z',
      }],
    })

    const derivedStatus = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: null,
    })

    expect(derivedStatus.label).toBe('검토필요')
    expect(derivedStatus.tone).toBe('warning')
  })

  it('uses 검증통과 for ready_for_accountant sessions without actionable issues', () => {
    const file: ReviewFile = {
      id: 'file-bank',
      uploadSessionId: 'session-1',
      originalFilename: '기업은행 거래내역조회.xlsx',
      fileType: 'excel',
      fileSize: 1024,
      status: 'matched',
      uploadedAt: '2026-06-03T22:38:00.000Z',
    }
    const validation = mockValidation({
      id: 'validation-satisfied',
      validationStatus: 'satisfied',
    })
    const session = mockSession({
      status: 'ready_for_accountant',
      latestAnalysisAt: '2026-06-03T22:39:00.000Z',
      files: [file],
      validations: [validation],
      validationFiles: [{
        id: 'link-satisfied',
        validationId: validation.id,
        uploadFileId: file.id,
        contribution: 'satisfied',
      }],
    })

    const derivedStatus = deriveSessionStatus({
      sessionStatus: session.status,
      session,
      latestAnalysisAt: session.latestAnalysisAt,
    })

    expect(derivedStatus.label).toBe('검증통과')
    expect(derivedStatus.tone).toBe('success')
  })
})

describe('formatRequestItemName', () => {
  it('shows only the material label without criterion description suffix', () => {
    expect(
      formatRequestItemName('통장 거래내역 (요청 항목): 해당 회계기간(2026-06)의 통장 거래내역 제출'),
    ).toBe('통장 거래내역')
  })
})

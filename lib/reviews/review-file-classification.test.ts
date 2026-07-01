import { describe, expect, it } from 'vitest'
import { classifyReviewFile } from './review-file-classification'
import type { ReviewAnalysisRun, ReviewFile, ReviewSession } from './review-workspace-types'

function mockFile(id: string, originalFilename: string): ReviewFile {
  return {
    id,
    uploadSessionId: 'session-1',
    originalFilename,
    fileType: 'excel',
    fileSize: 1024,
    status: 'matched',
    uploadedAt: '2026-06-03T22:38:00.000Z',
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
    confidence: 'high',
    consensusGroup: 'medium_confidence',
    status: 'completed',
    parsedOutput: JSON.stringify(parsedOutput),
    errorMessage: null,
    criteriaSummary: null,
    createdAt: '2026-06-03T22:39:00.000Z',
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
    expiresAt: '2026-06-23T23:59:00.000Z',
    createdAt: '2026-06-03T22:38:00.000Z',
    requestEmailSubject: '솔메이트 2026-06 기장 자료 요청드립니다',
    requestEmailBody: null,
    source: 'customer_upload',
    latestAnalysisAt: null,
    workType: 'bookkeeping',
    bookkeepingPeriodType: null,
    bookkeepingPeriodStart: null,
    bookkeepingPeriodEnd: null,
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
      label: '보충 필요',
      detail: '테스트',
      tone: 'warning',
    },
    completionKind: null,
    ...overrides,
  }
}

describe('classifyReviewFile', () => {
  it('classifies bank files as suitable bank statement material', () => {
    const file = mockFile('file-bank', '기업은행 거래내역조회-4~6월.xlsx')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '은행 거래내역',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '거래일자와 입출금액이 있는 통장 거래내역입니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('bank_statement')
  })

  it('uses AI unlinked reason text as document content before leaving a file unmatched', () => {
    const file = mockFile('file-bank-unlinked-reason', '농협.xls')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '기타 엑셀 자료',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '자동 연결 체크리스트 항목이 지정되지 않았습니다.',
        staff_unlinked_reason: '농협 보통예금 입출금 거래내역이므로 통장 거래내역으로 검토할 수 있습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('bank_statement')
  })

  it('classifies KCP files as suitable online sales and PG settlement material', () => {
    const file = mockFile('file-kcp', 'KCP-4~6월.xlsx')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: 'PG 정산 상세내역',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: 'KCP 정산일자와 정산예상금액이 있는 온라인 매출/PG 정산자료입니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('online_sales_pg_settlement')
  })

  it('classifies NaverPay files without transaction detail signal as unsuitable', () => {
    const file = mockFile('file-naver', '네이버페이-4~6월.xlsx')
    const classification = classifyReviewFile(file, mockSession([file]))

    expect(classification.status).toBe('unsuitable')
    expect(classification.criterionGroup).toBeNull()
    expect(classification.reason).toContain('월별 부가세 매출 집계표')
  })

  it('classifies photographed tax invoices from AI-read content rather than filename', () => {
    const file = mockFile('file-tax-photo', '2024.07.jpg')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '매입 세금계산서 사진',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '이미지에서 전자세금계산서 제목, 공급자/공급받는자, 작성일자와 금액을 확인했습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('purchase_tax_invoice')
  })

  it('keeps electronic tax invoices out of other evidence even when they include billing wording', () => {
    const file = mockFile('file-electronic-tax-invoice', '2024.07.jpg')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '전자세금계산서',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '이미지에서 전자세금계산서 제목, 승인번호, 공급자, 공급받는자, 청구 금액을 확인했습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('purchase_tax_invoice')
  })

  it('classifies internal ledger workbooks as journal entry material', () => {
    const file = mockFile('file-journal-workbook', '2026.일월육일 지출결의서.xlsx')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '지출결의서 형식 장부',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '시트에 일자, 적요, 입금, 출금, 잔액, 차용, 급여 항목이 정리되어 있습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('journal_entry_workbook')
  })

  it('classifies non-ledger expense approval files as other evidence', () => {
    const file = mockFile('file-expense-approval', '2026.지출결의서.xlsx')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '지출결의서',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '지출결의서와 자금 거래 내역이 혼재되어 있어 전표 입력 단계에서 개별 검토가 필요합니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('other_evidence')
  })

  it('classifies photographed utility receipts as other evidence from AI-read content', () => {
    const file = mockFile('file-maintenance-photo', '2024.7월납부.jpg')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '관리비 납부 영수증',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '이미지에서 관리비 납부 영수증, 납부월, 납부금액을 확인했습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('other_evidence')
  })

  it('marks AI-read management fee receipts outside the requested month as unsuitable even when filename says July', () => {
    const file = mockFile('file-maintenance-wrong-period', '2024.7월납부.jpg')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '관리비 납부확인서',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '이미지에서 관리비 납부확인서, 고지년월 2024-04, 수납일자 2024.08.02, 수납금액 351,510원을 확인했습니다.',
        risk_flags: [],
      }),
    ], {
      accountingPeriod: '2024-07',
    }))

    expect(classification.status).toBe('unsuitable')
    expect(classification.criterionGroup).toBeNull()
    expect(classification.reason).toContain('고지년월이 2024-04')
    expect(classification.reason).toContain('4월달 관리비로 판단됨')
    expect(classification.reason).toContain('요청기간 2024-07 자료에 해당하지 않습니다')
  })

  it('classifies telecom receipts paid by credit card as other evidence, not card statements', () => {
    const file = mockFile('file-telecom-receipt', '2024.07월분 도현우.jpg')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '통신비 납부 영수증',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '이미지에서 영수증(고객보관용), 납부일자, 통신비 청구액, 납부방법 신용카드 즉납을 확인했습니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('other_evidence')
  })

  it('does not classify date-only images without AI-read document evidence as PG material', () => {
    const file = mockFile('file-ambiguous-photo', '2024.07.jpg')
    const classification = classifyReviewFile(file, mockSession([file]))

    expect(classification.status).toBe('unmatched')
    expect(classification.criterionGroup).toBeNull()
  })

  it('uses structured unlinked reason fields to connect journal entry candidate files', () => {
    const file = mockFile('file-expense-resolution-ledger', '2026.일월육일 지출결의서.xlsx')
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '지출결의서',
        material_status: 'sufficient',
        routing_status: 'needs_review',
        explanation: '체크리스트 항목과 직접 연결되지 않습니다.',
        unmatch_reason_code: 'journal_entry_candidate',
        staff_unlinked_reason:
          '입출금 내역이 모두 포함되어 있어 지출결의서로 분류하기 어렵습니다. 요청자료 체크리스트와 연결되지 않으므로 귀속·전표 단계에서 검토하세요.',
      }),
    ]))

    expect(classification.status).toBe('suitable')
    expect(classification.criterionGroup).toBe('journal_entry_workbook')
  })

  it('passwordStatus=required 파일은 "비밀번호 필요"로 분류한다', () => {
    const file: ReviewFile = {
      ...mockFile('file-password', '급여대장_2026-06.xlsx'),
      status: 'needs_review',
      passwordStatus: 'required',
    }
    const classification = classifyReviewFile(file, mockSession([file]))

    expect(classification.status).toBe('password_required')
    expect(classification.label).toBe('비밀번호 필요')
    expect(classification.criterionGroup).toBeNull()
  })

  it('passwordStatus=invalid 파일은 "비밀번호 오류"로 분류한다', () => {
    const file: ReviewFile = {
      ...mockFile('file-password-invalid', '급여대장_2026-06.xlsx'),
      status: 'needs_review',
      passwordStatus: 'invalid',
    }
    const classification = classifyReviewFile(file, mockSession([file]))

    expect(classification.status).toBe('password_invalid')
    expect(classification.label).toBe('비밀번호 오류')
    expect(classification.criterionGroup).toBeNull()
  })

  it('passwordStatus=required는 analysis_run이 있어도 우선해 "비밀번호 필요"로 분류한다', () => {
    const file: ReviewFile = {
      ...mockFile('file-password-with-run', '통장사본.xlsx'),
      passwordStatus: 'required',
    }
    const classification = classifyReviewFile(file, mockSession([file], [
      mockRun(file, {
        detected_file_type: '은행 거래내역',
        material_status: 'sufficient',
        routing_status: 'matched_candidate',
        explanation: '통장 거래내역입니다.',
        risk_flags: [],
      }),
    ]))

    expect(classification.status).toBe('password_required')
    expect(classification.criterionGroup).toBeNull()
  })
})

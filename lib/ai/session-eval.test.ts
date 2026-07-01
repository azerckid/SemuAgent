import { describe, expect, it } from 'vitest'
import { applyDeterministicDefaultCriteriaLinks } from './session-eval-default-links'
import { normalizeEvaluationFilenameKey } from './filename-normalization'

describe('session evaluation filename matching', () => {
  it('normalizes macOS decomposed Korean filenames to match AI returned composed filenames', () => {
    const storedFilename = '우리은행 거래내역조회(102)-4~6월.xlsx'
    const aiReturnedFilename = '우리은행 거래내역조회(102)-4~6월.xlsx'

    expect(normalizeEvaluationFilenameKey(storedFilename)).toBe(
      normalizeEvaluationFilenameKey(aiReturnedFilename),
    )
  })
})

describe('applyDeterministicDefaultCriteriaLinks', () => {
  it('links bank and PG files to bookkeeping requested-material rows and excludes unsuitable files', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '기업은행 거래내역조회-4~6월.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '은행 거래내역',
          explanation: '거래일자와 입출금액이 있는 통장 거래내역입니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
        {
          filename: '우리은행 거래내역조회(102)-4~6월.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '은행 거래내역',
          explanation: '거래일자와 입출금액이 있는 통장 거래내역입니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
        {
          filename: 'KCP-4~6월.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: 'PG 정산 상세내역',
          explanation: 'KCP 정산일자와 정산예상금액이 있는 온라인 매출/PG 정산자료입니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
        {
          filename: '네이버페이-4~6월.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '월별 부가세 매출 집계표',
          explanation: '거래 단위 상세내역이 아닌 월별 신고 집계표입니다.',
          materialStatus: 'insufficient',
          routingStatus: 'needs_review',
          confidence: 'high',
          riskFlags: ['not_transaction_detail'],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: '기장 요청자료 일부가 누락되었습니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '통장 거래내역: 해당 회계기간의 통장 거래내역 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: '통장 거래내역 제출 요청',
            confidence: 'medium',
          },
          {
            criterion_text: '온라인 매출/PG 정산자료: 스마트스토어, 오픈마켓, KCP, 네이버페이 등 온라인 매출과 PG 정산자료 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: ['네이버페이-4~6월.xlsx'],
            reason: '업로드 없음',
            requested_action: '온라인 매출/PG 정산자료 제출 요청',
            confidence: 'medium',
          },
          {
            criterion_text: '카드 사용내역: 해당 회계기간의 카드 사용내역 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: '카드 사용내역 제출 요청',
            confidence: 'medium',
          },
        ],
      },
    })

    const bankCriterion = evaluation.criteria[0]
    const pgCriterion = evaluation.criteria[1]
    const cardCriterion = evaluation.criteria[2]

    expect(bankCriterion.status).toBe('satisfied')
    expect(bankCriterion.related_filenames).toEqual([
      '기업은행 거래내역조회-4~6월.xlsx',
      '우리은행 거래내역조회(102)-4~6월.xlsx',
    ])
    expect(pgCriterion.status).toBe('satisfied')
    expect(pgCriterion.related_filenames).toEqual(['KCP-4~6월.xlsx'])
    expect(cardCriterion.status).toBe('missing')
    expect(evaluation.overall_verdict).toBe('needs_resubmission')
  })

  it('links photographed bookkeeping files by AI-read document type, not folder or date-only filename', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2024.07.jpg',
          fileType: 'image',
          status: 'completed',
          detectedFileType: '매입 세금계산서 사진',
          explanation: '이미지에서 전자세금계산서 제목, 공급자/공급받는자, 작성일자와 합계금액을 확인했습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
        {
          filename: '2024.7월납부.jpg',
          fileType: 'image',
          status: 'completed',
          detectedFileType: '관리비 납부 영수증',
          explanation: '이미지에서 관리비 납부월, 납부금액, 납부처를 확인했습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: '기장 요청자료 일부가 누락되었습니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '매입 세금계산서: 해당 회계기간의 매입 세금계산서 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: '매입 세금계산서 제출 요청',
            confidence: 'medium',
          },
          {
            criterion_text: '온라인 매출/PG 정산자료: 스마트스토어, 오픈마켓, KCP, 네이버페이 등 온라인 매출과 PG 정산자료 제출',
            criterion_type: 'material',
            status: 'satisfied',
            related_filenames: ['2024.07.jpg', '2024.7월납부.jpg'],
            reason: '잘못된 AI 응답: 세금계산서와 관리비 영수증을 PG로 연결했습니다.',
            requested_action: null,
            confidence: 'high',
          },
          {
            criterion_text: '기타 증빙자료: 특이 거래나 추가 확인이 필요한 경우 보조 증빙자료 제출',
            criterion_type: 'material',
            status: 'satisfied',
            related_filenames: [],
            reason: '선택 자료입니다.',
            requested_action: null,
            confidence: 'medium',
          },
        ],
      },
    })

    const purchaseTaxInvoiceCriterion = evaluation.criteria[0]
    const pgCriterion = evaluation.criteria[1]
    const otherEvidenceCriterion = evaluation.criteria[2]

    expect(purchaseTaxInvoiceCriterion.status).toBe('satisfied')
    expect(purchaseTaxInvoiceCriterion.related_filenames).toEqual(['2024.07.jpg'])
    expect(pgCriterion.status).toBe('missing')
    expect(pgCriterion.related_filenames).toEqual([])
    expect(pgCriterion.requested_action).toContain('온라인 매출/PG 정산자료')
    expect(otherEvidenceCriterion.status).toBe('satisfied')
    expect(otherEvidenceCriterion.related_filenames).toEqual(['2024.7월납부.jpg'])
  })

  it('prioritizes electronic tax invoices over generic receipt or billing evidence', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2024.07.jpg',
          fileType: 'image',
          status: 'completed',
          detectedFileType: '전자세금계산서',
          explanation: '이미지에서 전자세금계산서 제목, 승인번호, 공급자, 공급받는자, 청구 금액을 확인했습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: '기장 요청자료 일부가 누락되었습니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '매입 세금계산서: 해당 회계기간의 매입 세금계산서 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: '매입 세금계산서 제출 요청',
            confidence: 'medium',
          },
          {
            criterion_text: '기타 증빙자료: 특이 거래나 추가 확인이 필요한 경우 보조 증빙자료 제출',
            criterion_type: 'material',
            status: 'satisfied',
            related_filenames: ['2024.07.jpg'],
            reason: '잘못된 AI 응답: 전자세금계산서를 기타 증빙자료로 연결했습니다.',
            requested_action: null,
            confidence: 'high',
          },
        ],
      },
    })

    const purchaseTaxInvoiceCriterion = evaluation.criteria[0]
    const otherEvidenceCriterion = evaluation.criteria[1]

    expect(purchaseTaxInvoiceCriterion.status).toBe('satisfied')
    expect(purchaseTaxInvoiceCriterion.related_filenames).toEqual(['2024.07.jpg'])
    expect(otherEvidenceCriterion.related_filenames).toEqual([])
  })

  it('does not treat telecom or maintenance receipts as card statements just because they were paid by card', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2024.07월분 도현우.jpg',
          fileType: 'image',
          status: 'completed',
          detectedFileType: '통신비 납부 영수증',
          explanation: '이미지에서 영수증(고객보관용), 납부일자, 영수금액, 납부방법 신용카드 즉납을 확인했습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
        {
          filename: '2024.7월납부.jpg',
          fileType: 'image',
          status: 'completed',
          detectedFileType: '관리비 납부 영수증',
          explanation: '이미지에서 관리비 청구서 겸 납부영수증과 카드 결제 표시를 확인했습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: '기장 요청자료 일부가 누락되었습니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '카드 사용내역: 해당 회계기간의 카드 사용내역 제출',
            criterion_type: 'material',
            status: 'satisfied',
            related_filenames: ['2024.07월분 도현우.jpg', '2024.7월납부.jpg'],
            reason: '잘못된 AI 응답: 신용카드 결제 문구를 카드 사용내역으로 보았습니다.',
            requested_action: null,
            confidence: 'high',
          },
          {
            criterion_text: '기타 증빙자료: 특이 거래나 추가 확인이 필요한 경우 보조 증빙자료 제출',
            criterion_type: 'material',
            status: 'satisfied',
            related_filenames: [],
            reason: '선택 자료입니다.',
            requested_action: null,
            confidence: 'medium',
          },
        ],
      },
    })

    const cardCriterion = evaluation.criteria[0]
    const otherEvidenceCriterion = evaluation.criteria[1]

    expect(cardCriterion.status).toBe('missing')
    expect(cardCriterion.related_filenames).toEqual([])
    expect(otherEvidenceCriterion.status).toBe('satisfied')
    expect(otherEvidenceCriterion.related_filenames).toEqual([
      '2024.07월분 도현우.jpg',
      '2024.7월납부.jpg',
    ])
  })

  it('links internal ledger workbooks to the optional journal entry criterion', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2026.일월육일 지출결의서.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '지출결의서 형식 장부',
          explanation: '시트에 일자, 적요, 입금, 출금, 잔액, 차용, 급여 항목이 정리되어 있습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'uncertain',
        summary: '기장 요청자료 검토 중입니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '전표·입출금 정리: 전표 작성·입출금 정리용 내부 장부(지출결의서 형식 포함) 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: null,
            confidence: 'medium',
          },
        ],
      },
    })

    const journalCriterion = evaluation.criteria[0]

    expect(journalCriterion.status).toBe('satisfied')
    expect(journalCriterion.related_filenames).toEqual(['2026.일월육일 지출결의서.xlsx'])
    expect(journalCriterion.reason).toContain('전표·입출금 정리')
  })

  it('adds missing default criteria and links journal workbooks when AI omits the row', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2026.일월육일 지출결의서.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '지출결의서 형식 장부',
          explanation: '시트에 일자, 적요, 입금, 출금, 잔액, 차용, 급여 항목이 정리되어 있습니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'high',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: 'AI가 일부 기본 기준 행을 누락했습니다.',
        applied_criteria_snapshot: null,
        criteria: [
          {
            criterion_text: '통장 거래내역: 해당 회계기간의 통장 거래내역 제출',
            criterion_type: 'material',
            status: 'missing',
            related_filenames: [],
            reason: '업로드 없음',
            requested_action: '통장 거래내역 제출 요청',
            confidence: 'medium',
          },
        ],
      },
    })

    const journalCriterion = evaluation.criteria.find((criterion) => (
      criterion.criterion_text.includes('전표·입출금 정리')
    ))
    const otherEvidenceCriterion = evaluation.criteria.find((criterion) => (
      criterion.criterion_text.includes('기타 증빙자료')
    ))

    expect(journalCriterion).toMatchObject({
      status: 'satisfied',
      related_filenames: ['2026.일월육일 지출결의서.xlsx'],
      requested_action: null,
      confidence: 'high',
    })
    expect(otherEvidenceCriterion).toMatchObject({
      status: 'satisfied',
      related_filenames: [],
      requested_action: null,
    })
  })

  it('links non-ledger expense approval files to other evidence', () => {
    const evaluation = applyDeterministicDefaultCriteriaLinks({
      workType: 'bookkeeping',
      fileSummaries: [
        {
          filename: '2026.지출결의서.xlsx',
          fileType: 'excel',
          status: 'completed',
          detectedFileType: '지출결의서',
          explanation: '지출결의서와 자금 거래 내역이 혼재되어 있어 전표 입력 단계에서 개별 검토가 필요합니다.',
          materialStatus: 'sufficient',
          routingStatus: 'matched_candidate',
          confidence: 'medium',
          riskFlags: [],
        },
      ],
      evaluation: {
        overall_verdict: 'needs_resubmission',
        summary: 'AI가 일부 기본 기준 행을 누락했습니다.',
        applied_criteria_snapshot: null,
        criteria: [],
      },
    })

    const journalCriterion = evaluation.criteria.find((criterion) => (
      criterion.criterion_text.includes('전표·입출금 정리')
    ))
    const otherEvidenceCriterion = evaluation.criteria.find((criterion) => (
      criterion.criterion_text.includes('기타 증빙자료')
    ))

    expect(journalCriterion).toMatchObject({
      status: 'satisfied',
      related_filenames: [],
    })
    expect(otherEvidenceCriterion).toMatchObject({
      status: 'satisfied',
      related_filenames: ['2026.지출결의서.xlsx'],
    })
  })
})

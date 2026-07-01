import { describe, expect, it } from 'vitest'
import { resolveUploadPortalStatus } from './portal-status'

const checklistItems = [
  { id: 'item-bank', name: '통장 거래내역', required: true },
  { id: 'item-card', name: '카드 사용내역', required: true },
  { id: 'item-online', name: '온라인 매출/PG 정산자료', required: true },
]

const session = {
  id: 'session-1',
  accountingPeriod: '2026-06',
  status: 'active',
  requestKind: 'general' as const,
  bookkeepingPeriodType: 'monthly' as const,
}

describe('resolveUploadPortalStatus', () => {
  it('uses request item validation links so the upload portal agrees with the review material status popup', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-bank-1', originalFilename: '우리은행 거래내역조회(102)-4~6월.xlsx', status: 'needs_review' },
        { id: 'file-bank-2', originalFilename: '기업은행 거래내역조회-4~6월.xlsx', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [{
        id: 'validation-bank',
        itemName: '통장 거래내역: 해당 회계기간의 통장 거래내역 제출',
        criterionType: 'material',
        validationStatus: 'satisfied',
      }],
      requestItemValidationFiles: [
        { validationId: 'validation-bank', uploadFileId: 'file-bank-1', contribution: 'satisfied' },
        { validationId: 'validation-bank', uploadFileId: 'file-bank-2', contribution: 'satisfied' },
      ],
      analysisRuns: [],
    })

    expect(result.checklistItems.find((item) => item.id === 'item-bank')).toMatchObject({
      status: 'completed',
      matchedFilename: '우리은행 거래내역조회(102)-4~6월.xlsx 외 1개',
    })
    expect(result.matchedItemNameByFileId.get('file-bank-1')).toBe('통장 거래내역')
    expect(result.matchedItemNameByFileId.get('file-bank-2')).toBe('통장 거래내역')
    expect(result.unlinkedFileIds.size).toBe(0)
  })

  it('shows linked but not satisfied validation rows as staff review instead of pending', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-card', originalFilename: '카드내역.xlsx', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [{
        id: 'validation-card',
        itemName: '카드 사용내역',
        criterionType: 'material',
        validationStatus: 'non_compliant',
      }],
      requestItemValidationFiles: [
        { validationId: 'validation-card', uploadFileId: 'file-card', contribution: 'partial' },
      ],
      analysisRuns: [],
    })

    expect(result.checklistItems.find((item) => item.id === 'item-card')).toMatchObject({
      status: 'needs_review',
      matchedFilename: '카드내역.xlsx',
    })
    expect(result.matchedItemNameByFileId.get('file-card')).toBeUndefined()
    expect(result.unlinkedFileIds.has('file-card')).toBe(false)
  })

  it('falls back to pending when neither matches nor validation links exist', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-other', originalFilename: '참고자료.xlsx', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [],
      requestItemValidationFiles: [],
      analysisRuns: [],
    })

    expect(result.checklistItems.map((item) => item.status)).toEqual(['pending', 'pending', 'pending'])
    expect(result.unlinkedFileIds.has('file-other')).toBe(true)
  })

  it('falls back to request validations when the client checklist assignment is missing', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems: [],
      uploadedFiles: [
        { id: 'file-bank', originalFilename: '하나은행2024.01.01-12.31.xlsx', status: 'needs_review' },
        { id: 'file-tax', originalFilename: '2024.07.jpg', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [
        {
          id: 'validation-bank',
          itemName: '통장 거래내역: 해당 회계기간의 통장 거래내역 제출',
          itemGroup: 'bank_statement',
          criterionType: 'material',
          validationStatus: 'satisfied',
        },
        {
          id: 'validation-purchase-tax',
          itemName: '매입 세금계산서',
          itemGroup: 'purchase_tax_invoice',
          criterionType: 'material',
          validationStatus: 'satisfied',
        },
        {
          id: 'validation-cash',
          itemName: '현금영수증',
          itemGroup: 'cash_receipt',
          criterionType: 'material',
          validationStatus: 'missing',
        },
      ],
      requestItemValidationFiles: [
        { validationId: 'validation-bank', uploadFileId: 'file-bank', contribution: 'satisfied' },
        { validationId: 'validation-purchase-tax', uploadFileId: 'file-tax', contribution: 'satisfied' },
      ],
      analysisRuns: [],
    })

    expect(result.checklistItems).toEqual([
      expect.objectContaining({
        id: 'validation:validation-bank',
        name: '통장 거래내역',
        status: 'completed',
        matchedFilename: '하나은행2024.01.01-12.31.xlsx',
        canDeclare: false,
      }),
      expect.objectContaining({
        id: 'validation:validation-purchase-tax',
        name: '매입 세금계산서',
        status: 'completed',
        matchedFilename: '2024.07.jpg',
        canDeclare: false,
      }),
      expect.objectContaining({
        id: 'validation:validation-cash',
        name: '현금영수증',
        status: 'pending',
        canDeclare: false,
      }),
    ])
    expect(result.matchedItemNameByFileId.get('file-bank')).toBe('통장 거래내역')
    expect(result.matchedItemNameByFileId.get('file-tax')).toBe('매입 세금계산서')
  })

  it('falls back to default bookkeeping items before any upload analysis exists', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems: [],
      uploadedFiles: [],
      materialMatches: [],
      requestItemValidations: [],
      requestItemValidationFiles: [],
      analysisRuns: [],
    })

    expect(result.checklistItems).toHaveLength(8)
    expect(result.checklistItems.slice(0, 6)).toEqual([
      expect.objectContaining({ id: 'default:bank_statement', name: '통장 거래내역', status: 'pending', canDeclare: false }),
      expect.objectContaining({ id: 'default:card_statement', name: '카드 사용내역', status: 'pending', canDeclare: false }),
      expect.objectContaining({ id: 'default:sales_tax_invoice', name: '매출 세금계산서', status: 'pending', canDeclare: false }),
      expect.objectContaining({ id: 'default:purchase_tax_invoice', name: '매입 세금계산서', status: 'pending', canDeclare: false }),
      expect.objectContaining({ id: 'default:cash_receipt', name: '현금영수증', status: 'pending', canDeclare: false }),
      expect.objectContaining({ id: 'default:online_sales_pg_settlement', name: '온라인 매출/PG 정산자료', status: 'pending', canDeclare: false }),
    ])
  })

  it('uses the same deterministic analysis correction as the review material status popup', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-bank', originalFilename: '우리은행 거래내역조회(102)-4~6월.xlsx', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [{
        id: 'validation-bank',
        itemName: '통장 거래내역',
        itemGroup: 'bank_statement',
        criterionType: 'material',
        validationStatus: 'uncertain',
      }],
      requestItemValidationFiles: [],
      analysisRuns: [{
        id: 'run-bank',
        uploadFileId: 'file-bank',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '은행 거래내역',
          explanation: '우리은행 통장 거래내역 파일입니다.',
          routing_status: 'needs_review',
          material_status: 'sufficient',
          risk_flags: [],
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-26T03:40:00.000+09:00',
      }],
    })

    expect(result.checklistItems.find((item) => item.id === 'item-bank')).toMatchObject({
      status: 'completed',
      matchedFilename: '우리은행 거래내역조회(102)-4~6월.xlsx',
    })
    expect(result.matchedItemNameByFileId.get('file-bank')).toBe('통장 거래내역')
    expect(result.unlinkedFileIds.has('file-bank')).toBe(false)
  })

  it('does not expose raw needs_review material matches when the review presentation has no submitted row', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-kcp', originalFilename: 'KCP-4~6월.xlsx', status: 'needs_review' },
      ],
      materialMatches: [{
        uploadFileId: 'file-kcp',
        checklistItemId: 'item-online',
        status: 'needs_review',
      }],
      requestItemValidations: [{
        id: 'validation-online',
        itemName: '온라인 매출/PG 정산자료',
        itemGroup: 'online_sales_pg_settlement',
        criterionType: 'material',
        validationStatus: 'uncertain',
      }],
      requestItemValidationFiles: [],
      analysisRuns: [],
    })

    const onlineItem = result.checklistItems.find((item) => item.id === 'item-online')
    expect(onlineItem).toMatchObject({ status: 'pending' })
    expect(onlineItem).not.toHaveProperty('matchedFilename')
    expect(result.matchedItemNameByFileId.get('file-kcp')).toBeUndefined()
    expect(result.unlinkedFileIds.has('file-kcp')).toBe(true)
  })

  it('surfaces review-presentation unlinked files without attaching them to checklist items', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        { id: 'file-naverpay', originalFilename: '네이버페이-4~6월.xlsx', status: 'needs_review' },
      ],
      materialMatches: [],
      requestItemValidations: [{
        id: 'validation-online',
        itemName: '온라인 매출/PG 정산자료',
        itemGroup: 'online_sales_pg_settlement',
        criterionType: 'material',
        validationStatus: 'missing',
      }],
      requestItemValidationFiles: [],
      analysisRuns: [{
        id: 'run-naverpay',
        uploadFileId: 'file-naverpay',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '월별 부가세 매출 집계표',
          explanation: '네이버페이 파일명이나 실제 내용은 거래 상세가 아니라 월별 집계표입니다.',
          routing_status: 'needs_review',
          material_status: 'insufficient',
          risk_flags: ['not_transaction_detail'],
          staff_unlinked_reason: '거래 상세가 아닌 월별 집계표라 요청자료 항목에 자동 연결하지 않습니다.',
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-26T03:40:00.000+09:00',
      }],
    })

    const onlineItem = result.checklistItems.find((item) => item.id === 'item-online')
    expect(onlineItem).toMatchObject({ status: 'pending' })
    expect(onlineItem).not.toHaveProperty('matchedFilename')
    expect(result.matchedItemNameByFileId.get('file-naverpay')).toBeUndefined()
    expect(result.unlinkedFileIds.has('file-naverpay')).toBe(true)
  })

  it('hides staff-excluded unlinked files from portal unlinked badges', () => {
    const result = resolveUploadPortalStatus({
      session,
      checklistItems,
      uploadedFiles: [
        {
          id: 'file-naverpay',
          originalFilename: '네이버페이-4~6월.xlsx',
          status: 'needs_review',
          staffReviewStatus: 'excluded',
        },
      ],
      materialMatches: [],
      requestItemValidations: [{
        id: 'validation-online',
        itemName: '온라인 매출/PG 정산자료',
        itemGroup: 'online_sales_pg_settlement',
        criterionType: 'material',
        validationStatus: 'missing',
      }],
      requestItemValidationFiles: [],
      analysisRuns: [{
        id: 'run-naverpay',
        uploadFileId: 'file-naverpay',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        confidence: 'high',
        consensusGroup: null,
        status: 'completed',
        parsedOutput: JSON.stringify({
          detected_file_type: '월별 부가세 매출 집계표',
          explanation: '네이버페이 파일명이나 실제 내용은 거래 상세가 아니라 월별 집계표입니다.',
          routing_status: 'needs_review',
          material_status: 'insufficient',
          risk_flags: ['not_transaction_detail'],
          staff_unlinked_reason: '거래 상세가 아닌 월별 집계표라 요청자료 항목에 자동 연결하지 않습니다.',
        }),
        errorMessage: null,
        criteriaSummary: null,
        createdAt: '2026-06-26T03:40:00.000+09:00',
      }],
    })

    expect(result.unlinkedFileIds.has('file-naverpay')).toBe(false)
  })
})

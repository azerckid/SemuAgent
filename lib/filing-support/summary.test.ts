import { describe, expect, it } from 'vitest'
import {
  buildChecklistItemId,
  buildDefaultFilingItemRecord,
  buildFilingPreparationValues,
  buildFilingItems,
  buildFilingPeriod,
  buildPayrollFilingSource,
  buildFilingReceipts,
  buildFilingChecklist,
  buildFilingItemId,
  formatKrw,
  type FilingSupportItem,
} from './summary'

const companyPeriod = {
  key: '2026-H1',
  label: '2026년 부가세 1기 확정 신고',
  startMonth: '2026-01',
  endMonth: '2026-06',
  filingDeadline: '2026-07-25',
  dDay: 23,
  progressPercent: 62,
} as const

const period = buildFilingPeriod(companyPeriod)

const payrollSource = {
  id: 'payroll-2026-06',
  employeeCount: 12,
  grossPayKrw: 42_600_000,
  withholdingTaxKrw: 2_100_000,
  incomeTaxKrw: 1_910_000,
  localIncomeTaxKrw: 190_000,
  socialInsuranceKrw: 3_740_000,
  noticeImportStatus: 'partial',
  closeStatus: 'closed',
  issueCount: 1,
  withholdingStatementStatus: 'generated',
  insuranceStatementStatus: 'ready',
} as const

function buildPreviewItems() {
  return buildFilingItems({
    tenantId: 'tenant-1',
    clientId: 'business-1',
    period,
    vat: {
      id: 'vat-2026-h1',
      payableTaxKrw: 14_000_000,
      pendingDeductionCount: 3,
      packageStatus: 'locked',
      packageStorageKey: null,
    },
    payroll: payrollSource,
  })
}

describe('filing period and ids', () => {
  it('maps a VAT filing period to the linked payroll period (S-10)', () => {
    expect(period).toEqual({
      filingPeriodKey: '2026-H1',
      filingLabel: '2026년 1기',
      payrollPeriodKey: '2026-06',
      payrollLabel: '2026년 6월 귀속',
    })
  })

  it('builds stable tenant/business scoped ids (S-13, S-14)', () => {
    expect(buildFilingItemId({
      tenantId: 'tenant.1',
      clientId: 'business/1',
      filingPeriodKey: '2026-H1',
      itemType: 'vat',
    })).toBe('filing_item__tenant_1__business_1__2026-H1__vat')

    expect(buildChecklistItemId({
      tenantId: 'tenant.1',
      clientId: 'business/1',
      filingPeriodKey: '2026-H1',
      code: 'vat_payment',
    })).toBe('filing_checklist__tenant_1__business_1__2026-H1__vat_payment')
  })
})

describe('filing support item derivation', () => {
  it('reproduces the approved preview item states from VAT/payroll artifacts (S-03, S-20, S-22, S-23)', () => {
    const [vatItem, withholdingItem, insuranceItem] = buildPreviewItems()

    expect(vatItem).toMatchObject({
      type: 'vat',
      title: '2026년 1기 부가가치세 (확정)',
      status: 'locked',
      packageStatus: 'locked',
      primaryActionLabel: '패키지 · 잠김',
      secondaryHref: '/dashboard/vat?period=2026-H1',
      tone: 'warn',
    })
    expect(vatItem.lockReason).toContain('공제 검토 3건')

    expect(withholdingItem).toMatchObject({
      type: 'withholding',
      status: 'ready',
      packageStatus: 'generated',
      primaryActionLabel: '패키지 열기',
      secondaryHref: '/dashboard/payroll?period=2026-06',
      tone: 'ok',
    })

    expect(insuranceItem).toMatchObject({
      type: 'social_insurance',
      status: 'needs_review',
      packageStatus: 'locked',
      primaryActionLabel: '자료 확인',
      tone: 'warn',
    })
  })

  it('marks submitted items from filing records without exposing storage keys (S-41, S-44)', () => {
    const submittedVatId = buildFilingItemId({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      filingPeriodKey: '2026-H1',
      itemType: 'vat',
    })
    const [vatItem] = buildFilingItems({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      period,
      vat: {
        id: 'vat-2026-h1',
        payableTaxKrw: 14_000_000,
        pendingDeductionCount: 0,
        packageStatus: 'generated',
        packageStorageKey: 'private/blob/key.pdf',
      },
      payroll: null,
      overrides: [{
        id: submittedVatId,
        itemType: 'vat',
        status: 'submitted',
        packageStatus: 'submitted',
        lockReason: null,
        packageStorageKey: 'private/blob/key.pdf',
        submittedAt: '2026-07-20T09:00:00.000Z',
      }],
    })

    expect(vatItem).toMatchObject({
      status: 'submitted',
      packageStatus: 'submitted',
      primaryActionLabel: '접수증 보기',
      tone: 'ok',
    })
    expect(JSON.stringify(vatItem)).not.toContain('private/blob/key.pdf')
  })

  it('unlocks the VAT package when all deduction reviews are complete (S-21)', () => {
    const [vatItem] = buildFilingItems({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      period,
      vat: {
        id: 'vat-2026-h1',
        payableTaxKrw: 14_000_000,
        pendingDeductionCount: 0,
        packageStatus: 'ready',
        packageStorageKey: null,
      },
      payroll: null,
    })

    expect(vatItem).toMatchObject({
      status: 'ready',
      packageStatus: 'ready',
      primaryActionLabel: '패키지 열기',
      lockReason: null,
    })
  })
})

describe('filing preparation values', () => {
  it('keeps payroll summary totals while injecting actual income/local taxes (S-30~34)', () => {
    const merged = buildPayrollFilingSource(
      { ...payrollSource, withholdingTaxKrw: 9_999_999 },
      { incomeTaxKrw: 1_910_000, localIncomeTaxKrw: 190_000 },
    )

    expect(merged.employeeCount).toBe(12)
    expect(merged.grossPayKrw).toBe(42_600_000)
    expect(merged.withholdingTaxKrw).toBe(9_999_999)
    expect(merged.incomeTaxKrw).toBe(1_910_000)
    expect(merged.localIncomeTaxKrw).toBe(190_000)
  })

  it('uses actual payroll income/local tax values without 10/11 approximation (S-30~34)', () => {
    const [, withholdingItem] = buildPreviewItems()
    const guide = buildFilingPreparationValues({
      period,
      payroll: { ...payrollSource, withholdingTaxKrw: 9_999_999 },
      withholdingItem,
    })

    expect(guide.description).toContain('자동 제출 아님')
    expect(guide.copyPayload).toContain('간이세액 대상: 12명')
    expect(guide.copyPayload).toContain('총지급액: 42,600,000원')
    expect(guide.copyPayload).toContain('징수세액: 1,910,000원')
    expect(guide.copyPayload).toContain('지방소득세: 190,000원')
    expect(guide.downloadActionLabel).toBe('지급명세서 다운로드')
  })
})

describe('filing receipts and checklist', () => {
  const items = buildPreviewItems()

  it('shows missing receipt placeholders and stored receipts without storage keys (S-40~44)', () => {
    const receipts = buildFilingReceipts({
      period,
      items,
      storedReceipts: [{
        id: 'receipt-1',
        filingItemId: items[1].id,
        receiptType: 'hometax_receipt',
        originalFilename: 'withholding-receipt.pdf',
        uploadedAt: '2026-07-10T11:30:00.000Z',
      }],
    })

    expect(receipts).toHaveLength(3)
    expect(receipts.find((receipt) => receipt.itemType === 'withholding')).toMatchObject({
      id: 'receipt-1',
      title: 'withholding-receipt.pdf',
      status: 'stored',
      description: '2026-07-10 제출 · 보관 완료',
    })
    expect(receipts.find((receipt) => receipt.itemType === 'vat')).toMatchObject({
      id: 'missing:vat',
      title: '2026년 1기 부가세 접수증',
      status: 'missing',
    })
    expect(JSON.stringify(receipts)).not.toContain('storageKey')
  })

  it('builds checklist rows with stored completion state (S-50~52)', () => {
    const completedId = buildChecklistItemId({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      filingPeriodKey: '2026-H1',
      code: 'withholding_payment',
    })
    const checklist = buildFilingChecklist({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      filingPeriodKey: '2026-H1',
      storedItems: [{ id: completedId, code: 'withholding_payment', completed: true }],
    })

    expect(checklist).toHaveLength(4)
    expect(checklist[0]).toMatchObject({
      id: completedId,
      code: 'withholding_payment',
      completed: true,
      itemType: 'withholding',
    })
    expect(checklist.find((item) => item.code === 'receipts_archived')).toMatchObject({
      completed: false,
      itemType: null,
    })
  })
})

describe('filing item persistence shape', () => {
  it('uses the read-model item as the default filing record snapshot', () => {
    const [vatItem] = buildPreviewItems() as FilingSupportItem[]
    const record = buildDefaultFilingItemRecord({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      period,
      item: vatItem,
      timestamp: '2026-07-02T12:00:00.000Z',
    })

    expect(record).toMatchObject({
      tenantId: 'tenant-1',
      clientId: 'business-1',
      filingPeriodKey: '2026-H1',
      payrollPeriodKey: '2026-06',
      itemType: 'vat',
      status: 'locked',
      packageStatus: 'locked',
      packageStorageKey: null,
    })
    expect(formatKrw(14_000_000)).toBe('14,000,000원')
  })
})

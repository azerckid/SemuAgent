import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildVatDeductionReviewRow,
  buildVatPackagePreview,
  buildVatPeriodRecalculation,
  buildVatSalesGroups,
  buildVatSchedules,
  buildVatTaxSummary,
  calculateDeductibleInputTax,
  isVatInputTaxLine,
  isVatOutputTaxLine,
  normalizeVatDeductionDecision,
  normalizeVatDeductionKind,
  vatDeductionActionLabels,
  vatDeductionTone,
  type VatTaxSummary,
} from './summary'

const period = {
  key: '2026-H1',
  filingDeadline: '2026-07-25',
  dDay: 23,
} as const

describe('VAT account line detection', () => {
  it('detects output and input VAT by account code or Korean account name (S-11, S-12)', () => {
    expect(isVatOutputTaxLine({ side: 'credit', accountCode: '255', accountName: null })).toBe(true)
    expect(isVatOutputTaxLine({ side: 'credit', accountCode: null, accountName: '부가세예수금' })).toBe(true)
    expect(isVatOutputTaxLine({ side: 'debit', accountCode: '255', accountName: null })).toBe(false)

    expect(isVatInputTaxLine({ side: 'debit', accountCode: '135', accountName: null })).toBe(true)
    expect(isVatInputTaxLine({ side: 'debit', accountCode: null, accountName: '부가세대급금' })).toBe(true)
    expect(isVatInputTaxLine({ side: 'credit', accountCode: '135', accountName: null })).toBe(false)
  })
})

describe('VAT tax derivation', () => {
  it('derives deductible input tax from decisions and payable = output - deductible input (S-20~22)', () => {
    const reviews = [
      { decision: 'deductible', inputTaxKrw: 8_000_000, prorationRateBps: null },
      { decision: 'prorated', inputTaxKrw: 20_000_000, prorationRateBps: 5_000 },
      { decision: 'pending', inputTaxKrw: 1_000_000, prorationRateBps: null },
      { decision: 'non_deductible', inputTaxKrw: 2_000_000, prorationRateBps: null },
    ]

    expect(calculateDeductibleInputTax(reviews)).toBe(18_000_000)
    expect(buildVatTaxSummary({
      outputTaxKrw: 32_000_000,
      inputTaxKrw: 31_000_000,
      inputTaxDeductibleKrw: 0,
      pendingDeductionCount: 99,
      isFinal: false,
    }, period, reviews)).toMatchObject({
      outputTaxKrw: 32_000_000,
      inputTaxKrw: 31_000_000,
      inputTaxDeductibleKrw: 18_000_000,
      payableTaxKrw: 14_000_000,
      pendingDeductionCount: 1,
      filingDeadline: '2026-07-25',
      dDay: 23,
    })
  })

  it('uses stored deductible input tax when there are no review rows yet', () => {
    expect(buildVatTaxSummary({
      outputTaxKrw: 32_000_000,
      inputTaxKrw: 18_000_000,
      inputTaxDeductibleKrw: 18_000_000,
      pendingDeductionCount: 0,
      isFinal: true,
    }, period)).toMatchObject({
      payableTaxKrw: 14_000_000,
      pendingDeductionCount: 0,
      isFinal: true,
    })
  })

  it('recalculates period summary after deduction mutations (S-51, S-52, S-64)', () => {
    expect(buildVatPeriodRecalculation({
      outputTaxKrw: 32_000_000,
      packageStatus: 'locked',
    }, [
      { decision: 'deductible', inputTaxKrw: 10_000_000, prorationRateBps: null },
      { decision: 'prorated', inputTaxKrw: 16_000_000, prorationRateBps: 5_000 },
      { decision: 'non_deductible', inputTaxKrw: 2_000_000, prorationRateBps: null },
    ])).toEqual({
      inputTaxDeductibleKrw: 18_000_000,
      payableTaxKrw: 14_000_000,
      pendingDeductionCount: 0,
      packageStatus: 'ready',
    })

    expect(buildVatPeriodRecalculation({
      outputTaxKrw: 32_000_000,
      packageStatus: 'generated',
    }, [
      { decision: 'deductible', inputTaxKrw: 18_000_000, prorationRateBps: null },
    ])).toMatchObject({
      packageStatus: 'generated',
    })
  })
})

describe('VAT sales groups', () => {
  it('keeps taxable/zero-rated/exempt sales as three explicit groups (S-30)', () => {
    expect(buildVatSalesGroups({
      taxableSupplyKrw: 320_000_000,
      taxableOutputTaxKrw: 32_000_000,
      zeroRatedSupplyKrw: 12_000_000,
      exemptSupplyKrw: 5_000_000,
    })).toEqual([
      { id: 'taxable', title: '과세 매출', supplyAmountKrw: 320_000_000, outputTaxKrw: 32_000_000, tone: 'info' },
      { id: 'zero_rated', title: '영세율 매출', supplyAmountKrw: 12_000_000, outputTaxKrw: 0, tone: 'ok' },
      { id: 'exempt', title: '면세 매출', supplyAmountKrw: 5_000_000, outputTaxKrw: null, tone: 'warn' },
    ])
  })
})

describe('VAT deduction review rows', () => {
  it('normalizes unknown kind/decision to the safe pending deductible state', () => {
    expect(normalizeVatDeductionKind('weird')).toBe('deductible')
    expect(normalizeVatDeductionDecision('weird')).toBe('pending')
  })

  it('derives row actions and tones from kind/decision (S-40~42)', () => {
    expect(vatDeductionActionLabels('non_deductible_candidate', 'pending')).toEqual(['불공제 확정', '공제'])
    expect(vatDeductionActionLabels('proration_required', 'pending')).toEqual(['안분 계산', '공제'])
    expect(vatDeductionActionLabels('deductible', 'pending')).toEqual(['공제 확정'])
    expect(vatDeductionActionLabels('deductible', 'deductible')).toEqual(['확정됨'])

    expect(vatDeductionTone('non_deductible_candidate', 'pending')).toBe('danger')
    expect(vatDeductionTone('proration_required', 'pending')).toBe('warn')
    expect(vatDeductionTone('deductible', 'deductible')).toBe('ok')
  })

  it('maps DB rows into UI rows without changing source references', () => {
    expect(buildVatDeductionReviewRow({
      id: 'review-1',
      sourceVoucherId: 'voucher-1',
      sourceVoucherLineId: 'line-1',
      classificationRowId: 'class-1',
      description: '접대비 매입',
      counterparty: '식당',
      supplyAmountKrw: 1_000_000,
      inputTaxKrw: 100_000,
      kind: 'non_deductible_candidate',
      decision: 'pending',
      reason: '접대비 후보',
      prorationRateBps: null,
    })).toMatchObject({
      sourceVoucherId: 'voucher-1',
      sourceVoucherLineId: 'line-1',
      classificationRowId: 'class-1',
      actionLabels: ['불공제 확정', '공제'],
    })
  })
})

describe('VAT schedules and package lock', () => {
  const taxSummary: VatTaxSummary = {
    outputTaxKrw: 32_000_000,
    inputTaxKrw: 18_000_000,
    inputTaxDeductibleKrw: 18_000_000,
    payableTaxKrw: 14_000_000,
    pendingDeductionCount: 3,
    isFinal: false,
    filingDeadline: '2026-07-25',
    dDay: 23,
  }

  it('locks package generation until all deduction reviews are complete (S-60)', () => {
    expect(buildVatPackagePreview({
      period,
      taxSummary,
      hasSummary: true,
      packageStatus: 'locked',
      packageStorageKey: null,
    })).toMatchObject({
      locked: true,
      lockReason: '공제 검토 3건 완료 후 생성',
      canGenerate: false,
    })
  })

  it('locks package generation when the VAT summary itself is missing (S-81)', () => {
    expect(buildVatPackagePreview({
      period,
      taxSummary: { ...taxSummary, pendingDeductionCount: 0 },
      hasSummary: false,
      packageStatus: 'locked',
      packageStorageKey: null,
    })).toMatchObject({
      locked: true,
      lockReason: '기장검토 먼저 확정',
      canGenerate: false,
    })
  })

  it('allows generation when summary exists and pending review count is zero', () => {
    expect(buildVatPackagePreview({
      period,
      taxSummary: { ...taxSummary, pendingDeductionCount: 0 },
      hasSummary: true,
      packageStatus: 'ready',
      packageStorageKey: null,
    })).toMatchObject({
      locked: false,
      lockReason: null,
      canGenerate: true,
    })
  })

  it('derives schedule status from pending review categories', () => {
    const schedules = buildVatSchedules(taxSummary, [
      buildVatDeductionReviewRow({
        id: 'review-1',
        sourceVoucherId: null,
        sourceVoucherLineId: null,
        classificationRowId: null,
        description: '접대비',
        counterparty: null,
        supplyAmountKrw: 100_000,
        inputTaxKrw: 10_000,
        kind: 'non_deductible_candidate',
        decision: 'pending',
        reason: '',
        prorationRateBps: null,
      }),
      buildVatDeductionReviewRow({
        id: 'review-2',
        sourceVoucherId: null,
        sourceVoucherLineId: null,
        classificationRowId: null,
        description: '공통매입',
        counterparty: null,
        supplyAmountKrw: 200_000,
        inputTaxKrw: 20_000,
        kind: 'proration_required',
        decision: 'pending',
        reason: '',
        prorationRateBps: null,
      }),
    ])

    expect(schedules.find((schedule) => schedule.id === 'purchase_tax_invoice')?.statusLabel).toBe('검토 대기')
    expect(schedules.find((schedule) => schedule.id === 'card_receipt')?.statusLabel).toBe('안분 필요')
    expect(schedules.find((schedule) => schedule.id === 'non_deductible_input_tax')?.statusLabel).toBe('검토 대기')
  })
})

describe('VAT loader boundaries', () => {
  const source = readFileSync(new URL('./summary.ts', import.meta.url), 'utf8')

  it('scopes VAT summary and reviews by tenant, business entity, and period (S-13)', () => {
    expect(source).toContain('eq(vatPeriodSummary.tenantId, tenantId)')
    expect(source).toContain('eq(vatPeriodSummary.clientId, businessEntity.id)')
    expect(source).toContain('eq(vatPeriodSummary.periodKey, period.key)')
    expect(source).toContain('eq(vatDeductionReview.tenantId, tenantId)')
    expect(source).toContain('eq(vatDeductionReview.clientId, businessEntity.id)')
    expect(source).toContain('eq(vatDeductionReview.periodKey, period.key)')
  })

  it('does not import GIWA review workspace or excluded request/mail tables (S-70)', () => {
    expect(source).not.toContain('/dashboard/reviews')
    for (const id of ['requestTemplate', 'clientRequestSchedule', 'clientRequestEvent', 'outboundEmail', 'inboundEmail', 'staffMailbox']) {
      expect(source).not.toContain(id)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  GENERAL_BOOKKEEPING_DEFAULT_CRITERIA,
  GENERAL_VAT_DEFAULT_CRITERIA,
} from '@/lib/review/default-criteria-data'
import {
  buildFileItemGroupMap,
  buildSourceCollectionCompleteness,
  buildSourceCollectionImportRow,
  buildSourceCollectionMissingItems,
  buildSourceCollectionSourceTypeTiles,
  countNormalizationPendingFiles,
  mapItemGroupToSourceType,
  sortSourceCollectionImportRows,
} from './summary'

describe('buildSourceCollectionCompleteness', () => {
  it('derives progressPercent and highlights missing items (S-20)', () => {
    const rows = [
      ...Array.from({ length: 23 }, () => ({ validationStatus: 'satisfied' })),
      { validationStatus: 'missing' },
    ]

    const completeness = buildSourceCollectionCompleteness(rows)

    expect(completeness).toMatchObject({
      collectedCount: 23,
      requiredCount: 24,
      missingCount: 1,
    })
    expect(completeness.progressPercent).toBeGreaterThan(90)
    expect(completeness.progressPercent).toBeLessThan(100)
  })

  it('reaches full completeness when nothing is missing (S-21)', () => {
    const rows = Array.from({ length: 4 }, () => ({ validationStatus: 'satisfied' }))

    expect(buildSourceCollectionCompleteness(rows)).toMatchObject({
      missingCount: 0,
      progressPercent: 100,
      normalizationPendingCount: 0,
    })
  })

  it('does not imply completion before any collection criteria exist', () => {
    expect(buildSourceCollectionCompleteness([])).toMatchObject({
      collectedCount: 0,
      requiredCount: 0,
      missingCount: 0,
      progressPercent: 0,
    })
  })

  it('counts normalization-pending files for completeness meta (Preview parity)', () => {
    const rows = Array.from({ length: 4 }, () => ({ validationStatus: 'satisfied' }))
    const files = [
      { status: 'analyzing' },
      { status: 'uploaded' },
      { status: 'matched' },
    ]

    expect(buildSourceCollectionCompleteness(rows, files)).toMatchObject({
      normalizationPendingCount: 2,
    })
    expect(countNormalizationPendingFiles(files)).toBe(2)
  })

  it('treats uncertain rows as review-needed, not missing material', () => {
    const rows = [
      { validationStatus: 'satisfied' },
      { validationStatus: 'uncertain' },
      { validationStatus: 'non_compliant' },
    ]

    expect(buildSourceCollectionCompleteness(rows)).toMatchObject({
      collectedCount: 2,
      requiredCount: 3,
      missingCount: 1,
      normalizationPendingCount: 1,
    })
  })
})

describe('mapItemGroupToSourceType', () => {
  it('maps known item groups to source types', () => {
    expect(mapItemGroupToSourceType('bank_statement')).toBe('bank_statement')
    expect(mapItemGroupToSourceType('card_statement')).toBe('card_purchase')
    expect(mapItemGroupToSourceType('vat_business_card_purchase')).toBe('card_purchase')
    expect(mapItemGroupToSourceType('sales_tax_invoice')).toBe('tax_invoice')
    expect(mapItemGroupToSourceType('vat_sales_tax_invoice')).toBe('tax_invoice')
  })

  it('falls back to unknown for unmapped or missing groups', () => {
    expect(mapItemGroupToSourceType('some_new_group')).toBe('unknown')
    expect(mapItemGroupToSourceType(null)).toBe('unknown')
  })

  it('maps every real default bookkeeping/VAT criterion item_group to a canonical source type (P1)', () => {
    const allItemGroups = [
      ...GENERAL_BOOKKEEPING_DEFAULT_CRITERIA,
      ...GENERAL_VAT_DEFAULT_CRITERIA,
    ].map((criterion) => criterion.itemGroup)

    expect(allItemGroups.length).toBeGreaterThan(0)
    for (const itemGroup of allItemGroups) {
      expect(mapItemGroupToSourceType(itemGroup)).not.toBe('unknown')
    }
  })
})

describe('buildSourceCollectionSourceTypeTiles', () => {
  it('marks a fully satisfied group as ok (S-30)', () => {
    const rows = Array.from({ length: 8 }, () => ({ itemGroup: 'sales_tax_invoice', validationStatus: 'satisfied' }))
    const tiles = buildSourceCollectionSourceTypeTiles(rows)

    expect(tiles.find((tile) => tile.id === 'tax_invoice')).toMatchObject({
      collectedCount: 8,
      requiredCount: 8,
      tone: 'ok',
    })
  })

  it('marks a group with missing rows as warn (S-31)', () => {
    const rows = [
      { itemGroup: 'card_statement', validationStatus: 'satisfied' },
      { itemGroup: 'card_statement', validationStatus: 'satisfied' },
      { itemGroup: 'card_statement', validationStatus: 'missing' },
    ]
    const tiles = buildSourceCollectionSourceTypeTiles(rows)

    expect(tiles.find((tile) => tile.id === 'card_purchase')).toMatchObject({
      collectedCount: 2,
      requiredCount: 3,
      tone: 'warn',
      statusLabel: '1건 미수집',
    })
  })

  it('folds unmapped item groups into receipt_other without throwing (S-32)', () => {
    const rows = [{ itemGroup: 'some_unclassified_group', validationStatus: 'satisfied' }]

    expect(() => buildSourceCollectionSourceTypeTiles(rows)).not.toThrow()
    const tiles = buildSourceCollectionSourceTypeTiles(rows)
    expect(tiles.find((tile) => tile.id === 'receipt_other')).toMatchObject({
      requiredCount: 1,
      tone: 'ok',
    })
  })

  it('shows normalization pending on a tile when files are still processing (Preview blue chip)', () => {
    const rows = [
      ...Array.from({ length: 6 }, () => ({ itemGroup: 'other_evidence', validationStatus: 'satisfied' })),
      ...Array.from({ length: 3 }, () => ({ itemGroup: 'other_evidence', validationStatus: 'uncertain' })),
    ]
    const files = [
      { status: 'analyzing', sourceType: 'receipt_other' as const },
      { status: 'uploaded', sourceType: 'receipt_other' as const },
      { status: 'uploaded', sourceType: 'receipt_other' as const },
      { status: 'matched', sourceType: 'receipt_other' as const },
    ]

    expect(buildSourceCollectionSourceTypeTiles(rows, files).find((tile) => tile.id === 'receipt_other')).toMatchObject({
      collectedCount: 9,
      requiredCount: 9,
      tone: 'info',
      statusLabel: '정규화 대기 3',
    })
  })

  it('prefers missing warn tone over normalization pending info', () => {
    const rows = [
      { itemGroup: 'card_statement', validationStatus: 'satisfied' },
      { itemGroup: 'card_statement', validationStatus: 'missing' },
    ]
    const files = [{ status: 'analyzing', sourceType: 'card_purchase' as const }]

    expect(buildSourceCollectionSourceTypeTiles(rows, files).find((tile) => tile.id === 'card_purchase')).toMatchObject({
      tone: 'warn',
      statusLabel: '1건 미수집',
    })
  })

  it('always returns exactly the four canonical tiles', () => {
    const tiles = buildSourceCollectionSourceTypeTiles([])
    expect(tiles.map((tile) => tile.id)).toEqual(['tax_invoice', 'bank_statement', 'card_purchase', 'receipt_other'])
    expect(tiles.every((tile) => tile.tone === 'muted')).toBe(true)
  })
})

describe('buildSourceCollectionImportRow', () => {
  it('derives a safe title without exposing the original filename (S-40)', () => {
    const row = buildSourceCollectionImportRow(
      {
        id: 'file-1',
        uploadSessionId: 'session-1',
        fileType: 'excel',
        fileSize: 1_258_291,
        status: 'matched',
        passwordStatus: 'none',
        uploadedAt: '2026-06-30T10:00:00.000Z',
      },
      'tax_invoice',
      '2026-H1',
    )

    expect(row.safeTitle).not.toContain('storageKey')
    expect(row.safeTitle).toBe('세금계산서 · Excel 자료')
    expect(row.progressPercent).toBe(100)
    expect(row.statusLabel).toBe('정규화 완료')
    expect(row.canRetry).toBe(false)
    expect(row.href).toBe('/dashboard/direct-upload?period=2026-H1&fileId=file-1#import-status')
    expect(row.rowCountLabel).toBe('1.2MB')
  })

  it('marks failed files as retryable with a danger-eligible status (S-42)', () => {
    const row = buildSourceCollectionImportRow({
      id: 'file-2',
      uploadSessionId: 'session-2',
      fileType: 'pdf',
      fileSize: 400_000,
      status: 'failed',
      passwordStatus: 'none',
      uploadedAt: '2026-07-01T09:00:00.000Z',
    }, 'unknown', '2026-H1')

    expect(row.status).toBe('failed')
    expect(row.statusLabel).toBe('파싱 오류')
    expect(row.canRetry).toBe(true)
    expect(row.href).toContain('action=retry')
  })

  it('does not duplicate 기타 in receipt safe titles', () => {
    const row = buildSourceCollectionImportRow({
      id: 'file-3',
      uploadSessionId: 'session-3',
      fileType: 'other',
      fileSize: 8_493_466,
      status: 'analyzing',
      passwordStatus: 'none',
      uploadedAt: '2026-07-01T08:00:00.000Z',
    }, 'receipt_other', '2026-H1')

    expect(row.safeTitle).toBe('영수증 · 기타 자료')
  })
})

describe('sortSourceCollectionImportRows', () => {
  it('orders the status table like the approved preview: completed, in-progress, then failed', () => {
    const rows = [
      buildSourceCollectionImportRow({
        id: 'file-card-failed',
        uploadSessionId: 'session-1',
        fileType: 'pdf',
        fileSize: 400_000,
        status: 'failed',
        passwordStatus: 'none',
        uploadedAt: '2026-07-01T09:00:00.000Z',
      }, 'card_purchase', '2026-H1'),
      buildSourceCollectionImportRow({
        id: 'file-receipts',
        uploadSessionId: 'session-1',
        fileType: 'other',
        fileSize: 8_493_466,
        status: 'analyzing',
        passwordStatus: 'none',
        uploadedAt: '2026-07-01T08:00:00.000Z',
      }, 'receipt_other', '2026-H1'),
      buildSourceCollectionImportRow({
        id: 'file-bank',
        uploadSessionId: 'session-1',
        fileType: 'excel',
        fileSize: 3_565_158,
        status: 'matched',
        passwordStatus: 'none',
        uploadedAt: '2026-06-30T11:00:00.000Z',
      }, 'bank_statement', '2026-H1'),
      buildSourceCollectionImportRow({
        id: 'file-tax',
        uploadSessionId: 'session-1',
        fileType: 'excel',
        fileSize: 1_258_291,
        status: 'matched',
        passwordStatus: 'none',
        uploadedAt: '2026-06-30T10:00:00.000Z',
      }, 'tax_invoice', '2026-H1'),
    ]

    expect(sortSourceCollectionImportRows(rows).map((row) => row.id)).toEqual([
      'file-tax',
      'file-bank',
      'file-receipts',
      'file-card-failed',
    ])
  })
})

describe('buildSourceCollectionMissingItems', () => {
  it('creates a re-upload item for missing material (S-50)', () => {
    const items = buildSourceCollectionMissingItems([
      { id: 'riv-1', itemName: '5월 신한카드 법인 매입내역', validationStatus: 'missing', requestedAction: null },
    ])

    expect(items).toEqual([
      expect.objectContaining({
        title: '5월 신한카드 법인 매입내역',
        tone: 'warn',
        ctaLabel: '다시 업로드',
      }),
    ])
  })

  it('creates a normalization-check item routed to bookkeeping for uncertain rows (S-51)', () => {
    const items = buildSourceCollectionMissingItems([
      { id: 'riv-2', itemName: '영수증 묶음 정규화 확인', validationStatus: 'uncertain', requestedAction: null },
    ])

    expect(items[0]).toMatchObject({ ctaLabel: '정규화 확인', href: '/dashboard/bookkeeping' })
  })

  it('groups multiple uncertain rows into one normalization-check item for Preview parity', () => {
    const items = buildSourceCollectionMissingItems([
      { id: 'riv-2', itemName: '영수증 A', validationStatus: 'uncertain', requestedAction: null },
      { id: 'riv-3', itemName: '영수증 B', validationStatus: 'uncertain', requestedAction: null },
      { id: 'riv-4', itemName: '영수증 C', validationStatus: 'uncertain', requestedAction: null },
    ])

    expect(items).toEqual([
      expect.objectContaining({
        id: 'uncertain:3',
        title: '영수증 묶음 정규화 확인 3건',
        ctaLabel: '정규화 확인',
      }),
    ])
  })

  it('ignores satisfied rows', () => {
    const items = buildSourceCollectionMissingItems([
      { id: 'riv-3', itemName: '통장 거래내역', validationStatus: 'satisfied', requestedAction: null },
    ])

    expect(items).toHaveLength(0)
  })
})

describe('buildFileItemGroupMap', () => {
  it('is deterministic regardless of input row order (P2)', () => {
    const rowsA = [
      { uploadFileId: 'file-1', validationId: 'riv-1', itemGroup: 'sales_tax_invoice', contribution: 'satisfied', createdAt: '2026-06-01T00:00:00.000Z' },
      { uploadFileId: 'file-1', validationId: 'riv-2', itemGroup: 'other_evidence', contribution: 'uncertain', createdAt: '2026-06-02T00:00:00.000Z' },
    ]
    const rowsB = [...rowsA].reverse()

    expect(buildFileItemGroupMap(rowsA).get('file-1')).toBe('sales_tax_invoice')
    expect(buildFileItemGroupMap(rowsB).get('file-1')).toBe('sales_tax_invoice')
  })

  it('prefers satisfied contribution over uncertain or non_compliant', () => {
    const rows = [
      { uploadFileId: 'file-2', validationId: 'riv-3', itemGroup: 'other_evidence', contribution: 'non_compliant', createdAt: '2026-06-01T00:00:00.000Z' },
      { uploadFileId: 'file-2', validationId: 'riv-4', itemGroup: 'bank_statement', contribution: 'satisfied', createdAt: '2026-06-05T00:00:00.000Z' },
      { uploadFileId: 'file-2', validationId: 'riv-5', itemGroup: 'card_statement', contribution: 'uncertain', createdAt: '2026-06-03T00:00:00.000Z' },
    ]

    expect(buildFileItemGroupMap(rows).get('file-2')).toBe('bank_statement')
  })

  it('falls back to earliest createdAt when contribution ties', () => {
    const rows = [
      { uploadFileId: 'file-3', validationId: 'riv-6', itemGroup: 'cash_receipt', contribution: 'satisfied', createdAt: '2026-06-10T00:00:00.000Z' },
      { uploadFileId: 'file-3', validationId: 'riv-7', itemGroup: 'sales_tax_invoice', contribution: 'satisfied', createdAt: '2026-06-01T00:00:00.000Z' },
    ]

    expect(buildFileItemGroupMap(rows).get('file-3')).toBe('sales_tax_invoice')
  })

  it('falls back to validationId when contribution and createdAt both tie (P3 follow-up)', () => {
    const rowsA = [
      { uploadFileId: 'file-4', validationId: 'riv-b', itemGroup: 'bank_statement', contribution: 'satisfied', createdAt: '2026-06-01T00:00:00.000Z' },
      { uploadFileId: 'file-4', validationId: 'riv-a', itemGroup: 'sales_tax_invoice', contribution: 'satisfied', createdAt: '2026-06-01T00:00:00.000Z' },
    ]
    const rowsB = [...rowsA].reverse()

    expect(buildFileItemGroupMap(rowsA).get('file-4')).toBe('sales_tax_invoice')
    expect(buildFileItemGroupMap(rowsB).get('file-4')).toBe('sales_tax_invoice')
  })
})

describe('source collection loader boundaries', () => {
  const source = readFileSync(new URL('./summary.ts', import.meta.url), 'utf8')

  it('does not reference excluded request, mailbox, or template tables (S-72)', () => {
    const forbiddenIdentifiers = [
      'requestTemplate',
      'clientRequestSchedule',
      'clientRequestEvent',
      'outboundEmail',
      'inboundEmail',
      'staffMailbox',
    ]

    for (const identifier of forbiddenIdentifiers) {
      expect(source).not.toContain(identifier)
    }
  })

  it('only aggregates staff_direct sourced sessions via source_batch (S-22, JC-031 3b)', () => {
    expect(source).toContain("eq(sourceBatch.sourceKind, 'staff_direct')")
  })

  it('filters sessions by the selected accounting period via source_batch (S-10, S-82, JC-031 3b)', () => {
    expect(source).toContain('gte(sourceBatch.accountingPeriod, period.startMonth)')
    expect(source).toContain('lte(sourceBatch.accountingPeriod, period.endMonth)')
  })

  it('derives per-file sourceType via request_item_validation_file instead of always unknown (P2)', () => {
    expect(source).toContain('requestItemValidationFile')
    expect(source).not.toContain('buildSourceCollectionImportRow(file))')
  })

  it('scopes the file-item-group join by tenant and excludes excluded reviews (P3)', () => {
    expect(source).toContain("eq(requestItemValidation.tenantId, tenantId)")
    expect(source).toContain("ne(requestItemValidation.reviewStatus, 'excluded')")
  })
})

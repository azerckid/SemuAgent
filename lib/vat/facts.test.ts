import { describe, expect, it } from 'vitest'
import {
  buildManualVatFactFields,
  buildParsedVatFactFields,
  manualVatFactInputSchema,
  parsedVatFactSchema,
} from './facts'

describe('VAT fact contract', () => {
  it('stores exact parser values as derived without calculating tax from gross', () => {
    const vatFact = parsedVatFactSchema.parse({
      direction: 'purchase',
      taxType: 'taxable',
      supplyAmountKrw: 100000,
      taxAmountKrw: 10000,
      grossAmountKrw: 110000,
      sourceReference: 'file-1:Sheet1:2',
    })

    expect(buildParsedVatFactFields({
      sourceType: 'tax_invoice',
      direction: 'expense',
      sourceReference: vatFact.sourceReference,
      vatFact,
    })).toEqual({
      vatDirection: 'purchase',
      vatTaxType: 'taxable',
      vatSupplyAmountKrw: 100000,
      vatTaxAmountKrw: 10000,
      vatGrossAmountKrw: 110000,
      vatFactSource: 'parser',
      vatFactSourceRef: 'file-1:Sheet1:2',
      vatFactStatus: 'derived',
    })
  })

  it('keeps evidence rows without exact VAT fields in needs_review', () => {
    expect(buildParsedVatFactFields({
      sourceType: 'card',
      direction: 'expense',
      sourceReference: 'file-2:Sheet1:4',
    })).toMatchObject({
      vatDirection: 'purchase',
      vatTaxType: 'needs_review',
      vatSupplyAmountKrw: null,
      vatTaxAmountKrw: null,
      vatGrossAmountKrw: null,
      vatFactSource: 'parser',
      vatFactSourceRef: 'file-2:Sheet1:4',
      vatFactStatus: 'needs_review',
    })
  })

  it('does not create VAT facts for bank settlement rows', () => {
    expect(buildParsedVatFactFields({
      sourceType: 'bank',
      direction: 'expense',
      sourceReference: 'file-3:Sheet1:7',
    })).toEqual({
      vatDirection: null,
      vatTaxType: null,
      vatSupplyAmountKrw: null,
      vatTaxAmountKrw: null,
      vatGrossAmountKrw: null,
      vatFactSource: null,
      vatFactSourceRef: null,
      vatFactStatus: null,
    })
  })

  it('rejects inconsistent exact amounts instead of applying a gross/11 heuristic', () => {
    expect(manualVatFactInputSchema.safeParse({
      direction: 'sale',
      taxType: 'taxable',
      supplyAmountKrw: 100000,
      taxAmountKrw: 9000,
      grossAmountKrw: 110000,
    }).success).toBe(false)
  })

  it('stores an explicitly confirmed manual fact with staff source identity', () => {
    expect(buildManualVatFactFields({
      direction: 'sale',
      taxType: 'zero_rated',
      supplyAmountKrw: 250000,
      taxAmountKrw: 0,
      grossAmountKrw: 250000,
    }, 'staff:staff-1:row-1')).toMatchObject({
      vatDirection: 'sale',
      vatTaxType: 'zero_rated',
      vatFactSource: 'manual',
      vatFactSourceRef: 'staff:staff-1:row-1',
      vatFactStatus: 'confirmed',
    })
  })
})

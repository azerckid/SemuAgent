import { describe, expect, it } from 'vitest'
import { vatTaxTreatmentEvidenceSearchSchema } from '@/lib/validations/vat-tax-treatment'
import { buildVatTaxTreatmentEvidenceSearch } from './tax-treatment-evidence-trace'

describe('VAI-8b VAT evidence trace', () => {
  it('records all searched sources with actual references when evidence exists', () => {
    const result = buildVatTaxTreatmentEvidenceSearch({
      classificationRowId: 'row-current',
      sourceType: 'tax_invoice',
      linkedEvidenceRowId: 'row-linked',
      priorConfirmedReferences: ['row-prior-1', 'row-prior-2'],
      ruleReference: 'P-01 · 부가가치세법 제38조',
    })

    expect(result.searchedSources).toHaveLength(6)
    expect(result.evidenceTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'linked_evidence',
        status: 'found',
        reference: 'classification:row-linked',
      }),
      expect.objectContaining({
        source: 'exact_vat_fact',
        status: 'found',
        reference: 'classification:row-current:vat-fact',
      }),
      expect.objectContaining({
        source: 'prior_confirmed_decision',
        status: 'found',
        reference: 'classification:row-prior-1',
      }),
      expect.objectContaining({
        source: 'official_rule',
        status: 'found',
        reference: 'P-01 · 부가가치세법 제38조',
      }),
    ]))
  })

  it('records missing and not-applicable searches without inventing references', () => {
    const result = buildVatTaxTreatmentEvidenceSearch({
      classificationRowId: 'row-current',
      sourceType: 'tax_invoice',
    })

    expect(result.evidenceTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'reconciliation_result', status: 'not_applicable', reference: null }),
      expect.objectContaining({ source: 'prior_confirmed_decision', status: 'not_found', reference: null }),
      expect.objectContaining({ source: 'official_rule', status: 'not_found', reference: null }),
    ]))
  })

  it('rejects incomplete, duplicate, or reference-free found traces', () => {
    const valid = buildVatTaxTreatmentEvidenceSearch({ classificationRowId: 'row-current' })
    expect(vatTaxTreatmentEvidenceSearchSchema.safeParse({
      ...valid,
      evidenceTrace: valid.evidenceTrace.slice(1),
    }).success).toBe(false)
    expect(vatTaxTreatmentEvidenceSearchSchema.safeParse({
      ...valid,
      evidenceTrace: valid.evidenceTrace.map((item, index) => (
        index === 0 ? { ...item, reference: null } : item
      )),
    }).success).toBe(false)
    expect(vatTaxTreatmentEvidenceSearchSchema.safeParse({
      ...valid,
      searchedSources: valid.searchedSources.map((source, index) => (
        index === 1 ? valid.searchedSources[0] : source
      )),
    }).success).toBe(false)
  })
})

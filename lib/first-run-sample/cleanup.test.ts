import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
import { FIRST_RUN_SAMPLE_DELETE_TABLES } from './cleanup'

describe('first-run sample cleanup safety', () => {
  it('keeps cleanup limited to an explicit whitelist and leaves business entity rows alone (S-70)', () => {
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).toContain('request_item_validation_file')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).toContain('internal_reminder_send_log')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).toContain('source_batch')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('client')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('tenant')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('staff')
  })

  it('removes dynamic VAT treatment audits before deleting their sample classification rows', () => {
    const source = readFileSync(new URL('./cleanup.ts', import.meta.url), 'utf8')

    expect(source).toContain('.delete(vatDeductionReview)')
    expect(source).toContain('inArray(vatDeductionReview.classificationRowId, sampleClassificationRowIds)')
    expect(source.indexOf('.delete(vatDeductionReview)')).toBeLessThan(
      source.indexOf('for (const ref of refs)'),
    )
    expect(source).toContain('.delete(vatTaxTreatmentReview)')
    expect(source).toContain('inArray(vatTaxTreatmentReview.classificationRowId, sampleClassificationRowIds)')
    expect(source.indexOf('.delete(vatTaxTreatmentReview)')).toBeLessThan(
      source.indexOf('for (const ref of refs)'),
    )
    expect(source).toContain('.delete(vatTaxTreatmentEvidenceAttestation)')
    expect(source).toContain('inArray(vatTaxTreatmentEvidenceAttestation.classificationRowId, sampleClassificationRowIds)')
    expect(source.indexOf('.delete(vatTaxTreatmentEvidenceAttestation)')).toBeLessThan(
      source.indexOf('for (const ref of refs)'),
    )
  })

  it('does not build arbitrary SQL delete strings (S-71)', () => {
    const source = readFileSync(new URL('./cleanup.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('delete from ${')
    expect(source).not.toContain('sql`delete')
    expect(source).toContain('switch (entityTable)')
  })

  it('hides the dataset before the deferred physical cleanup runs', () => {
    const source = readFileSync(new URL('./cleanup.ts', import.meta.url), 'utf8')

    expect(source).toContain(".set({ status: 'deleted', updatedAt: timestamp, deletedAt: timestamp })")
    expect(source).toContain('export async function purgeFirstRunSampleDataset')
    expect(source).toContain('inArray(sourceBatch.legacyUploadSessionId, entityIds)')
    expect(source).toContain('.delete(sampleEntityRef)')
    expect(source).toContain('if (skippedUnknownTableCount > 0)')
    expect(source.indexOf('if (skippedUnknownTableCount > 0)')).toBeLessThan(source.indexOf('.delete(sampleEntityRef)'))
  })

  it('registers a delete case for every table seed.ts registers sample rows under (JC-031 source_batch regression)', () => {
    const seedSource = readFileSync(new URL('./seed.ts', import.meta.url), 'utf8')
    const groupsBlockMatch = seedSource.match(/const groups = \[([\s\S]*?)\] as const/)
    expect(groupsBlockMatch).not.toBeNull()

    const tableNames = [...(groupsBlockMatch?.[1] ?? '').matchAll(/\[\s*'([a-z_]+)'/g)].map((m) => m[1])
    expect(tableNames.length).toBeGreaterThan(0)

    for (const tableName of tableNames) {
      expect(FIRST_RUN_SAMPLE_DELETE_TABLES, `${tableName} is seeded but missing from FIRST_RUN_SAMPLE_DELETE_TABLES`).toContain(tableName)
    }
  })
})

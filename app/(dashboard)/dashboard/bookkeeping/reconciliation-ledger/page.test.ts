import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('reconciliation ledger page boundaries', () => {
  const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')

  it('passes includeExcluded so excluded rows survive filterRowsByTab into the live display model (PR #168 review P1)', () => {
    // loadBookkeepingReviewSummary is the actual call this page makes (not
    // the unused loadReconciliationLedgerDisplayModel helper). Without
    // includeExcluded, filterRowsByTab drops status==='excluded' even for
    // tab: 'all', so an excluded row would vanish from 자료대조원장 right
    // after being saved — visible nowhere, not even the exclusion review tab.
    expect(source).toContain('includeExcluded: true')
  })
})

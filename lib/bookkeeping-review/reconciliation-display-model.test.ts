import { describe, expect, it } from 'vitest'
import {
  RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS,
  RECONCILIATION_LEDGER_DISPLAY_FIXTURE,
} from './reconciliation-display-fixture'
import {
  loadReconciliationLedgerDisplayFixture,
  isReconciliationDisplayFixtureMode,
} from './reconciliation-display-loader'
import {
  parseReconciliationLedgerDisplayModel,
  reconciliationLedgerDisplayModelSchema,
} from './reconciliation-display-model'

describe('reconciliation display model', () => {
  it('parses the Preview 12 fixture through Zod', () => {
    const model = parseReconciliationLedgerDisplayModel(RECONCILIATION_LEDGER_DISPLAY_FIXTURE)

    expect(model.rows.length).toBeGreaterThanOrEqual(5)
    expect(model.nextActions.length).toBeGreaterThanOrEqual(3)
    expect(model.taxBlockerSummaries.some((summary) => summary.taxTrack === 'vat')).toBe(true)
    expect(model.batchSuggestionGroups).toHaveLength(1)
    expect(model.closingChecklist.isReadyForPath1).toBe(false)
  })

  it('requires rowConclusion on every row', () => {
    const model = loadReconciliationLedgerDisplayFixture()

    for (const row of model.rows) {
      expect(row.rowConclusion.headline.length).toBeGreaterThan(0)
      expect(row.rowConclusion.primaryAction).toBeTruthy()
      expect(row.actions.canConfirmAccount).toBe(false)
      expect(row.actions.canConfirmMatch).toBe(false)
    }
  })

  it('includes required fixture scenarios from Brief §2.1 cross-cutting', () => {
    const model = loadReconciliationLedgerDisplayFixture()
    const rowIds = new Set(model.rows.map((row) => row.id))

    expect(rowIds.has(RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankToTaxInvoice)).toBe(true)
    expect(rowIds.has(RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankLinked)).toBe(true)
    expect(rowIds.has(RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankExplanation)).toBe(true)
    expect(rowIds.has(RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.cardExplanation)).toBe(true)
    expect(rowIds.has(RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.privateExclusion)).toBe(true)

    const bankRow = model.rows.find((row) => row.id === RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankToTaxInvoice)
    expect(bankRow?.candidates.length).toBeGreaterThan(0)
    expect(bankRow?.source).toBe('bank')

    const bankLinkedRow = model.rows.find((row) => row.id === RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankLinked)
    expect(bankLinkedRow?.evidenceActionState).toBe('linked')

    const bankExplanationRow = model.rows.find((row) => row.id === RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.bankExplanation)
    expect(bankExplanationRow?.evidenceActionState).toBe('explanation_required')
    expect(bankExplanationRow?.source).toBe('bank')

    const cardRow = model.rows.find((row) => row.id === RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.cardExplanation)
    expect(cardRow?.evidenceActionState).toBe('explanation_required')

    const exclusionRow = model.rows.find((row) => row.id === RECONCILIATION_DISPLAY_FIXTURE_ROW_IDS.privateExclusion)
    expect(exclusionRow?.patternSuggestion?.suggestedExclusionReason).toBe('personal_private')

    const bankCount = model.rows.filter((row) => row.source === 'bank').length
    expect(bankCount).toBe(245)

    const safeBatch = model.batchSuggestionGroups.find((group) => group.eligibility === 'safe_to_offer')
    expect(safeBatch?.requiresUserConfirmation).toBe(true)
    expect((safeBatch?.rowIds.length ?? 0) >= 2).toBe(true)
  })

  it('rejects invalid display models', () => {
    expect(() =>
      reconciliationLedgerDisplayModelSchema.parse({
        rows: [],
        nextActions: [],
        taxBlockerSummaries: [],
        closingChecklist: {
          evidenceRequiredCount: 0,
          explanationRequiredCount: 0,
          accountUnconfirmedCount: 0,
          exclusionReasonRequiredCount: 0,
          taxBlockerCount: 0,
          isReadyForPath1: true,
        },
        batchSuggestionGroups: [
          {
            id: 'bad-batch',
            rowIds: [],
            suggestedAction: 'apply_account',
            basisLabel: 'empty group',
            eligibility: 'safe_to_offer',
            requiresUserConfirmation: true,
          },
        ],
      }),
    ).toThrow()
  })
})

describe('reconciliation display loader', () => {
  it('defaults display mode detection to live unless display=fixture', () => {
    expect(isReconciliationDisplayFixtureMode(undefined)).toBe(false)
    expect(isReconciliationDisplayFixtureMode('live')).toBe(false)
    expect(isReconciliationDisplayFixtureMode('fixture')).toBe(true)
  })

  it('loads fixture mode without touching the database', () => {
    const fixture = loadReconciliationLedgerDisplayFixture()
    expect(fixture.rows.length).toBe(RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.length)
  })
})

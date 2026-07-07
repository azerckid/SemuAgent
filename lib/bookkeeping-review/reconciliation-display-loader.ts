import {
  parseReconciliationLedgerDisplayModel,
  type ReconciliationLedgerDisplayModel,
} from './reconciliation-display-model'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'

export type ReconciliationDisplayLoadMode = 'fixture' | 'live'

export function loadReconciliationLedgerDisplayFixture(): ReconciliationLedgerDisplayModel {
  return parseReconciliationLedgerDisplayModel(RECONCILIATION_LEDGER_DISPLAY_FIXTURE)
}

export function isReconciliationDisplayFixtureMode(display: string | undefined): boolean {
  return display === 'fixture'
}

export function loadReconciliationLedgerDisplayModel(input: {
  mode: ReconciliationDisplayLoadMode
}): ReconciliationLedgerDisplayModel {
  if (input.mode === 'fixture') {
    return loadReconciliationLedgerDisplayFixture()
  }

  throw new Error(
    'ReconciliationLedgerDisplayModel live wiring is not implemented yet (Slice 2a-5).',
  )
}

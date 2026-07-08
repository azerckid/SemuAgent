import {
  parseReconciliationLedgerDisplayModel,
  type ReconciliationLedgerDisplayModel,
} from './reconciliation-display-model'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'

export function loadReconciliationLedgerDisplayFixture(): ReconciliationLedgerDisplayModel {
  return parseReconciliationLedgerDisplayModel(RECONCILIATION_LEDGER_DISPLAY_FIXTURE)
}

export function isReconciliationDisplayFixtureMode(display: string | undefined): boolean {
  return display === 'fixture'
}

import { mkdtemp, readdir, rm, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
} from '../../lib/bookkeeping-review/reconciliation-sample-generator'
import { FIRST_RUN_SAMPLE_EMPLOYEES } from '../../lib/first-run-sample/payroll-sample-employees'
import { createSeedDerivedUploadFixtures } from './create-seed-derived-upload-fixtures'

let fixtureDirectory = ''

async function workbookRows(filename: string) {
  const workbook = XLSX.read(await readFile(path.join(fixtureDirectory, filename)), { type: 'buffer', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  return XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, raw: true }).slice(1)
}

function tuple(...values: Array<string | number>) {
  return values.join('|')
}

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), 'semuagent-seed-fixtures-'))
  await createSeedDerivedUploadFixtures(fixtureDirectory)
})

afterAll(async () => {
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true })
})

describe('seed-derived upload fixtures', () => {
  it('renders every existing first-run source row exactly once by source type', async () => {
    const filenames = await readdir(fixtureDirectory)
    const bankFiles = filenames.filter((name) => name.startsWith('은행_'))
    const cardFiles = filenames.filter((name) => name.startsWith('법인카드_'))
    const taxFiles = filenames.filter((name) => name.startsWith('홈택스_'))

    const bankRows = (await Promise.all(bankFiles.map(workbookRows))).flat()
    const cardRows = (await Promise.all(cardFiles.map(workbookRows))).flat()
    const taxRows = (await Promise.all(taxFiles.map(workbookRows))).flat()
    const payrollRows = await workbookRows('급여시스템_급여대장_202606.xlsx')

    expect(bankRows).toHaveLength(245)
    expect(cardRows).toHaveLength(106)
    expect(taxRows).toHaveLength(354)
    expect(payrollRows).toHaveLength(FIRST_RUN_SAMPLE_EMPLOYEES.length)
  })

  it('preserves all bank and card dates, counterparties, and gross amounts', async () => {
    const filenames = await readdir(fixtureDirectory)
    const bankRows = (await Promise.all(filenames.filter((name) => name.startsWith('은행_')).map(workbookRows))).flat()
    const cardRows = (await Promise.all(filenames.filter((name) => name.startsWith('법인카드_')).map(workbookRows))).flat()

    const actualBank = new Set(bankRows.map((row) => tuple(row[0], row[2], row[3] || row[4])))
    const actualCard = new Set(cardRows.map((row) => tuple(row[0], row[2], row[3])))

    for (const row of BANK_SAMPLE_DEFINITIONS) {
      expect(actualBank).toContain(tuple(row.transactionDate, row.description, row.amountKrw))
    }
    for (const row of CARD_SAMPLE_DEFINITIONS) {
      expect(actualCard).toContain(tuple(row.transactionDate, row.counterparty, row.amountKrw))
    }
    expect(actualCard).toContain(tuple('2026-06-18', '○○한정식', 1_320_000))
  })

  it('keeps every matched primary row paired with a same-date, same-gross tax invoice', async () => {
    const filenames = await readdir(fixtureDirectory)
    const taxRows = (await Promise.all(filenames.filter((name) => name.startsWith('홈택스_')).map(workbookRows))).flat()
    const actualTax = new Set(taxRows.map((row) => tuple(row[0], row[2], row[6])))

    for (const row of [...BANK_SAMPLE_DEFINITIONS, ...CARD_SAMPLE_DEFINITIONS].filter((item) => item.matched)) {
      expect(actualTax).toContain(tuple(row.transactionDate, row.taxCounterparty ?? row.counterparty, row.amountKrw))
    }
    for (const row of ORPHAN_TAX_INVOICE_DEFINITIONS) {
      expect(actualTax).toContain(tuple(row.transactionDate, row.counterparty, row.amountKrw))
    }
  })

  it('uses the current first-run employee source values without separate payroll fixture data', async () => {
    const rows = await workbookRows('급여시스템_급여대장_202606.xlsx')
    const actual = new Set(rows.map((row) => tuple(row[1], row[2], row[6], row[7], row[8])))
    for (const employee of FIRST_RUN_SAMPLE_EMPLOYEES) {
      expect(actual).toContain(tuple(
        employee.code,
        employee.name,
        employee.baseSalaryKrw,
        employee.mealAllowanceKrw ?? 0,
        employee.allowanceKrw,
      ))
    }
  })
})

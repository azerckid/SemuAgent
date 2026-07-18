import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as XLSX from 'xlsx'
import {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
} from '../../lib/bookkeeping-review/reconciliation-sample-generator'
import { FIRST_RUN_SAMPLE_EMPLOYEES } from '../../lib/first-run-sample/payroll-sample-employees'

type Direction = 'income' | 'expense'

type TaxInvoiceRow = {
  transactionDate: string
  counterparty: string
  description: string
  amountKrw: number
  direction: Direction
  taxType: 'taxable' | 'zero_rated' | 'exempt'
  source: 'bank_match' | 'card_match' | 'orphan' | 'vat_treatment'
}

export type SeedDerivedFixtureSummary = {
  destination: string
  bankRows: number
  cardRows: number
  taxInvoiceRows: number
  payrollRows: number
  matchedPairs: number
}

const DEFAULT_DESTINATION = path.resolve(
  process.cwd(),
  'docs/05_QA_Validation/fixtures/seed-derived-upload-2026-01-to-07',
)

const VAT_TAX_TREATMENT_ROWS: TaxInvoiceRow[] = [
  {
    transactionDate: '2026-06-20', counterparty: 'GLOBAL TECH INC', description: '국외 SaaS 개발 용역',
    amountKrw: 40_000_000, direction: 'income', taxType: 'zero_rated', source: 'vat_treatment',
  },
  {
    transactionDate: '2026-06-17', counterparty: '○○물산', description: '면세사업분 공통매입',
    amountKrw: 2_200_000, direction: 'expense', taxType: 'taxable', source: 'vat_treatment',
  },
  {
    transactionDate: '2026-06-16', counterparty: 'AWS', description: '클라우드 서버 이용료',
    amountKrw: 3_436_400, direction: 'expense', taxType: 'taxable', source: 'vat_treatment',
  },
  {
    transactionDate: '2026-06-15', counterparty: '○○러닝', description: '온라인 교육 콘텐츠 제공',
    amountKrw: 15_000_000, direction: 'income', taxType: 'exempt', source: 'vat_treatment',
  },
]

const VAT_CARD_TREATMENT_ROW = {
  transactionDate: '2026-06-18', cardLabel: '법인카드 부가세처리', counterparty: '○○한정식',
  description: '거래처 접대 식대', amountKrw: 1_320_000,
}

function splitGrossAmount(amountKrw: number, taxType: TaxInvoiceRow['taxType']) {
  if (taxType !== 'taxable') return { supplyAmountKrw: amountKrw, taxAmountKrw: 0 }
  const supplyAmountKrw = Math.round(amountKrw / 1.1)
  return { supplyAmountKrw, taxAmountKrw: amountKrw - supplyAmountKrw }
}

function taxTypeLabel(taxType: TaxInvoiceRow['taxType']) {
  if (taxType === 'zero_rated') return '영세율'
  if (taxType === 'exempt') return '면세'
  return '일반'
}

function toSheet(rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = rows[0]?.map((_, index) => ({ wch: index < 2 ? 16 : 22 }))
  return sheet
}

async function writeWorkbook(destination: string, filename: string, sheetName: string, rows: Array<Array<string | number>>) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, toSheet(rows), sheetName)
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  await writeFile(path.join(destination, filename), buffer)
}

function buildTaxInvoiceRows(): TaxInvoiceRow[] {
  return [
    ...BANK_SAMPLE_DEFINITIONS.filter((row) => row.matched).map((row) => ({
      transactionDate: row.transactionDate,
      counterparty: row.taxCounterparty ?? row.counterparty,
      description: row.taxItem ?? row.description,
      amountKrw: row.amountKrw,
      direction: row.direction,
      taxType: 'taxable' as const,
      source: 'bank_match' as const,
    })),
    ...CARD_SAMPLE_DEFINITIONS.filter((row) => row.matched).map((row) => ({
      transactionDate: row.transactionDate,
      counterparty: row.taxCounterparty ?? row.counterparty,
      description: row.taxItem ?? row.description,
      amountKrw: row.amountKrw,
      direction: row.direction,
      taxType: 'taxable' as const,
      source: 'card_match' as const,
    })),
    ...ORPHAN_TAX_INVOICE_DEFINITIONS.map((row) => ({
      transactionDate: row.transactionDate,
      counterparty: row.counterparty,
      description: row.description,
      amountKrw: row.amountKrw,
      direction: row.direction,
      taxType: 'taxable' as const,
      source: 'orphan' as const,
    })),
    ...VAT_TAX_TREATMENT_ROWS,
  ]
}

function bankRowsFor(accountLabel: string) {
  const rows = BANK_SAMPLE_DEFINITIONS
    .filter((row) => row.accountLabel === accountLabel)
    .sort((left, right) => left.transactionDate.localeCompare(right.transactionDate))
  let balance = 20_000_000
  return [
    ['거래일자', '거래시간', '적요', '입금액', '출금액', '거래후잔액', '거래점'],
    ...rows.map((row, index) => {
      balance += row.direction === 'income' ? row.amountKrw : -row.amountKrw
      return [
        row.transactionDate, `${String(9 + (index % 8)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00`,
        row.description, row.direction === 'income' ? row.amountKrw : '', row.direction === 'expense' ? row.amountKrw : '',
        balance, '인터넷뱅킹',
      ]
    }),
  ]
}

function cardRowsFor(cardLabel: string) {
  const rows = CARD_SAMPLE_DEFINITIONS
    .filter((row) => row.cardLabel === cardLabel)
    .sort((left, right) => left.transactionDate.localeCompare(right.transactionDate))
  return [
    ['승인일자', '승인시간', '가맹점명', '이용금액', '할부개월', '승인번호', '국내외구분', '이용내역'],
    ...rows.map((row, index) => [
      row.transactionDate, `${String(10 + (index % 7)).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}`,
      row.counterparty, row.amountKrw, '일시불', `${row.suffix.replace(/\D/g, '').slice(-8)}${String(index).padStart(2, '0')}`,
      /AWS|Notion|Microsoft|Adobe/.test(row.counterparty) ? '해외' : '국내', row.description,
    ]),
  ]
}

function taxInvoiceRowsFor(direction: Direction) {
  const rows = buildTaxInvoiceRows()
    .filter((row) => row.direction === direction)
    .sort((left, right) => left.transactionDate.localeCompare(right.transactionDate))
  const partyColumn = direction === 'income' ? '공급받는자 상호' : '공급자 상호'
  return [
    ['작성일자', '거래구분', partyColumn, '품목명', '공급가액', '세액', '합계금액', '전자세금계산서 종류', '원본구분'],
    ...rows.map((row) => {
      const amounts = splitGrossAmount(row.amountKrw, row.taxType)
      return [
        row.transactionDate, direction === 'income' ? '매출' : '매입', row.counterparty, row.description,
        amounts.supplyAmountKrw, amounts.taxAmountKrw, row.amountKrw, taxTypeLabel(row.taxType), row.source,
      ]
    }),
  ]
}

function payrollRows() {
  return [
    ['귀속연월', '사번', '성명', '부서', '직급', '고용형태', '기본급', '식대', '기타수당', '지급총액', '공제대상가족수', '일급', '근무일수'],
    ...FIRST_RUN_SAMPLE_EMPLOYEES.map((row) => [
      '2026-06', row.code, row.name, row.department, row.jobTitle, row.employmentType,
      row.baseSalaryKrw, row.mealAllowanceKrw ?? 0, row.allowanceKrw,
      row.baseSalaryKrw + (row.mealAllowanceKrw ?? 0) + row.allowanceKrw,
      row.dependentCount ?? '', row.dailyWageKrw ?? '', row.workDays ?? '',
    ]),
  ]
}

export async function createSeedDerivedUploadFixtures(destination = DEFAULT_DESTINATION): Promise<SeedDerivedFixtureSummary> {
  await mkdir(destination, { recursive: true })
  for (const filename of await readdir(destination)) {
    if (/\.xlsx$/i.test(filename)) await rm(path.join(destination, filename), { force: true })
  }

  for (const accountLabel of [...new Set(BANK_SAMPLE_DEFINITIONS.map((row) => row.accountLabel))]) {
    const bankName = accountLabel.includes('신한') ? '신한은행' : accountLabel.includes('우리') ? '우리은행' : '국민은행'
    const lastFour = accountLabel.match(/(\d{4})$/)?.[1] ?? '0000'
    await writeWorkbook(destination, `은행_${bankName}_${lastFour}_거래내역_202601-202607.xlsx`, '거래내역', bankRowsFor(accountLabel))
  }

  for (const cardLabel of [...new Set(CARD_SAMPLE_DEFINITIONS.map((row) => row.cardLabel))]) {
    const cardName = cardLabel.includes('신한') ? '신한카드' : '국민카드'
    const lastFour = cardLabel.match(/(\d{4})$/)?.[1] ?? '0000'
    await writeWorkbook(destination, `법인카드_${cardName}_${lastFour}_이용내역_202601-202607.xlsx`, '이용내역', cardRowsFor(cardLabel))
  }

  await writeWorkbook(destination, '법인카드_부가세처리_202606_이용내역.xlsx', '이용내역', [
    ['승인일자', '승인시간', '가맹점명', '이용금액', '할부개월', '승인번호', '국내외구분', '이용내역'],
    [VAT_CARD_TREATMENT_ROW.transactionDate, '19:30', VAT_CARD_TREATMENT_ROW.counterparty, VAT_CARD_TREATMENT_ROW.amountKrw, '일시불', '202606180001', '국내', VAT_CARD_TREATMENT_ROW.description],
  ])
  await writeWorkbook(destination, '홈택스_전자세금계산서_매출_202601-202607.xlsx', '매출세금계산서', taxInvoiceRowsFor('income'))
  await writeWorkbook(destination, '홈택스_전자세금계산서_매입_202601-202607.xlsx', '매입세금계산서', taxInvoiceRowsFor('expense'))
  await writeWorkbook(destination, '급여시스템_급여대장_202606.xlsx', '급여대장', payrollRows())

  return {
    destination,
    bankRows: BANK_SAMPLE_DEFINITIONS.length,
    cardRows: CARD_SAMPLE_DEFINITIONS.length + 1,
    taxInvoiceRows: buildTaxInvoiceRows().length,
    payrollRows: payrollRows().length - 1,
    matchedPairs: BANK_SAMPLE_DEFINITIONS.filter((row) => row.matched).length + CARD_SAMPLE_DEFINITIONS.filter((row) => row.matched).length,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destination = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DESTINATION
  createSeedDerivedUploadFixtures(destination)
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

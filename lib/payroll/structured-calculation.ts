import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import type { PayrollExtractedRow, PayrollExtractionResponse } from '@/lib/validations/payroll'
import {
  processSampleCStructuredSheets,
  type SampleCMutableEmployeeRow,
} from '@/lib/payroll/sample-c-reader'

const DEFAULT_MONTHLY_WORK_HOURS = 209
const PAYROLL_PERIOD_SCAN_ROWS = 15
const EMPLOYEE_CODE_ALIASES = ['개인번호', '사원코드', '사원번호', '직원코드', 'employeeCode']
const EMPLOYEE_NAME_ALIASES = ['성명', '이름', '사원명', '직원명', 'employeeName']
const BASE_SALARY_ALIASES = ['기본급', '본봉', '기본임금', '기본월급', '기준급']
const QUALIFICATION_PAY_ALIASES = ['자격급', '자격수당', '직능급', '직능수당', '면허수당', '기술수당']
const POSITION_PAY_ALIASES = ['직책급', '직책수당', '직무급', '직무수당', '보직수당']
const FIXED_MONTHLY_WAGE_TOTAL_ALIASES = [
  '통상임금',
  '통상임금월액',
  '월통상임금',
  '월고정급',
  '월고정임금',
  '고정급',
  '고정임금',
  '고정급합계',
  '고정임금합계',
  '월급여',
  '월급여액',
  '월지급액',
  '기준급여',
  '기본지급액',
  '급여기준액',
]
const VEHICLE_MAINTENANCE_ALIASES = ['차량유지비', '차량유지', '자가운전보조금', '자가운전', '차량보조금', '차량보조']
const RETROACTIVE_PAY_ALIASES = ['급여인상분소급적용', '급여인상분소급', '소급적용', '소급분', '소급수당', '급여소급']
const CHILDCARE_ALLOWANCE_ALIASES = ['보육수당', '육아수당', '양육수당', '가족수당보육']
const PERSONNEL_PAYROLL_NON_EMPLOYEE_TOKENS = new Set([
  '직위',
  '직 위',
  '부서',
  '부 서',
  '입사일',
  '입 사 일',
  '퇴사일',
  '퇴 사 일',
  '주민번호',
  '주민등록번호',
])

type DeductionComponentKey =
  | 'nationalPension'
  | 'healthInsurance'
  | 'longTermCare'
  | 'employmentInsurance'
  | 'incomeTax'
  | 'localIncomeTax'

const deductionComponentLabels: Record<DeductionComponentKey, string> = {
  nationalPension: '국민연금',
  healthInsurance: '건강보험',
  longTermCare: '장기요양',
  employmentInsurance: '고용보험',
  incomeTax: '소득세',
  localIncomeTax: '지방소득세',
}

export type ParsedRow = {
  rowNumber: number
  cells: string[]
}

type ParsedSheet = {
  filename: string
  sheetName: string
  rows: ParsedRow[]
}

type WorkingRow = {
  employeeCode: string | null
  employeeName: string | null
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalary: number | null
  bonus: number | null
  mealAllowance: number | null
  transportationAllowance: number | null
  fixedOvertimeAllowance: number
  vehicleMaintenanceAllowance: number | null
  retroactivePay: number | null
  childcareAllowance: number | null
  rndAllowance: number | null
  otherAllowance: number | null
  welfareAllowance: number | null
  domesticTravelAllowance: number | null
  annualLeaveAllowanceAmount: number | null
  payrollVerificationFailed: boolean
  ordinaryMonthlyWage: number | null
  overtimeHours: number
  holidayHours: number
  nightHours: number
  annualLeaveDays: number
  lateEarlyHours: number
  sources: Record<string, unknown>[]
  notes: string[]
  deductionProfile: EmployeeDeductionProfile
}

type DeductionBasisRule = {
  rate: number | null
  lowerLimit: number | null
  upperLimit: number | null
  sourceLabel: string | null
}

type PayrollDeductionBasisCatalog = {
  recognized: boolean
  sourceLabels: string[]
  components: Record<DeductionComponentKey, DeductionBasisRule>
}

type EmployeeDeductionProfile = {
  hasSource: boolean
  basisAmount: number | null
  nonTaxableAmount: number | null
  dependentCount: number | null
  childCount: number | null
  incomeTax: number | null
  localIncomeTax: number | null
  applies: Partial<Record<DeductionComponentKey, boolean>>
  notes: string[]
}

type DeductionCalculation = {
  amount: number | null
  components: Record<DeductionComponentKey, number | null>
  notes: string[]
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, '').replace(/[()]/g, '').toLowerCase()
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, '').trim().toLowerCase()
  return normalized ? normalized : null
}

function parseAmount(value: string | null | undefined): number | null {
  const cleaned = value?.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
  if (!cleaned) return null
  const numberValue = Number(cleaned)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : null
}

function parseHours(value: string | null | undefined): number | null {
  const cleaned = value?.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
  if (!cleaned) return null
  const numberValue = Number(cleaned)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseDurationHours(value: string | null | undefined): number | null {
  const raw = value?.trim()
  if (!raw) return null
  const simple = parseHours(raw)
  if (simple != null && /^[-+\d.,\s시간hourhrh]+$/i.test(raw)) return simple

  const unitMatches = [...raw.replace(/,/g, '').matchAll(/([-+]?\d+(?:\.\d+)?)\s*(시간|시|hours?|hrs?|hr|h|분|minutes?|mins?|min|m)/gi)]
  if (unitMatches.length > 0) {
    const total = unitMatches.reduce((sum, match) => {
      const amount = Number(match[1])
      if (!Number.isFinite(amount)) return sum
      const unit = match[2]?.toLowerCase() ?? ''
      return sum + (/^분$|^m(?:in(?:ute)?s?)?$/.test(unit) ? amount / 60 : amount)
    }, 0)
    return Number.isFinite(total) ? total : null
  }

  const matches = raw.match(/[-+]?\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return null
  const total = matches.reduce((sum, match) => sum + Number(match), 0)
  return Number.isFinite(total) ? total : null
}

function parseRate(value: string | null | undefined): number | null {
  const raw = value?.trim()
  if (!raw) return null
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
  if (!cleaned) return null
  const numberValue = Number(cleaned)
  if (!Number.isFinite(numberValue)) return null
  return raw.includes('%') || Math.abs(numberValue) > 1 ? numberValue / 100 : numberValue
}

function parseBooleanFlag(value: string | null | undefined): boolean | null {
  const normalized = normalizeHeader(value ?? '')
  if (!normalized) return null
  if (['y', 'yes', 'true', '1', 'o', '가입', '대상', '예', '적용'].includes(normalized)) return true
  if (['n', 'no', 'false', '0', 'x', '미가입', '제외', '아니오', '비대상', '미적용'].includes(normalized)) return false
  return null
}

export function parseRenderedRows(text: string | null): ParsedRow[] {
  if (!text) return []

  const rowLines: string[] = []
  let currentRowLine: string | null = null
  const isMetadataLine = (line: string): boolean => (
    /^\[.*\]$/.test(line)
    || /^(파일명|시트 수|추출 프로필|chunk|## 시트|범위|행 범위):/.test(line)
  )

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (/^\d+:\s*/.test(line)) {
      if (currentRowLine) rowLines.push(currentRowLine)
      currentRowLine = line
      continue
    }
    const trimmed = line.trim()
    if (currentRowLine && trimmed && !isMetadataLine(trimmed)) {
      currentRowLine = `${currentRowLine} ${trimmed}`
    }
  }
  if (currentRowLine) rowLines.push(currentRowLine)

  return rowLines
    .map((line) => {
      const match = line.match(/^(\d+):\s*(.*)$/)
      if (!match) return null
      return {
        rowNumber: Number(match[1]),
        cells: match[2].split('|').map((cell) => cell.trim()),
      }
    })
    .filter((row): row is ParsedRow => Boolean(row))
}

function parseSheets(fileTexts: PayrollSourceText[]): ParsedSheet[] {
  return fileTexts
    .map((source) => ({
      filename: source.filename,
      sheetName: source.sheetName ?? inferSheetName(source.text) ?? source.filename,
      rows: parseRenderedRows(source.text),
    }))
    .filter((sheet) => sheet.rows.length > 0)
}

function inferSheetName(text: string | null): string | null {
  const match = text?.match(/^## 시트:\s*(.+)$/m)
  return match?.[1]?.trim() || null
}

function hasHeaders(row: ParsedRow, headers: string[]): boolean {
  const normalizedCells = row.cells.map(normalizeHeader)
  return headers.every((header) => normalizedCells.includes(normalizeHeader(header)))
}

function hasAnyHeader(row: ParsedRow, aliases: string[]): boolean {
  const normalizedCells = row.cells.map(normalizeHeader)
  const normalizedAliases = aliases.map(normalizeHeader)
  return normalizedAliases.some((alias) => normalizedCells.includes(alias))
}

function findFlexibleHeaderRow(sheet: ParsedSheet, requiredAliasGroups: string[][]): ParsedRow | null {
  return sheet.rows.find((row) => requiredAliasGroups.every((aliases) => hasAnyHeader(row, aliases))) ?? null
}

function findHeaderRow(sheet: ParsedSheet, requiredHeaders: string[]): ParsedRow | null {
  return sheet.rows.find((row) => hasHeaders(row, requiredHeaders)) ?? null
}

function columnIndex(header: ParsedRow, aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader)
  return header.cells.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)))
}

function columnIndexLoose(header: ParsedRow, aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader)
  return header.cells.findIndex((cell) => {
    const normalizedCell = normalizeHeader(cell)
    return normalizedAliases.some((alias) => (
      normalizedCell === alias || (alias.length >= 3 && normalizedCell.includes(alias))
    ))
  })
}

function columnIndexGroupedHeader(header: ParsedRow, bottom: ParsedRow, aliases: string[]): number {
  const mergedIdx = columnIndexLoose(header, aliases)
  if (mergedIdx >= 0) return mergedIdx
  return columnIndex(bottom, aliases)
}

function cell(row: ParsedRow, index: number): string {
  return index >= 0 ? row.cells[index] ?? '' : ''
}

function normalizeDataToken(value: string | null): string {
  return (value ?? '').replace(/\s+/g, '').trim()
}

function looksLikeDateToken(value: string | null): boolean {
  const normalized = normalizeDataToken(value)
  return /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(normalized)
    || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(normalized)
}

function looksLikeResidentRegistrationNumber(value: string | null): boolean {
  return /^\d{6}-?\d{7}$/.test(normalizeDataToken(value))
}

function isPersonnelPayrollNonEmployeeRow(employeeCode: string | null, employeeName: string | null): boolean {
  const code = employeeCode?.trim() || null
  const name = employeeName?.trim() || null
  const compactCode = normalizeDataToken(code)
  const compactName = normalizeDataToken(name)

  return [code, name, compactCode, compactName].some((value) => Boolean(value && PERSONNEL_PAYROLL_NON_EMPLOYEE_TOKENS.has(value)))
    || (!name && looksLikeDateToken(code))
    || (!name && looksLikeResidentRegistrationNumber(code))
}

function hasStructuredPaymentSignal(row: WorkingRow): boolean {
  return [
    row.baseSalary,
    row.ordinaryMonthlyWage,
    row.bonus,
    row.mealAllowance,
    row.transportationAllowance,
    row.vehicleMaintenanceAllowance,
    row.retroactivePay,
    row.childcareAllowance,
    row.rndAllowance,
    row.otherAllowance,
    row.welfareAllowance,
    row.domesticTravelAllowance,
    row.annualLeaveAllowanceAmount,
  ].some((value) => value != null && value !== 0)
    || row.fixedOvertimeAllowance > 0
    || row.overtimeHours > 0
    || row.holidayHours > 0
    || row.nightHours > 0
    || row.annualLeaveDays > 0
}

function shouldEmitStructuredPayrollRow(row: WorkingRow): boolean {
  if (!row.employeeCode && !row.employeeName) return false
  if (isPersonnelPayrollNonEmployeeRow(row.employeeCode, row.employeeName)) return false
  return hasStructuredPaymentSignal(row)
}

function joinedRowText(row: ParsedRow): string {
  return row.cells.join(' ')
}

function sheetMatchesPayrollPeriod(sheet: ParsedSheet, payrollPeriod: string): boolean {
  if (periodMatches(sheet.sheetName, payrollPeriod)) return true
  return sheet.rows.slice(0, PAYROLL_PERIOD_SCAN_ROWS).some((row) => periodMatches(joinedRowText(row), payrollPeriod))
}

function buildTwoRowHeader(topRow: ParsedRow, bottomRow: ParsedRow): ParsedRow {
  const width = Math.max(topRow.cells.length, bottomRow.cells.length)
  const cells: string[] = []
  let activeGroup = ''

  for (let index = 0; index < width; index += 1) {
    const topCell = cell(topRow, index).trim()
    const bottomCell = cell(bottomRow, index).trim()
    if (topCell) activeGroup = topCell

    if (topCell && bottomCell) {
      cells.push(`${topCell} ${bottomCell}`)
    } else if (bottomCell && activeGroup) {
      cells.push(`${activeGroup} ${bottomCell}`)
    } else {
      cells.push(topCell || bottomCell)
    }
  }

  return {
    rowNumber: bottomRow.rowNumber,
    cells,
  }
}

function findMonthlyLedgerHeaderPair(sheet: ParsedSheet): { top: ParsedRow; bottom: ParsedRow; header: ParsedRow } | null {
  for (const top of sheet.rows) {
    if (!hasAnyHeader(top, EMPLOYEE_NAME_ALIASES)) continue
    if (!hasAnyHeader(top, ['지급급여', '지급액', '급여지급', '실지급', '고정급여'])) continue

    const bottom = sheet.rows.find((row) => row.rowNumber > top.rowNumber && row.rowNumber <= top.rowNumber + 2)
    if (!bottom) continue

    const header = buildTwoRowHeader(top, bottom)
    if (!hasAnyHeader(header, BASE_SALARY_ALIASES) && columnIndexLoose(header, ['지급급여 기본급', '지급급여 합계']) < 0) {
      continue
    }

    return { top, bottom, header }
  }

  return null
}

function rowHasPersonnelPayGroup(row: ParsedRow): boolean {
  return row.cells.some((value) => {
    const normalized = normalizeHeader(value)
    return normalized.includes('임금항목') || normalized === '공제항목'
  })
}

function findPersonnelPayrollHeaderPair(sheet: ParsedSheet): { top: ParsedRow; bottom: ParsedRow; header: ParsedRow } | null {
  for (const top of sheet.rows) {
    if (!hasAnyHeader(top, EMPLOYEE_NAME_ALIASES)) continue
    if (!rowHasPersonnelPayGroup(top)) continue

    const bottom = sheet.rows.find((row) => row.rowNumber > top.rowNumber && row.rowNumber <= top.rowNumber + 2)
    if (!bottom) continue

    const header = buildTwoRowHeader(top, bottom)
    if (columnIndexLoose(header, BASE_SALARY_ALIASES) < 0) continue

    return { top, bottom, header }
  }

  return null
}

function amountsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1
}

function resolveFixedBaseSalary(params: {
  row: ParsedRow
  baseIdx: number
  qualificationIdx: number
  dutyIdx: number
  fixedTotalIdx: number
}): {
  outputBaseSalary: number | null
  ordinaryMonthlyWage: number | null
  note: string | null
} {
  const sourceBaseSalary = parseAmount(cell(params.row, params.baseIdx))
  const qualificationPay = parseAmount(cell(params.row, params.qualificationIdx))
  const dutyPay = parseAmount(cell(params.row, params.dutyIdx))
  const fixedTotal = parseAmount(cell(params.row, params.fixedTotalIdx))
  const fixedComponents = [qualificationPay, dutyPay].filter((value): value is number => value != null)
  const fixedComponentSum = (sourceBaseSalary ?? 0) + fixedComponents.reduce((sum, value) => sum + value, 0)

  if (fixedTotal != null) {
    if (sourceBaseSalary != null && fixedComponents.length > 0) {
      const relation = amountsMatch(fixedTotal, fixedComponentSum)
        ? '기본급+고정수당 합계와 일치'
        : `기본급+고정수당 합계(${formatWon(fixedComponentSum)})와 차이가 있어 원본 고정급 합계 우선`
      return {
        outputBaseSalary: fixedTotal,
        ordinaryMonthlyWage: fixedTotal,
        note: `더존 업로드 양식에는 자격급/직책급 별도 칸이 없어 고정급 합계(${relation})를 기본급 칸에 반영했습니다.`,
      }
    }
    if (sourceBaseSalary == null || fixedTotal >= sourceBaseSalary) {
      return {
        outputBaseSalary: fixedTotal,
        ordinaryMonthlyWage: fixedTotal,
        note: '고정급 합계 의미의 컬럼을 더존 업로드 기본급 칸에 반영했습니다.',
      }
    }
  }

  if (sourceBaseSalary != null && fixedComponents.length > 0 && fixedComponentSum > sourceBaseSalary) {
    return {
      outputBaseSalary: fixedComponentSum,
      ordinaryMonthlyWage: fixedComponentSum,
      note: '통상임금/고정급 합계 컬럼은 없지만 기본급+자격급/직책급 합계를 더존 업로드 기본급 칸에 반영했습니다.',
    }
  }

  return {
    outputBaseSalary: sourceBaseSalary,
    ordinaryMonthlyWage: fixedTotal ?? sourceBaseSalary,
    note: null,
  }
}

function periodMatches(value: string, payrollPeriod: string): boolean {
  const compactValue = value.replace(/\s+/g, '')
  const [year, month] = payrollPeriod.split('-')
  if (!year || !month) return compactValue.includes(payrollPeriod)
  const monthNumber = String(Number(month))
  return [
    payrollPeriod,
    `${year}.${month}`,
    `${year}/${month}`,
    `${year}${month}`,
    `${year}년${monthNumber}월`,
    `${year}년${month}월`,
  ].some((token) => compactValue.includes(token))
}

function basisPeriodApplies(value: string, payrollPeriod: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (periodMatches(trimmed, payrollPeriod)) return true
  const [year] = payrollPeriod.split('-')
  const compactValue = trimmed.replace(/\s+/g, '')
  if (!year) return false
  return [
    year,
    `${year}년`,
    `${year}년도`,
    `${year}전체`,
    `${year}년전체`,
  ].includes(compactValue)
}

function createEmployeeDeductionProfile(): EmployeeDeductionProfile {
  return {
    hasSource: false,
    basisAmount: null,
    nonTaxableAmount: null,
    dependentCount: null,
    childCount: null,
    incomeTax: null,
    localIncomeTax: null,
    applies: {},
    notes: [],
  }
}

function createEmptyDeductionBasisRule(): DeductionBasisRule {
  return {
    rate: null,
    lowerLimit: null,
    upperLimit: null,
    sourceLabel: null,
  }
}

function createDeductionBasisCatalog(): PayrollDeductionBasisCatalog {
  return {
    recognized: false,
    sourceLabels: [],
    components: {
      nationalPension: createEmptyDeductionBasisRule(),
      healthInsurance: createEmptyDeductionBasisRule(),
      longTermCare: createEmptyDeductionBasisRule(),
      employmentInsurance: createEmptyDeductionBasisRule(),
      incomeTax: createEmptyDeductionBasisRule(),
      localIncomeTax: createEmptyDeductionBasisRule(),
    },
  }
}

function addDeductionSourceLabel(catalog: PayrollDeductionBasisCatalog, label: string): void {
  catalog.recognized = true
  if (!catalog.sourceLabels.includes(label)) catalog.sourceLabels.push(label)
}

function getOrCreateEmployee(
  rows: Map<string, WorkingRow>,
  params: {
    employeeCode: string | null
    employeeName: string | null
  },
): WorkingRow {
  const codeKey = normalizeKey(params.employeeCode)
  const nameKey = normalizeKey(params.employeeName)
  const key = codeKey ? `code:${codeKey}` : nameKey ? `name:${nameKey}` : `unknown:${rows.size}`
  const existing = rows.get(key)
  if (existing) return existing

  const row: WorkingRow = {
    employeeCode: params.employeeCode,
    employeeName: params.employeeName,
    department: null,
    jobTitle: null,
    jobType: null,
    baseSalary: null,
    bonus: null,
    mealAllowance: null,
    transportationAllowance: null,
    fixedOvertimeAllowance: 0,
    vehicleMaintenanceAllowance: null,
    retroactivePay: null,
    childcareAllowance: null,
    rndAllowance: null,
    otherAllowance: null,
    welfareAllowance: null,
    domesticTravelAllowance: null,
    annualLeaveAllowanceAmount: null,
    payrollVerificationFailed: false,
    ordinaryMonthlyWage: null,
    overtimeHours: 0,
    holidayHours: 0,
    nightHours: 0,
    annualLeaveDays: 0,
    lateEarlyHours: 0,
    sources: [],
    notes: [],
    deductionProfile: createEmployeeDeductionProfile(),
  }
  rows.set(key, row)
  if (nameKey) rows.set(`name:${nameKey}`, row)
  if (codeKey) rows.set(`code:${codeKey}`, row)
  return row
}

function findExistingEmployee(
  rows: Map<string, WorkingRow>,
  params: {
    employeeCode: string | null
    employeeName: string | null
  },
): WorkingRow | null {
  const codeKey = normalizeKey(params.employeeCode)
  const nameKey = normalizeKey(params.employeeName)
  return (codeKey ? rows.get(`code:${codeKey}`) : null)
    ?? (nameKey ? rows.get(`name:${nameKey}`) : null)
    ?? null
}

function addSource(row: WorkingRow, source: Record<string, unknown>): void {
  row.sources.push(source)
}

function addNote(row: WorkingRow, note: string): void {
  if (!row.notes.includes(note)) row.notes.push(note)
}

function addDeductionProfileNote(profile: EmployeeDeductionProfile, note: string): void {
  if (!profile.notes.includes(note)) profile.notes.push(note)
}

function readLegacyMaster(sheet: ParsedSheet, rows: Map<string, WorkingRow>): boolean {
  const header = findFlexibleHeaderRow(sheet, [
    EMPLOYEE_CODE_ALIASES,
    EMPLOYEE_NAME_ALIASES,
    BASE_SALARY_ALIASES,
  ])
  if (!header) return false

  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, EMPLOYEE_NAME_ALIASES)
  const titleIdx = columnIndex(header, ['직급'])
  const jobTypeIdx = columnIndex(header, ['직명'])
  const baseIdx = columnIndexLoose(header, BASE_SALARY_ALIASES)
  const qualificationIdx = columnIndexLoose(header, QUALIFICATION_PAY_ALIASES)
  const dutyIdx = columnIndexLoose(header, POSITION_PAY_ALIASES)
  const ordinaryIdx = columnIndexLoose(header, FIXED_MONTHLY_WAGE_TOTAL_ALIASES)

  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeCode && !employeeName) continue

    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    target.employeeCode ||= employeeCode
    target.employeeName ||= employeeName
    target.jobTitle ||= cell(dataRow, titleIdx).trim() || null
    target.jobType ||= cell(dataRow, jobTypeIdx).trim() || null
    const fixedBaseSalary = resolveFixedBaseSalary({
      row: dataRow,
      baseIdx,
      qualificationIdx,
      dutyIdx,
      fixedTotalIdx: ordinaryIdx,
    })
    target.baseSalary ??= fixedBaseSalary.outputBaseSalary
    target.ordinaryMonthlyWage ??= fixedBaseSalary.ordinaryMonthlyWage
    if (fixedBaseSalary.note) {
      addNote(target, fixedBaseSalary.note)
    }
    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
    })
  }

  return true
}

function readPayrollInput(sheet: ParsedSheet, rows: Map<string, WorkingRow>): boolean {
  const header = findFlexibleHeaderRow(sheet, [
    EMPLOYEE_CODE_ALIASES,
    EMPLOYEE_NAME_ALIASES,
    BASE_SALARY_ALIASES,
  ])
  if (!header) return false

  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, EMPLOYEE_NAME_ALIASES)
  const deptIdx = columnIndex(header, ['부서'])
  const titleIdx = columnIndex(header, ['직급'])
  const jobTypeIdx = columnIndex(header, ['직종', '직명'])
  const baseIdx = columnIndexLoose(header, BASE_SALARY_ALIASES)
  const qualificationIdx = columnIndexLoose(header, QUALIFICATION_PAY_ALIASES)
  const dutyIdx = columnIndexLoose(header, POSITION_PAY_ALIASES)
  const ordinaryIdx = columnIndexLoose(header, FIXED_MONTHLY_WAGE_TOTAL_ALIASES)
  const bonusIdx = columnIndex(header, ['상여'])
  const mealIdx = columnIndex(header, ['식대'])
  const fixedOvertimeIdx = columnIndex(header, ['고정연장수당'])
  const transportIdx = columnIndex(header, ['교통비'])
  const vehicleIdx = columnIndexLoose(header, VEHICLE_MAINTENANCE_ALIASES)
  const retroactiveIdx = columnIndexLoose(header, RETROACTIVE_PAY_ALIASES)
  const childcareIdx = columnIndexLoose(header, CHILDCARE_ALLOWANCE_ALIASES)
  const nightHoursIdx = columnIndex(header, ['야간근무시간', '야간근로시간', '야간시간'])
  const annualLeaveDaysIdx = columnIndex(header, ['미사용연차', '미사용연차일수', '연차수당일수', '연차일수'])
  const lateEarlyIdx = columnIndex(header, ['조퇴/지각', '조퇴지각', '지각시간', '조퇴시간', '미근로시간'])
  const computedVariableIdx = columnIndex(header, ['변동수당'])
  const computedAnnualLeaveIdx = columnIndex(header, ['연차수당'])
  const deductionIdx = columnIndex(header, ['공제금액'])
  const totalBeforeDeductionIdx = columnIndex(header, ['공제전합계'])

  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeCode && !employeeName) continue

    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    target.employeeCode ||= employeeCode
    target.employeeName ||= employeeName
    target.department ||= cell(dataRow, deptIdx).trim() || null
    target.jobTitle ||= cell(dataRow, titleIdx).trim() || null
    target.jobType ||= cell(dataRow, jobTypeIdx).trim() || null
    const fixedBaseSalary = resolveFixedBaseSalary({
      row: dataRow,
      baseIdx,
      qualificationIdx,
      dutyIdx,
      fixedTotalIdx: ordinaryIdx,
    })
    target.baseSalary ??= fixedBaseSalary.outputBaseSalary
    target.ordinaryMonthlyWage ??= fixedBaseSalary.ordinaryMonthlyWage
    if (fixedBaseSalary.note) {
      addNote(target, fixedBaseSalary.note)
    }
    target.bonus ??= parseAmount(cell(dataRow, bonusIdx))
    target.mealAllowance ??= parseAmount(cell(dataRow, mealIdx))
    target.transportationAllowance ??= parseAmount(cell(dataRow, transportIdx))
    target.fixedOvertimeAllowance += parseAmount(cell(dataRow, fixedOvertimeIdx)) ?? 0
    target.vehicleMaintenanceAllowance ??= parseAmount(cell(dataRow, vehicleIdx))
    target.retroactivePay ??= parseAmount(cell(dataRow, retroactiveIdx))
    target.childcareAllowance ??= parseAmount(cell(dataRow, childcareIdx))
    target.nightHours += parseHours(cell(dataRow, nightHoursIdx)) ?? 0
    target.annualLeaveDays += parseHours(cell(dataRow, annualLeaveDaysIdx)) ?? 0
    target.lateEarlyHours += parseDurationHours(cell(dataRow, lateEarlyIdx)) ?? 0

    if (cell(dataRow, computedVariableIdx) || cell(dataRow, totalBeforeDeductionIdx)) {
      addNote(target, '원본의 변동수당/공제전합계는 이미 계산된 값으로 보고 검증용으로만 사용했습니다.')
    }
    if (cell(dataRow, computedAnnualLeaveIdx)) {
      addNote(target, '원본의 연차수당 금액은 이미 계산된 값으로 보고 검증용으로만 사용했습니다.')
    }
    if (cell(dataRow, deductionIdx)) {
      addNote(target, '공제금액 컬럼은 있으나 세금/4대보험 산출 기준자료가 없어 공제는 자료없음으로 처리했습니다.')
    }

    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
    })
  }

  return true
}

function readMonthlyPayrollLedger(sheet: ParsedSheet, rows: Map<string, WorkingRow>, payrollPeriod: string): boolean {
  if (!sheetMatchesPayrollPeriod(sheet, payrollPeriod)) return false

  const headerPair = findMonthlyLedgerHeaderPair(sheet)
  if (!headerPair) return false

  const { header, bottom } = headerPair
  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, EMPLOYEE_NAME_ALIASES)
  const employmentTypeIdx = columnIndex(header, ['구분', '고용형태', '직종'])
  const paidBaseIdx = columnIndexLoose(header, ['지급급여 기본급', '지급액 기본급', '지급 기본급'])
  const paidMealIdx = columnIndexLoose(header, ['지급급여 식대', '지급액 식대', '지급 식대'])
  const paidFixedOvertimeIdx = columnIndexLoose(header, [
    '지급급여 고정연장',
    '지급급여 고정 연장',
    '지급액 고정연장',
    '지급액 고정 연장',
  ])
  const paidTotalIdx = columnIndexLoose(header, [
    '지급급여 합계',
    '지급급여 지급액계',
    '지급액 합계',
    '지급 합계',
    '지급액계',
  ])
  const paidVehicleIdx = columnIndexLoose(header, VEHICLE_MAINTENANCE_ALIASES)
  const paidRetroactiveIdx = columnIndexLoose(header, RETROACTIVE_PAY_ALIASES)
  const paidChildcareIdx = columnIndexLoose(header, CHILDCARE_ALLOWANCE_ALIASES)
  const fixedTotalIdx = columnIndexLoose(header, [
    '고정급여 신고금액합계',
    '고정급여 신고금액',
    '고정급여 합계',
    '고정급여',
  ])

  if (nameIdx < 0 || (paidBaseIdx < 0 && paidTotalIdx < 0)) return false

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > bottom.rowNumber)) {
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeName) continue

    const paidBase = parseAmount(cell(dataRow, paidBaseIdx))
    const paidMeal = parseAmount(cell(dataRow, paidMealIdx))
    const paidFixedOvertime = parseAmount(cell(dataRow, paidFixedOvertimeIdx))
    const paidTotal = parseAmount(cell(dataRow, paidTotalIdx))
    const fixedTotal = parseAmount(cell(dataRow, fixedTotalIdx))
    const paidVehicle = parseAmount(cell(dataRow, paidVehicleIdx))
    const paidRetroactive = parseAmount(cell(dataRow, paidRetroactiveIdx))
    const paidChildcare = parseAmount(cell(dataRow, paidChildcareIdx))
    const outputBaseSalary = paidBase ?? paidTotal
    if (outputBaseSalary == null && paidMeal == null && paidFixedOvertime == null) continue

    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    target.employeeCode ||= employeeCode
    target.employeeName ||= employeeName
    target.jobType ||= cell(dataRow, employmentTypeIdx).trim() || null
    target.baseSalary ??= outputBaseSalary
    target.ordinaryMonthlyWage ??= fixedTotal ?? outputBaseSalary
    target.mealAllowance ??= paidMeal
    target.fixedOvertimeAllowance += paidFixedOvertime ?? 0
    target.vehicleMaintenanceAllowance ??= paidVehicle
    target.retroactivePay ??= paidRetroactive
    target.childcareAllowance ??= paidChildcare

    const paymentParts = [outputBaseSalary, paidMeal, paidFixedOvertime, paidVehicle, paidRetroactive, paidChildcare]
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0)
    if (paidTotal != null && paymentParts > 0 && !amountsMatch(paidTotal, paymentParts)) {
      addNote(target, `지급급여 합계(${formatWon(paidTotal)})와 인식된 지급 항목 합계(${formatWon(paymentParts)})가 달라 원본 확인이 필요합니다.`)
    }
    if (paidBase == null && paidTotal != null) {
      addNote(target, '월별 급여대장에 지급급여 합계만 있어 더존 업로드 기본급 칸에 지급급여 합계를 반영했습니다.')
    } else {
      addNote(target, '월별 급여대장 2단 헤더에서 요청월 지급급여 항목을 구조 추출했습니다.')
    }

    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'monthly-payroll-ledger',
    })
    matched = true
  }

  return matched
}

function readPersonnelPayrollSheet(sheet: ParsedSheet, rows: Map<string, WorkingRow>, payrollPeriod: string): boolean {
  if (!sheetMatchesPayrollPeriod(sheet, payrollPeriod)) return false

  const headerPair = findPersonnelPayrollHeaderPair(sheet)
  if (!headerPair) return false

  const { header, bottom } = headerPair
  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, EMPLOYEE_NAME_ALIASES)
  const baseIdx = columnIndexGroupedHeader(header, bottom, BASE_SALARY_ALIASES)
  const mealIdx = columnIndexGroupedHeader(header, bottom, ['식대'])
  const vehicleIdx = columnIndexGroupedHeader(header, bottom, VEHICLE_MAINTENANCE_ALIASES)
  const childcareIdx = columnIndexGroupedHeader(header, bottom, CHILDCARE_ALLOWANCE_ALIASES)
  const overtimeIdx = columnIndexGroupedHeader(header, bottom, ['연장근로수당', '연장근로'])
  const totalPayIdx = columnIndexGroupedHeader(header, bottom, ['총계'])
  const grossTaxIdx = columnIndexGroupedHeader(header, bottom, ['과세총액'])
  const incomeTaxIdx = columnIndexGroupedHeader(header, bottom, ['소득세'])
  const localTaxIdx = columnIndexGroupedHeader(header, bottom, ['주민세', '지방소득세'])

  if (nameIdx < 0 || baseIdx < 0) return false

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > bottom.rowNumber)) {
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeName || employeeName === '성명') continue
    const employeeCode = cell(dataRow, codeIdx).trim() || null
    if (isPersonnelPayrollNonEmployeeRow(employeeCode, employeeName)) continue

    const baseSalary = parseAmount(cell(dataRow, baseIdx))
    const mealAllowance = parseAmount(cell(dataRow, mealIdx))
    const vehicleAllowance = parseAmount(cell(dataRow, vehicleIdx))
    const childcareAllowance = parseAmount(cell(dataRow, childcareIdx))
    const overtimeAllowance = parseAmount(cell(dataRow, overtimeIdx))
    if (baseSalary == null && mealAllowance == null && vehicleAllowance == null && childcareAllowance == null) {
      continue
    }

    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    target.employeeCode ||= employeeCode
    target.employeeName ||= employeeName
    target.baseSalary ??= baseSalary
    target.ordinaryMonthlyWage ??= parseAmount(cell(dataRow, grossTaxIdx)) ?? baseSalary
    target.mealAllowance ??= mealAllowance
    target.vehicleMaintenanceAllowance ??= vehicleAllowance
    target.childcareAllowance ??= childcareAllowance
    target.fixedOvertimeAllowance += overtimeAllowance ?? 0

    const incomeTax = parseAmount(cell(dataRow, incomeTaxIdx))
    const localTax = parseAmount(cell(dataRow, localTaxIdx))
    if (incomeTax != null || localTax != null) {
      target.deductionProfile.hasSource = true
      target.deductionProfile.incomeTax ??= incomeTax
      target.deductionProfile.localIncomeTax ??= localTax
    }

    const totalPay = parseAmount(cell(dataRow, totalPayIdx))
    const paymentParts = [baseSalary, mealAllowance, vehicleAllowance, childcareAllowance, overtimeAllowance]
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0)
    if (totalPay != null && paymentParts > 0 && !amountsMatch(totalPay, paymentParts)) {
      addNote(target, `임금 총계(${formatWon(totalPay)})와 인식된 지급 항목 합계(${formatWon(paymentParts)})가 달라 원본 확인이 필요합니다.`)
    }

    addNote(target, '인적사항(임금 항목) 2단 헤더에서 급여 지급 항목을 구조 추출했습니다.')
    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'personnel-payroll-sheet',
    })
    matched = true
  }

  return matched
}

function readPeriodChanges(sheet: ParsedSheet, rows: Map<string, WorkingRow>, payrollPeriod: string): boolean {
  const header = findFlexibleHeaderRow(sheet, [
    ['급여기간', '기간', '귀속월', '적용월'],
    [...EMPLOYEE_CODE_ALIASES, ...EMPLOYEE_NAME_ALIASES],
  ])
  if (!header) return false

  const periodIdx = columnIndex(header, ['급여기간', '기간', '귀속월', '적용월'])
  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, ['이름', '성명'])
  const hireLeaveIdx = columnIndex(header, ['입퇴사기록'])
  const overtimeIdx = columnIndex(header, ['연장근로시간'])
  const weekendIdx = columnIndex(header, ['주말근무시간', '휴일근무시간'])
  const nightHoursIdx = columnIndex(header, ['야간근무시간', '야간근로시간', '야간시간'])
  const annualLeaveDaysIdx = columnIndex(header, ['미사용연차', '미사용연차일수', '연차수당일수', '연차일수'])
  const lateEarlyIdx = columnIndex(header, ['조퇴/지각', '조퇴지각', '지각시간', '조퇴시간', '미근로시간'])
  const mealIdx = columnIndex(header, ['식대'])

  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const period = cell(dataRow, periodIdx)
    if (period && !periodMatches(period, payrollPeriod)) continue

    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeCode && !employeeName) continue

    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    target.employeeCode ||= employeeCode
    target.employeeName ||= employeeName
    target.overtimeHours += parseHours(cell(dataRow, overtimeIdx)) ?? 0
    target.holidayHours += parseHours(cell(dataRow, weekendIdx)) ?? 0
    target.nightHours += parseHours(cell(dataRow, nightHoursIdx)) ?? 0
    target.annualLeaveDays += parseHours(cell(dataRow, annualLeaveDaysIdx)) ?? 0
    target.lateEarlyHours += parseDurationHours(cell(dataRow, lateEarlyIdx)) ?? 0
    target.mealAllowance ??= parseAmount(cell(dataRow, mealIdx))

    const hireLeave = cell(dataRow, hireLeaveIdx).trim()
    if (hireLeave) addNote(target, `입퇴사기록 확인 필요: ${hireLeave}`)
    const lateEarly = cell(dataRow, lateEarlyIdx).trim()
    if (lateEarly && parseDurationHours(lateEarly) == null) addNote(target, `조퇴/지각 입력값 확인 필요: ${lateEarly}`)

    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
    })
  }

  return true
}

function readVariableAllowanceHours(sheet: ParsedSheet, rows: Map<string, WorkingRow>, payrollPeriod: string): boolean {
  const header = findHeaderRow(sheet, ['직원코드', '성명', '근태대장 기준 시간'])
  if (!header) return false

  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, ['성명', '이름'])
  const allowanceTypeIdx = columnIndex(header, ['수당구분'])
  const basisDateIdx = columnIndex(header, ['기준일'])
  const hoursIdx = columnIndex(header, ['근태대장 기준 시간', '기준시간'])
  const amountIdx = columnIndex(header, ['금액'])

  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const basisDate = cell(dataRow, basisDateIdx)
    if (basisDate && !periodMatches(basisDate, payrollPeriod)) continue

    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const employeeName = cell(dataRow, nameIdx).trim() || null
    if (!employeeCode && !employeeName) continue

    const target = getOrCreateEmployee(rows, { employeeCode, employeeName })
    const hours = parseHours(cell(dataRow, hoursIdx)) ?? 0
    const allowanceType = cell(dataRow, allowanceTypeIdx)
    if (/야간/.test(allowanceType)) {
      target.nightHours += hours
    } else if (/연차/.test(allowanceType)) {
      target.annualLeaveDays += hours
    } else if (/휴일|주말/.test(allowanceType)) {
      target.holidayHours += hours
    } else {
      target.overtimeHours += hours
    }

    if (cell(dataRow, amountIdx)) {
      addNote(target, '원본 변동수당 금액은 이미 계산된 값으로 보고 사용하지 않았습니다.')
    }

    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
    })
  }

  return true
}

function readAttendanceSummary(sheet: ParsedSheet, rows: Map<string, WorkingRow>): boolean {
  const looksLikeAttendance = sheet.rows.some((row) => row.cells.some((item) => /연장근로|휴일근로|야간근로/.test(item)))
  if (!looksLikeAttendance) return false

  let matched = false
  for (const dataRow of sheet.rows) {
    const employeeName = cell(dataRow, 1).trim()
    const kind = cell(dataRow, 2)
    if (!employeeName || !/연장근로|휴일근로|야간근로/.test(kind)) continue

    const tailNumber = dataRow.cells
      .slice(33)
      .map(parseHours)
      .find((value) => value != null)
    if (tailNumber == null) continue

    const target = getOrCreateEmployee(rows, { employeeCode: null, employeeName })
    if (/야간근로/.test(kind)) {
      target.nightHours += tailNumber
    } else if (/휴일근로/.test(kind)) {
      target.holidayHours += tailNumber
    } else {
      target.overtimeHours += tailNumber
    }
    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
    })
    matched = true
  }

  return matched
}

function deductionComponentFromLabel(value: string): DeductionComponentKey | null {
  const normalized = normalizeHeader(value)
  if (/국민.*연금/.test(normalized)) return 'nationalPension'
  if (/건강.*보험|건보/.test(normalized)) return 'healthInsurance'
  if (/장기.*요양/.test(normalized)) return 'longTermCare'
  if (/고용.*보험/.test(normalized)) return 'employmentInsurance'
  if (/지방.*소득세|주민세/.test(normalized)) return 'localIncomeTax'
  if (/소득세|원천징수/.test(normalized)) return 'incomeTax'
  return null
}

function readDeductionBasisSheet(
  sheet: ParsedSheet,
  catalog: PayrollDeductionBasisCatalog,
  payrollPeriod: string,
): boolean {
  const header = findFlexibleHeaderRow(sheet, [
    ['항목', '구분', '공제항목', '보험구분', '기준명'],
    ['요율', '비율', '근로자요율', '직원부담요율'],
  ])
  if (!header) return false

  const itemIdx = columnIndex(header, ['항목', '구분', '공제항목', '보험구분', '기준명'])
  const rateIdx = columnIndex(header, ['요율', '비율', '근로자요율', '직원부담요율'])
  const lowerIdx = columnIndex(header, ['하한', '하한금액', '기준소득월액하한', '보수월액하한', '최저'])
  const upperIdx = columnIndex(header, ['상한', '상한금액', '기준소득월액상한', '보수월액상한', '최고'])
  const periodIdx = columnIndex(header, ['적용기간', '기간', '급여기간', '귀속월', '적용월'])

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    if (periodIdx >= 0 && !basisPeriodApplies(cell(dataRow, periodIdx), payrollPeriod)) continue

    const component = deductionComponentFromLabel(cell(dataRow, itemIdx))
    if (!component) continue

    const rate = parseRate(cell(dataRow, rateIdx))
    const lowerLimit = parseAmount(cell(dataRow, lowerIdx))
    const upperLimit = parseAmount(cell(dataRow, upperIdx))
    if (rate == null && lowerLimit == null && upperLimit == null) continue

    const rule = catalog.components[component]
    rule.rate ??= rate
    rule.lowerLimit ??= lowerLimit
    rule.upperLimit ??= upperLimit
    rule.sourceLabel ??= `${sheet.sheetName} 행${dataRow.rowNumber}`
    addDeductionSourceLabel(catalog, `${sheet.filename}/${sheet.sheetName}`)
    matched = true
  }

  return matched
}

function readEmployeeDeductionProfile(
  sheet: ParsedSheet,
  rows: Map<string, WorkingRow>,
  payrollPeriod: string,
): boolean {
  const header = findFlexibleHeaderRow(sheet, [
    [...EMPLOYEE_CODE_ALIASES, ...EMPLOYEE_NAME_ALIASES],
    ['기준보수월액', '기준소득월액', '소득세', '지방소득세', '비과세금액', '부양가족수', '자녀수', '국민연금', '건강보험', '고용보험'],
  ])
  if (!header) return false

  const codeIdx = columnIndex(header, EMPLOYEE_CODE_ALIASES)
  const nameIdx = columnIndex(header, ['성명', '이름'])
  const periodIdx = columnIndex(header, ['적용기간', '기간', '급여기간', '귀속월', '적용월'])
  const basisAmountIdx = columnIndex(header, ['기준보수월액', '기준소득월액', '보험기준보수', '기준보수', '보수월액'])
  const nonTaxableIdx = columnIndex(header, ['비과세금액', '비과세급여', '비과세'])
  const dependentIdx = columnIndex(header, ['부양가족수', '공제대상가족수'])
  const childIdx = columnIndex(header, ['자녀수'])
  const incomeTaxIdx = columnIndex(header, ['소득세', '근로소득세', '원천징수세액'])
  const localIncomeTaxIdx = columnIndex(header, ['지방소득세', '주민세'])
  const pensionApplyIdx = columnIndex(header, ['국민연금가입', '국민연금대상', '국민연금'])
  const healthApplyIdx = columnIndex(header, ['건강보험가입', '건강보험대상', '건강보험', '건보'])
  const longTermApplyIdx = columnIndex(header, ['장기요양가입', '장기요양대상', '장기요양'])
  const employmentApplyIdx = columnIndex(header, ['고용보험가입', '고용보험대상', '고용보험'])

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    if (periodIdx >= 0 && !basisPeriodApplies(cell(dataRow, periodIdx), payrollPeriod)) continue

    const employeeCode = cell(dataRow, codeIdx).trim() || null
    const employeeName = cell(dataRow, nameIdx).trim() || null
    const target = findExistingEmployee(rows, { employeeCode, employeeName })
    if (!target) continue

    const profile = target.deductionProfile
    profile.hasSource = true
    profile.basisAmount ??= parseAmount(cell(dataRow, basisAmountIdx))
    profile.nonTaxableAmount ??= parseAmount(cell(dataRow, nonTaxableIdx))
    profile.dependentCount ??= parseAmount(cell(dataRow, dependentIdx))
    profile.childCount ??= parseAmount(cell(dataRow, childIdx))
    profile.incomeTax ??= parseAmount(cell(dataRow, incomeTaxIdx))
    profile.localIncomeTax ??= parseAmount(cell(dataRow, localIncomeTaxIdx))

    const pensionFlag = parseBooleanFlag(cell(dataRow, pensionApplyIdx))
    const healthFlag = parseBooleanFlag(cell(dataRow, healthApplyIdx))
    const longTermFlag = parseBooleanFlag(cell(dataRow, longTermApplyIdx))
    const employmentFlag = parseBooleanFlag(cell(dataRow, employmentApplyIdx))
    if (pensionFlag != null) profile.applies.nationalPension = pensionFlag
    if (healthFlag != null) profile.applies.healthInsurance = healthFlag
    if (longTermFlag != null) profile.applies.longTermCare = longTermFlag
    if (employmentFlag != null) profile.applies.employmentInsurance = employmentFlag

    if (profile.nonTaxableAmount != null) {
      addDeductionProfileNote(profile, `직원별 비과세 금액 ${profile.nonTaxableAmount.toLocaleString('ko-KR')}원을 인식했습니다.`)
    }
    if (profile.dependentCount != null || profile.childCount != null) {
      addDeductionProfileNote(profile, `부양가족/자녀 수는 인식했지만 간이세액표 전체 엔진은 후속 작업 범위입니다.`)
    }

    addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'tax-deduction-basis',
    })
    matched = true
  }

  return matched
}

function roundWon(value: number): number {
  return Math.round(value)
}

function clampAmount(value: number, lowerLimit: number | null, upperLimit: number | null): number {
  if (lowerLimit != null && value < lowerLimit) return lowerLimit
  if (upperLimit != null && value > upperLimit) return upperLimit
  return value
}

function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

function calculateDeduction(
  row: WorkingRow,
  basis: PayrollDeductionBasisCatalog,
  ordinaryMonthlyWage: number | null,
): DeductionCalculation {
  const notes: string[] = []
  const missingComponents: string[] = []
  const calculatedNotes: string[] = []
  const profile = row.deductionProfile
  const basisAmount = profile.basisAmount ?? ordinaryMonthlyWage ?? row.baseSalary
  let total = 0
  let hasCalculatedComponent = false
  let healthInsuranceAmount: number | null = null
  let incomeTaxAmount: number | null = null
  const components: Record<DeductionComponentKey, number | null> = {
    nationalPension: null,
    healthInsurance: null,
    longTermCare: null,
    employmentInsurance: null,
    incomeTax: null,
    localIncomeTax: null,
  }

  const calculateRateComponent = (component: DeductionComponentKey): number | null => {
    const label = deductionComponentLabels[component]
    const applies = profile.applies[component]
    if (applies === false) {
      calculatedNotes.push(`${label}은 직원별 적용값에서 비대상으로 표시되어 0원 처리했습니다.`)
      hasCalculatedComponent = true
      components[component] = 0
      return 0
    }

    const rule = basis.components[component]
    if (rule.rate == null) {
      missingComponents.push(label)
      return null
    }
    if (basisAmount == null) {
      missingComponents.push(`${label} 기준보수`)
      return null
    }

    const cappedBasis = clampAmount(basisAmount, rule.lowerLimit, rule.upperLimit)
    const amount = roundWon(cappedBasis * rule.rate)
    total += amount
    hasCalculatedComponent = true
    components[component] = amount
    calculatedNotes.push(`${label} ${formatWon(amount)}(기준 ${formatWon(cappedBasis)}, 요율 ${(rule.rate * 100).toFixed(4).replace(/\.?0+$/, '')}%)`)
    return amount
  }

  calculateRateComponent('nationalPension')
  healthInsuranceAmount = calculateRateComponent('healthInsurance')

  if (profile.applies.longTermCare === false) {
    calculatedNotes.push('장기요양은 직원별 적용값에서 비대상으로 표시되어 0원 처리했습니다.')
    hasCalculatedComponent = true
    components.longTermCare = 0
  } else if (basis.components.longTermCare.rate == null) {
    missingComponents.push('장기요양')
  } else if (healthInsuranceAmount == null) {
    missingComponents.push('장기요양 기준 건강보험')
  } else {
    const amount = roundWon(healthInsuranceAmount * basis.components.longTermCare.rate)
    total += amount
    hasCalculatedComponent = true
    components.longTermCare = amount
    calculatedNotes.push(`장기요양 ${formatWon(amount)}(건강보험 ${formatWon(healthInsuranceAmount)} 기준)`)
  }

  calculateRateComponent('employmentInsurance')

  if (profile.incomeTax != null) {
    incomeTaxAmount = profile.incomeTax
    total += incomeTaxAmount
    hasCalculatedComponent = true
    components.incomeTax = incomeTaxAmount
    calculatedNotes.push(`소득세 ${formatWon(incomeTaxAmount)}(직원별 적용값)`)
  } else {
    missingComponents.push('소득세')
  }

  if (profile.localIncomeTax != null) {
    total += profile.localIncomeTax
    hasCalculatedComponent = true
    components.localIncomeTax = profile.localIncomeTax
    calculatedNotes.push(`지방소득세 ${formatWon(profile.localIncomeTax)}(직원별 적용값)`)
  } else if (basis.components.localIncomeTax.rate != null && incomeTaxAmount != null) {
    const amount = roundWon(incomeTaxAmount * basis.components.localIncomeTax.rate)
    total += amount
    hasCalculatedComponent = true
    components.localIncomeTax = amount
    calculatedNotes.push(`지방소득세 ${formatWon(amount)}(소득세 기준 요율 ${(basis.components.localIncomeTax.rate * 100).toFixed(4).replace(/\.?0+$/, '')}%)`)
  } else {
    missingComponents.push('지방소득세')
  }

  notes.push(...profile.notes)
  if (calculatedNotes.length > 0) {
    notes.push(`세금/공제 기준자료로 계산한 항목: ${calculatedNotes.join(', ')}.`)
  }
  if (missingComponents.length > 0) {
    notes.push(`세금/공제 기준자료 부족 항목은 자료없음으로 남겼습니다: ${[...new Set(missingComponents)].join(', ')}.`)
  }

  if (!hasCalculatedComponent) {
    notes.push('세금/공제 기준자료가 없어 내부 계산 흐름에는 0을 사용했지만 공제금액은 자료없음으로 처리했습니다.')
    return { amount: null, components, notes }
  }

  return { amount: total, components, notes }
}

function toSourceReference(sources: Record<string, unknown>[]): Record<string, unknown> | null {
  if (sources.length === 0) return null
  if (sources.length === 1) return sources[0]
  return { sources: sources.slice(0, 20) }
}

function toExtractedRows(rows: Map<string, WorkingRow>, basis: PayrollDeductionBasisCatalog): PayrollExtractedRow[] {
  const uniqueRows = [...new Set(rows.values())]
  return uniqueRows
    .filter(shouldEmitStructuredPayrollRow)
    .map((row) => {
      const ordinaryMonthlyWage = row.ordinaryMonthlyWage ?? row.baseSalary
      const ordinaryHourlyWage = ordinaryMonthlyWage
        ? ordinaryMonthlyWage / DEFAULT_MONTHLY_WORK_HOURS
        : null
      const computedOvertimeAllowance = ordinaryHourlyWage
        ? roundWon(ordinaryHourlyWage * row.overtimeHours * 1.5)
        : 0
      const overtimeAllowanceTotal = computedOvertimeAllowance + row.fixedOvertimeAllowance
      const overtimeAllowance = overtimeAllowanceTotal > 0 ? overtimeAllowanceTotal : null
      const holidayWorkAllowance = ordinaryHourlyWage && row.holidayHours > 0
        ? roundWon(ordinaryHourlyWage * row.holidayHours * 1.5)
        : null
      const nightWorkAllowance = ordinaryHourlyWage && row.nightHours > 0
        ? roundWon(ordinaryHourlyWage * row.nightHours * 0.5)
        : null
      const annualLeaveAllowance = row.annualLeaveAllowanceAmount ?? (
        ordinaryHourlyWage && row.annualLeaveDays > 0
          ? roundWon(ordinaryHourlyWage * 8 * row.annualLeaveDays)
          : null
      )
      const lateEarlyDeduction = ordinaryHourlyWage && row.lateEarlyHours > 0
        ? roundWon(ordinaryHourlyWage * row.lateEarlyHours)
        : null
      const deduction = calculateDeduction(row, basis, ordinaryMonthlyWage)

      const notes = [
        ...row.notes,
        ...deduction.notes,
        `통상시급은 ${ordinaryMonthlyWage ? '통상임금 또는 기본급' : '자료 없음'} / ${DEFAULT_MONTHLY_WORK_HOURS}시간 기준으로 계산했습니다.`,
        row.overtimeHours > 0 ? `연장근로수당은 ${row.overtimeHours}시간 x 1.5배 근로기준법 기본 기준으로 계산해 연장근무 칸에 반영했습니다.` : null,
        row.fixedOvertimeAllowance > 0 ? `고정연장수당 ${formatWon(row.fixedOvertimeAllowance)}은 연장근무 칸에 반영했습니다.` : null,
        row.holidayHours > 0 ? `휴일/주말근무수당은 ${row.holidayHours}시간 x 1.5배 근로기준법 기본 기준으로 계산했습니다. 8시간 초과 휴일근로 세분화는 담당자 확인이 필요합니다.` : null,
        row.nightHours > 0 ? `야간근무수당은 ${row.nightHours}시간 x 0.5배 근로기준법 기본 기준으로 계산했습니다.` : null,
        row.annualLeaveDays > 0 ? `연차수당은 미사용 연차 ${row.annualLeaveDays}일 x 1일 통상임금 기준으로 계산했습니다. 연차 발생/사용촉진 여부는 담당자 확인이 필요합니다.` : null,
        row.welfareAllowance != null
          ? 'Welfare Allowance는 SampleC 고객 규칙에 따라 더존 업로드 컬럼 매핑 확인이 필요합니다.'
          : null,
        lateEarlyDeduction != null ? `조퇴/지각 기본 차감 초안은 ${row.lateEarlyHours}시간 x 통상시급 = ${formatWon(lateEarlyDeduction)}입니다. 별도 공제 필드가 없어 memo에만 표시했습니다.` : null,
        '회사별 계산규칙 미제공 항목은 기본 법정규칙을 적용했으며 담당자 확인이 필요합니다.',
      ].filter((note): note is string => Boolean(note))

      const hasIdentity = Boolean(row.employeeCode || row.employeeName)
      const hasWageBasis = Boolean(row.baseSalary || row.ordinaryMonthlyWage)
      const passesVerification = !row.payrollVerificationFailed
      const combinedOtherAllowance = (row.otherAllowance ?? 0) + (row.welfareAllowance ?? 0)

      return {
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        department: row.department,
        jobTitle: row.jobTitle,
        jobType: row.jobType,
        baseSalary: row.baseSalary,
        bonus: row.bonus,
        mealAllowance: row.mealAllowance,
        transportationAllowance: row.transportationAllowance,
        holidayWorkAllowance,
        domesticTravelAllowance: row.domesticTravelAllowance,
        annualLeaveAllowance,
        rndAllowance: row.rndAllowance,
        otherAllowance: combinedOtherAllowance > 0 ? combinedOtherAllowance : null,
        performanceIncentive: null,
        nightWorkAllowance,
        vehicleMaintenanceAllowance: row.vehicleMaintenanceAllowance,
        retroactivePay: row.retroactivePay,
        overtimeAllowance,
        childcareAllowance: row.childcareAllowance,
        nationalPension: deduction.components.nationalPension,
        healthInsurance: deduction.components.healthInsurance,
        longTermCare: deduction.components.longTermCare,
        employmentInsurance: deduction.components.employmentInsurance,
        incomeTax: deduction.components.incomeTax,
        localIncomeTax: deduction.components.localIncomeTax,
        otherDeduction: null,
        deductionAmount: deduction.amount,
        memo: notes.join(' '),
        confidence: row.baseSalary || row.ordinaryMonthlyWage ? 'high' : 'medium',
        aiVerdict: hasIdentity && hasWageBasis && passesVerification ? 'pass' : 'fail',
        aiVerdictReason: hasIdentity && hasWageBasis && passesVerification
          ? null
          : row.payrollVerificationFailed
            ? 'SampleC Payroll 참고 시트와 구조 추출 기본급이 일치하지 않습니다. 담당자 확인이 필요합니다.'
            : '직원 식별정보 또는 임금 기준자료가 부족합니다.',
        sourceReference: toSourceReference(row.sources),
      }
    })
}

export function extractStructuredPayrollFromSourceTexts(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): { success: true; data: PayrollExtractionResponse } | null {
  const sheets = parseSheets(fileTexts)
  if (sheets.length === 0) return null

  const rows = new Map<string, WorkingRow>()
  const deductionBasis = createDeductionBasisCatalog()
  let recognizedSheets = 0

  for (const sheet of sheets) {
    if (readMonthlyPayrollLedger(sheet, rows, payrollPeriod)) {
      recognizedSheets += 1
      continue
    }
    if (readPersonnelPayrollSheet(sheet, rows, payrollPeriod)) {
      recognizedSheets += 1
      continue
    }
    if (readPayrollInput(sheet, rows)) {
      recognizedSheets += 1
      continue
    }
    if (readLegacyMaster(sheet, rows)) {
      recognizedSheets += 1
      continue
    }
    if (readPeriodChanges(sheet, rows, payrollPeriod)) {
      recognizedSheets += 1
      continue
    }
    if (readVariableAllowanceHours(sheet, rows, payrollPeriod)) {
      recognizedSheets += 1
      continue
    }
    if (readAttendanceSummary(sheet, rows)) {
      recognizedSheets += 1
      continue
    }
    if (readDeductionBasisSheet(sheet, deductionBasis, payrollPeriod)) {
      recognizedSheets += 1
    }
  }

  for (const sheet of sheets) {
    if (readEmployeeDeductionProfile(sheet, rows, payrollPeriod)) {
      recognizedSheets += 1
    }
  }

  const sampleCResult = processSampleCStructuredSheets(
    sheets,
    rows as Map<string, SampleCMutableEmployeeRow>,
    {
      payrollPeriod,
      getOrCreateEmployee: (params) => getOrCreateEmployee(rows, params),
      addNote: (row, note) => {
        addNote(row as WorkingRow, note)
      },
      addSource: (row, source) => {
        addSource(row as WorkingRow, source)
      },
    },
  )
  recognizedSheets += sampleCResult.recognizedSheets

  if (recognizedSheets === 0 || rows.size === 0) return null

  const extractedRows = toExtractedRows(rows, deductionBasis)
  if (extractedRows.length === 0) return null

  const hasEmployeeDeductionBasis = [...new Set(rows.values())].some((row) => row.deductionProfile.hasSource)
  const hasDeductionBasis = deductionBasis.recognized || hasEmployeeDeductionBasis

  return {
    success: true,
    data: {
      payrollPeriod,
      rows: extractedRows,
      warnings: [
        sampleCResult.recognizedSheets > 0
          ? 'SampleC Master/Movement/Payroll/Input(Overtime Mar·Apr) 시트를 User ID 기준으로 구조 추출했습니다.'
          : '기초자료/근태·변동자료를 구조화해 급여대장 초안 지급 항목을 계산했습니다.',
        ...sampleCResult.warnings,
        hasDeductionBasis
          ? '세금/공제 기준자료 일부를 인식해 계산 가능한 공제 항목만 반영하고 부족 항목은 자료없음으로 처리했습니다.'
          : '세금/공제 기준자료가 없어 공제금액은 자료없음(null)으로 처리했습니다.',
        '회사별 계산규칙이 명시되지 않은 항목은 기본 법정규칙을 적용했으며 담당자 확인이 필요합니다.',
        '이미 계산된 변동수당/공제전합계/결과성 시트 금액은 최종값으로 사용하지 않고 검증용으로만 취급했습니다.',
      ],
    },
  }
}

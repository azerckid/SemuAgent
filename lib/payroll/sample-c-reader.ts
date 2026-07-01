import {
  extractPayrollInternalPolicyCandidates,
  formatPayrollInternalPolicyWarning,
} from '@/lib/payroll/internal-policy-notes'

type ParsedRow = {
  rowNumber: number
  cells: string[]
}

export type ParsedSheet = {
  filename: string
  sheetName: string
  rows: ParsedRow[]
}

export interface SampleCMutableEmployeeRow {
  employeeCode: string | null
  employeeName: string | null
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalary: number | null
  bonus: number | null
  mealAllowance: number | null
  fixedOvertimeAllowance: number
  vehicleMaintenanceAllowance: number | null
  retroactivePay: number | null
  childcareAllowance: number | null
  rndAllowance: number | null
  otherAllowance: number | null
  welfareAllowance: number | null
  domesticTravelAllowance: number | null
  annualLeaveAllowanceAmount: number | null
  ordinaryMonthlyWage: number | null
  overtimeHours: number
  payrollVerificationFailed: boolean
  notes: string[]
  sources: Record<string, unknown>[]
}

export type SampleCReaderEnv = {
  payrollPeriod: string
  getOrCreateEmployee: (params: {
    employeeCode: string | null
    employeeName: string | null
  }) => SampleCMutableEmployeeRow
  addNote: (row: SampleCMutableEmployeeRow, note: string) => void
  addSource: (row: SampleCMutableEmployeeRow, source: Record<string, unknown>) => void
}

const SAMPLE_C_USER_ID_ALIASES = ['userid', 'code']
const SAMPLE_C_BASE_SALARY_ALIASES = ['basesalary', 'monthlysalary']

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, '').replace(/[()/_-]/g, '').toLowerCase()
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

function cell(row: ParsedRow, index: number): string {
  return index >= 0 ? row.cells[index] ?? '' : ''
}

function columnIndex(header: ParsedRow, aliases: string[]): number {
  return header.cells.findIndex((value) => aliases.includes(normalizeHeader(value)))
}

function columnIndexLoose(header: ParsedRow, aliases: string[]): number {
  return header.cells.findIndex((value) => {
    const normalizedCell = normalizeHeader(value)
    return aliases.some((alias) => (
      normalizedCell === alias || (alias.length >= 4 && normalizedCell.includes(alias))
    ))
  })
}

function amountsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1
}

function sampleCMonthLabelMatches(label: string, payrollPeriod: string): boolean {
  const trimmed = label.trim()
  if (!trimmed) return false
  const [year, month] = payrollPeriod.split('-')
  if (!year || !month) return false
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) return false
  const shortYear = year.slice(-2)
  return trimmed === `${monthNames[monthIndex]}-${shortYear}`
}

function formatSampleCPayrollPeriodLabel(payrollPeriod: string): string {
  const [year, month] = payrollPeriod.split('-')
  if (!year || !month) return payrollPeriod
  return `${year}년 ${Number(month)}월`
}

function formatSampleCTargetMonthLabel(payrollPeriod: string): string {
  const [year, month] = payrollPeriod.split('-')
  if (!year || !month) return payrollPeriod
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) return payrollPeriod
  return `${monthNames[monthIndex]}-${year.slice(-2)}`
}

const SAMPLE_C_MONTH_LABEL_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}$/i

function collectSampleCMonthLabels(
  sheet: ParsedSheet,
  monthIdx: number,
  afterRowNumber: number,
): string[] {
  const labels = new Set<string>()
  for (const row of sheet.rows.filter((entry) => entry.rowNumber > afterRowNumber)) {
    const label = cell(row, monthIdx).trim()
    if (label && SAMPLE_C_MONTH_LABEL_PATTERN.test(label)) {
      labels.add(label)
    }
  }
  return [...labels]
}

function buildSampleCNonTargetMonthPolicyWarning(params: {
  sheetLabel: string
  monthLabels: string[]
  payrollPeriod: string
}): string | null {
  const targetMonthLabel = formatSampleCTargetMonthLabel(params.payrollPeriod)
  const nonTargetLabels = params.monthLabels.filter((label) => (
    !sampleCMonthLabelMatches(label, params.payrollPeriod)
  ))
  if (nonTargetLabels.length === 0) return null

  return [
    `${params.sheetLabel} 시트에 ${nonTargetLabels.join(', ')} 등 비대상 월 데이터가 있습니다.`,
    `구조 추출·검증은 요청 급여 기간(${formatSampleCPayrollPeriodLabel(params.payrollPeriod)}, ${targetMonthLabel}) 행만 수행했습니다.`,
  ].join(' ')
}

function employeeHasSampleCInputOvertimeSources(row: SampleCMutableEmployeeRow): boolean {
  return row.sources.some((source) => (
    source.kind === 'sample-c-overtime-mar' || source.kind === 'sample-c-overtime-apr'
  ))
}

function isSampleCMasterSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'master'
}

function isSampleCMovementSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'movement'
}

function isSampleCPayrollSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'payroll'
}

function isSampleCOvertimeMarSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'overtimemar'
}

function isSampleCOvertimeAprSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'overtimeapr'
}

function isSampleCTempEmployeesSheet(sheet: ParsedSheet): boolean {
  return normalizeHeader(sheet.sheetName) === 'tempemployees'
}

function findSampleCHeaderRow(sheet: ParsedSheet, requiredAliases: string[][]): ParsedRow | null {
  return sheet.rows.find((row) => (
    requiredAliases.every((aliases) => row.cells.some((cell) => aliases.includes(normalizeHeader(cell))))
  )) ?? null
}

function readEmployeeId(row: ParsedRow, primaryIdx: number, fallbackIdx = -1): string | null {
  const primary = cell(row, primaryIdx).trim()
  if (primary && primary !== '-') return primary
  if (fallbackIdx >= 0) {
    const fallback = cell(row, fallbackIdx).trim()
    if (fallback && fallback !== '-') return fallback
  }
  for (const value of row.cells.slice(0, 4)) {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) return trimmed
  }
  return null
}

function accumulateAmount(current: number | null, next: number | null): number | null {
  if (next == null) return current
  return (current ?? 0) + next
}

export function readSampleCMasterSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
): boolean {
  if (!isSampleCMasterSheet(sheet)) return false

  const header = findSampleCHeaderRow(sheet, [
    SAMPLE_C_USER_ID_ALIASES,
    SAMPLE_C_BASE_SALARY_ALIASES,
  ])
  if (!header) return false

  const userIdIdx = columnIndexLoose(header, SAMPLE_C_USER_ID_ALIASES)
  const departmentIdx = columnIndexLoose(header, ['department'])
  const jobTitleIdx = columnIndexLoose(header, ['jobtitlerank', 'jobtitle'])
  const jobTypeIdx = columnIndexLoose(header, ['급여구분'])
  const baseSalaryIdx = columnIndexLoose(header, ['basesalary'])
  const monthlySalaryIdx = columnIndexLoose(header, ['monthlysalary'])
  const otMonthlyIdx = columnIndexLoose(header, ['otallowancemonthly'])
  const carIdx = columnIndexLoose(header, ['carallowancenontax', 'carallowance'])
  const rndIdx = columnIndexLoose(header, ['rdallowancenontax', 'rdallowance'])
  const welfareIdx = columnIndexLoose(header, ['welfareallowance'])
  const childcareIdx = columnIndexLoose(header, ['childtuitionallowancenontax', 'childtuition'])
  const otherAllowanceIdxs = header.cells
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => normalizeHeader(value).includes('otherallowance'))
    .map(({ index }) => index)

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const employeeCode = readEmployeeId(dataRow, userIdIdx)
    if (!employeeCode) continue

    const baseSalary = parseAmount(cell(dataRow, baseSalaryIdx))
    const monthlySalary = parseAmount(cell(dataRow, monthlySalaryIdx))
    if (baseSalary == null && monthlySalary == null) continue

    const target = env.getOrCreateEmployee({ employeeCode, employeeName: null })
    target.employeeCode = employeeCode
    target.department ||= cell(dataRow, departmentIdx).trim() || null
    target.jobTitle ||= cell(dataRow, jobTitleIdx).trim() || null
    target.jobType ||= cell(dataRow, jobTypeIdx).trim() || null
    target.baseSalary ??= baseSalary ?? monthlySalary
    target.ordinaryMonthlyWage ??= monthlySalary ?? baseSalary
    target.fixedOvertimeAllowance += parseAmount(cell(dataRow, otMonthlyIdx)) ?? 0
    target.vehicleMaintenanceAllowance ??= parseAmount(cell(dataRow, carIdx))
    target.rndAllowance = accumulateAmount(target.rndAllowance, parseAmount(cell(dataRow, rndIdx)))
    target.welfareAllowance = accumulateAmount(target.welfareAllowance, parseAmount(cell(dataRow, welfareIdx)))
    target.childcareAllowance ??= parseAmount(cell(dataRow, childcareIdx))

    for (const index of otherAllowanceIdxs) {
      target.otherAllowance = accumulateAmount(target.otherAllowance, parseAmount(cell(dataRow, index)))
    }

    if (target.welfareAllowance != null) {
      env.addNote(
        target,
        'Welfare Allowance는 SampleC 고객 규칙에 따라 더존 업로드 컬럼 매핑 확인이 필요합니다.',
      )
    }

    env.addNote(target, 'SampleC Master 시트에서 User ID 기준 고정 급여/수당을 구조 추출했습니다.')
    env.addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'sample-c-master',
    })
    matched = true
  }

  return matched
}

export function readSampleCMovementSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
): boolean {
  if (!isSampleCMovementSheet(sheet)) return false

  const header = findSampleCHeaderRow(sheet, [
    SAMPLE_C_USER_ID_ALIASES,
    ['month'],
  ])
  if (!header) return false

  const userIdIdx = columnIndexLoose(header, SAMPLE_C_USER_ID_ALIASES)
  const monthIdx = columnIndexLoose(header, ['month'])
  const otAdditionalIdx = columnIndexLoose(header, ['otallowanceadditional'])
  const annualLeaveIdx = columnIndexLoose(header, ['annualleaveallowance'])
  const bonusIdx = columnIndexLoose(header, ['bonus'])
  const retroIdx = columnIndexLoose(header, ['retroactivesalary'])
  const overtimeSubHeader = sheet.rows.find((row) => (
    row.rowNumber > header.rowNumber
    && columnIndexLoose(row, ['연장x1.5']) >= 0
    && columnIndexLoose(row, ['야간x0.5']) >= 0
  )) ?? null
  const weekdayOtIdx = overtimeSubHeader ? columnIndexLoose(overtimeSubHeader, ['연장x1.5']) : -1
  const nightOtIdx = overtimeSubHeader ? columnIndexLoose(overtimeSubHeader, ['야간x0.5']) : -1
  const holidayOtIdx = overtimeSubHeader ? columnIndexLoose(overtimeSubHeader, ['휴일x1.5']) : -1
  const holidayExtendedOtIdx = overtimeSubHeader
    ? columnIndexLoose(overtimeSubHeader, ['휴일연x0.5', '휴일연'])
    : -1

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const monthLabel = cell(dataRow, monthIdx).trim()
    if (!sampleCMonthLabelMatches(monthLabel, env.payrollPeriod)) continue

    const employeeCode = readEmployeeId(dataRow, userIdIdx, userIdIdx - 1)
    if (!employeeCode) continue

    const target = env.getOrCreateEmployee({ employeeCode, employeeName: null })
    target.employeeCode = employeeCode
    target.fixedOvertimeAllowance += parseAmount(cell(dataRow, otAdditionalIdx)) ?? 0
    target.bonus = accumulateAmount(target.bonus, parseAmount(cell(dataRow, bonusIdx)))
    target.retroactivePay = accumulateAmount(target.retroactivePay, parseAmount(cell(dataRow, retroIdx)))
    target.annualLeaveAllowanceAmount = accumulateAmount(
      target.annualLeaveAllowanceAmount,
      parseAmount(cell(dataRow, annualLeaveIdx)),
    )

    if (!employeeHasSampleCInputOvertimeSources(target)) {
      const weekdayHours = parseHours(cell(dataRow, weekdayOtIdx))
      const nightHours = parseHours(cell(dataRow, nightOtIdx))
      const holidayHours = parseHours(cell(dataRow, holidayOtIdx))
      const holidayExtendedHours = parseHours(cell(dataRow, holidayExtendedOtIdx))
      if (weekdayHours != null) target.overtimeHours += weekdayHours
      if (nightHours != null) target.overtimeHours += nightHours
      if (holidayHours != null) target.overtimeHours += holidayHours
      if (holidayExtendedHours != null) target.overtimeHours += holidayExtendedHours

      if (weekdayHours != null || nightHours != null || holidayHours != null || holidayExtendedHours != null) {
        env.addNote(
          target,
          `SampleC Movement(${monthLabel}) 시간외근로 시간을 Input OT 미제공 User ID ${employeeCode}에 반영했습니다.`,
        )
        env.addSource(target, {
          filename: sheet.filename,
          sheetName: sheet.sheetName,
          rowHint: `행${dataRow.rowNumber}`,
          kind: 'sample-c-movement-overtime-hours',
        })
      }
    }

    env.addNote(target, `SampleC Movement(${monthLabel}) 변동 수당을 User ID ${employeeCode}에 반영했습니다.`)
    env.addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'sample-c-movement',
    })
    matched = true
  }

  return matched
}

type SampleCOvertimeSheetKind = 'mar' | 'apr'

function readSampleCOvertimeSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
  kind: SampleCOvertimeSheetKind,
): boolean {
  const isTargetSheet = kind === 'mar'
    ? isSampleCOvertimeMarSheet(sheet)
    : isSampleCOvertimeAprSheet(sheet)
  if (!isTargetSheet) return false

  const header = sheet.rows.find((row) => normalizeHeader(cell(row, 0)) === 'code') ?? null
  if (!header) return false

  const codeIdx = columnIndex(header, ['code'])
  const totalIdx = columnIndex(header, ['total'])
  const otIdx = columnIndex(header, ['ot'])
  const nightIdx = columnIndexLoose(header, ['otnight'])
  const holidayIdx = columnIndexLoose(header, ['holidaywork'])
  const holidayOtIdx = columnIndexLoose(header, ['holidayot'])
  const sheetLabel = kind === 'mar' ? 'Mar' : 'Apr'
  const sourceKind = kind === 'mar' ? 'sample-c-overtime-mar' : 'sample-c-overtime-apr'
  const payrollPeriodLabel = formatSampleCPayrollPeriodLabel(env.payrollPeriod)

  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const employeeCode = cell(dataRow, codeIdx).trim()
    if (!employeeCode || employeeCode === '-') continue

    const otHours = parseHours(cell(dataRow, otIdx))
    const nightHours = parseHours(cell(dataRow, nightIdx))
    const holidayHours = parseHours(cell(dataRow, holidayIdx))
    const holidayOtHours = parseHours(cell(dataRow, holidayOtIdx))
    const summedDayHours = dataRow.cells
      .slice(codeIdx + 3, totalIdx >= 0 ? totalIdx : dataRow.cells.length)
      .map(parseHours)
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0)

    const overtimeHours = otHours ?? (summedDayHours > 0 ? summedDayHours : null)
    if (overtimeHours == null && nightHours == null && holidayHours == null && holidayOtHours == null) {
      continue
    }

    const target = env.getOrCreateEmployee({ employeeCode, employeeName: null })
    target.employeeCode = employeeCode
    target.overtimeHours += overtimeHours ?? 0
    if (nightHours != null) target.overtimeHours += nightHours
    if (holidayHours != null) target.overtimeHours += holidayHours
    if (holidayOtHours != null) target.overtimeHours += holidayOtHours

    env.addNote(
      target,
      `SampleC Overtime (${sheetLabel}) 시트의 OT 시간을 ${payrollPeriodLabel} 급여 변동으로 반영했습니다.`,
    )
    env.addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: sourceKind,
    })
    matched = true
  }

  return matched
}

export function readSampleCOvertimeMarSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
): boolean {
  return readSampleCOvertimeSheet(sheet, env, 'mar')
}

export function readSampleCOvertimeAprSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
): boolean {
  return readSampleCOvertimeSheet(sheet, env, 'apr')
}

export function readSampleCTempEmployeesSheet(
  sheet: ParsedSheet,
  env: SampleCReaderEnv,
): boolean {
  if (!isSampleCTempEmployeesSheet(sheet)) return false

  const header = sheet.rows.find((row) => (
    row.cells.some((value) => normalizeHeader(value) === '성명')
    && row.cells.some((value) => normalizeHeader(value).includes('실지급'))
  )) ?? null
  if (!header) return false

  const nameIdx = columnIndex(header, ['성명'])

  let tempIndex = 0
  let matched = false
  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > header.rowNumber)) {
    const amounts = dataRow.cells
      .map((value) => parseAmount(value))
      .filter((value): value is number => value != null && value >= 1000)
    const payAmount = amounts.length > 0 ? amounts[amounts.length - 1] : null
    if (payAmount == null) continue

    tempIndex += 1
    const employeeName = cell(dataRow, nameIdx).trim() || null
    const employeeCode = `TEMP-${String(tempIndex).padStart(3, '0')}`
    const target = env.getOrCreateEmployee({ employeeCode, employeeName })
    target.employeeCode = employeeCode
    target.employeeName = employeeName
    target.baseSalary ??= payAmount
    target.jobType ||= '일용직'

    env.addNote(target, 'SampleC Temp Employees(일용지급대장)에서 일용직 급여를 별도 row로 반영했습니다.')
    env.addSource(target, {
      filename: sheet.filename,
      sheetName: sheet.sheetName,
      rowHint: `행${dataRow.rowNumber}`,
      kind: 'sample-c-temp-employee',
    })
    matched = true
  }

  return matched
}

export function readSampleCInputMemoSheet(
  sheet: ParsedSheet,
): string[] {
  if (normalizeHeader(sheet.sheetName) !== 'employeemasterdata') return []

  const joined = sheet.rows.map((row) => row.cells.join(' ')).join('\n')
  return extractPayrollInternalPolicyCandidates(joined)
    .map(formatPayrollInternalPolicyWarning)
}

type PayrollReferenceRow = {
  employeeCode: string
  baseSalary: number
}

function findRowByEmployeeCode(
  rows: Map<string, SampleCMutableEmployeeRow>,
  employeeCode: string,
): SampleCMutableEmployeeRow | null {
  const normalized = employeeCode.replace(/\s+/g, '').trim().toLowerCase()
  const keyed = rows.get(`code:${normalized}`)
  if (keyed) return keyed
  return [...new Set(rows.values())].find((row) => (
    row.employeeCode?.replace(/\s+/g, '').trim() === employeeCode.trim()
  )) ?? null
}

function readSampleCPayrollReferenceRows(
  sheet: ParsedSheet,
  payrollPeriod: string,
): PayrollReferenceRow[] {
  if (!isSampleCPayrollSheet(sheet)) return []

  const subHeader = sheet.rows.find((row) => (
    columnIndexLoose(row, ['month']) >= 0 && columnIndexLoose(row, ['basesalary']) >= 0
  )) ?? null
  if (!subHeader) return []

  const monthIdx = columnIndexLoose(subHeader, ['month'])
  const baseIdx = columnIndexLoose(subHeader, ['basesalary'])
  const references: PayrollReferenceRow[] = []

  for (const dataRow of sheet.rows.filter((row) => row.rowNumber > subHeader.rowNumber)) {
    const monthLabel = cell(dataRow, monthIdx).trim()
    if (!sampleCMonthLabelMatches(monthLabel, payrollPeriod)) continue

    const employeeCode = readEmployeeId(dataRow, 1, 0)
    const baseSalary = parseAmount(cell(dataRow, baseIdx))
    if (!employeeCode || baseSalary == null) continue

    references.push({ employeeCode, baseSalary })
  }

  return references
}

export function verifySampleCPayrollReferences(
  sheets: ParsedSheet[],
  rows: Map<string, SampleCMutableEmployeeRow>,
  payrollPeriod: string,
  addNote: SampleCReaderEnv['addNote'],
): string[] {
  const payrollSheet = sheets.find(isSampleCPayrollSheet)
  if (!payrollSheet) return []

  const references = readSampleCPayrollReferenceRows(payrollSheet, payrollPeriod)
  if (references.length === 0) return []

  const warnings: string[] = []
  for (const reference of references) {
    const target = findRowByEmployeeCode(rows, reference.employeeCode)
    if (!target?.baseSalary) continue

    if (!amountsMatch(target.baseSalary, reference.baseSalary)) {
      target.payrollVerificationFailed = true
      const message = `Payroll 검증 불일치(User ID ${reference.employeeCode}): 구조 추출 기본급 ${target.baseSalary.toLocaleString('ko-KR')}원 vs Payroll 참고 ${reference.baseSalary.toLocaleString('ko-KR')}원. 담당자 확인이 필요합니다.`
      addNote(target, message)
      warnings.push(message)
    }
  }

  if (warnings.length > 0) {
    const targetMonthLabel = formatSampleCTargetMonthLabel(payrollPeriod)
    warnings.unshift(`SampleC Payroll(${targetMonthLabel}) 검증 불일치 ${warnings.length}건 — 담당자 확인이 필요합니다.`)
  }

  return warnings
}

function mergeSampleCSheetsByName(sheets: ParsedSheet[]): ParsedSheet[] {
  const merged = new Map<string, ParsedSheet>()
  for (const sheet of sheets) {
    const key = `${sheet.filename}::${sheet.sheetName}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        filename: sheet.filename,
        sheetName: sheet.sheetName,
        rows: [...sheet.rows],
      })
      continue
    }
    existing.rows.push(...sheet.rows)
  }
  return [...merged.values()]
}

function collectSampleCMovementPolicyWarnings(
  sheet: ParsedSheet,
  payrollPeriod: string,
): string[] {
  if (!isSampleCMovementSheet(sheet)) return []

  const header = findSampleCHeaderRow(sheet, [
    SAMPLE_C_USER_ID_ALIASES,
    ['month'],
  ])
  if (!header) return []

  const monthIdx = columnIndexLoose(header, ['month'])
  const monthLabels = collectSampleCMonthLabels(sheet, monthIdx, header.rowNumber)
  const warning = buildSampleCNonTargetMonthPolicyWarning({
    sheetLabel: 'Movement',
    monthLabels,
    payrollPeriod,
  })
  return warning ? [warning] : []
}

function collectSampleCPayrollPolicyWarnings(
  sheet: ParsedSheet,
  payrollPeriod: string,
): string[] {
  if (!isSampleCPayrollSheet(sheet)) return []

  const subHeader = sheet.rows.find((row) => (
    columnIndexLoose(row, ['month']) >= 0 && columnIndexLoose(row, ['basesalary']) >= 0
  )) ?? null
  if (!subHeader) return []

  const monthIdx = columnIndexLoose(subHeader, ['month'])
  const monthLabels = collectSampleCMonthLabels(sheet, monthIdx, subHeader.rowNumber)
  const warnings: string[] = []
  const nonTargetWarning = buildSampleCNonTargetMonthPolicyWarning({
    sheetLabel: 'Payroll',
    monthLabels,
    payrollPeriod,
  })
  if (nonTargetWarning) warnings.push(nonTargetWarning)
  warnings.push(
    `SampleC Payroll 시트는 ${formatSampleCTargetMonthLabel(payrollPeriod)} 기본급 검증 참고용이며, OT/수당 금액은 구조 추출에 사용하지 않습니다.`,
  )
  return warnings
}

export function processSampleCStructuredSheets(
  sheets: ParsedSheet[],
  rows: Map<string, SampleCMutableEmployeeRow>,
  env: SampleCReaderEnv,
): { recognizedSheets: number; warnings: string[] } {
  const hasSampleC = sheets.some((sheet) => (
    isSampleCMasterSheet(sheet)
    || isSampleCMovementSheet(sheet)
    || isSampleCPayrollSheet(sheet)
    || isSampleCOvertimeMarSheet(sheet)
    || isSampleCOvertimeAprSheet(sheet)
    || isSampleCTempEmployeesSheet(sheet)
    || normalizeHeader(sheet.sheetName) === 'employeemasterdata'
  ))
  if (!hasSampleC) {
    return { recognizedSheets: 0, warnings: [] }
  }

  let recognizedSheets = 0
  const warnings: string[] = []

  for (const sheet of sheets) {
    if (readSampleCMasterSheet(sheet, env)) recognizedSheets += 1
    if (readSampleCOvertimeMarSheet(sheet, env)) recognizedSheets += 1
    if (readSampleCOvertimeAprSheet(sheet, env)) recognizedSheets += 1
    if (readSampleCMovementSheet(sheet, env)) recognizedSheets += 1
    if (readSampleCTempEmployeesSheet(sheet, env)) recognizedSheets += 1
    warnings.push(...readSampleCInputMemoSheet(sheet))
  }

  for (const sheet of mergeSampleCSheetsByName(sheets)) {
    warnings.push(...collectSampleCMovementPolicyWarnings(sheet, env.payrollPeriod))
    warnings.push(...collectSampleCPayrollPolicyWarnings(sheet, env.payrollPeriod))
  }

  warnings.push(...verifySampleCPayrollReferences(sheets, rows, env.payrollPeriod, env.addNote))

  return { recognizedSheets, warnings: [...new Set(warnings)] }
}

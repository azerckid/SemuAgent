import * as XLSX from 'xlsx'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'
import { requireBlobEnv } from '@/lib/env'
import {
  defaultPayrollExcelMapping,
  type MappingJson,
  mappingJsonSchema,
} from '@/lib/validations/payroll'

// MVP A안: 배포 번들에 포함되는 public 하위 템플릿을 서버 로컬 경로에서 직접 로드
export const DEFAULT_TEMPLATE_RELATIVE_PATH = 'public/payroll/templates/업로드용_엑셀파일.xlsx'
const LEGACY_TEMPLATE_RELATIVE_PATH = 'docs/payroll/Output/업로드용_엑셀파일.xlsx'
const DEFAULT_TEMPLATE_FILE_PATH = fileURLToPath(
  new URL('../../public/payroll/templates/업로드용_엑셀파일.xlsx', import.meta.url),
)
const DEFAULT_TEMPLATE_SHEET_NAME = 'Sheet1'
const TEMPLATE_FIRST_COLUMN_INDEX = 0
const TEMPLATE_LAST_COLUMN_INDEX = 20

function getDefaultTemplatePath(): string {
  return DEFAULT_TEMPLATE_FILE_PATH
}

/**
 * 템플릿 storage_key를 서버 파일 시스템 경로로 변환한다.
 * - 현재 정의된 기본 템플릿 storage_key만 허용
 * - 기존 배포/테스트 레코드의 docs/payroll/Output 경로는 같은 기본 템플릿으로 호환 처리
 * - 'http(s)://...' 같은 Blob URL은 향후 확장 시 별도 처리 (MVP 미지원)
 */
function resolveTemplatePath(storageKey: string): string {
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    throw new Error('Blob URL 형식의 템플릿은 아직 지원하지 않습니다')
  }
  const normalized = storageKey.replace(/\\/g, '/')
  if (normalized !== DEFAULT_TEMPLATE_RELATIVE_PATH && normalized !== LEGACY_TEMPLATE_RELATIVE_PATH) {
    throw new Error('MVP에서는 기본 급여 템플릿 storage_key만 지원합니다')
  }
  return getDefaultTemplatePath()
}

// 기본 템플릿 mapping_json (업로드용_엑셀파일.xlsx A-U 컬럼 고정 매핑)
export const DEFAULT_MAPPING_JSON = JSON.stringify(defaultPayrollExcelMapping)

type RowData = {
  payrollPeriod: string | null
  paymentDate: string | null
  employeeCode: string | null
  employeeName: string | null
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalary: number | null
  bonus: number | null
  mealAllowance: number | null
  transportationAllowance: number | null
  holidayWorkAllowance: number | null
  domesticTravelAllowance: number | null
  annualLeaveAllowance: number | null
  rndAllowance: number | null
  otherAllowance: number | null
  performanceIncentive: number | null
  nightWorkAllowance: number | null
  vehicleMaintenanceAllowance: number | null
  retroactivePay: number | null
  overtimeAllowance: number | null
  childcareAllowance: number | null
  nationalPension?: number | null
  healthInsurance?: number | null
  longTermCare?: number | null
  employmentInsurance?: number | null
  incomeTax?: number | null
  localIncomeTax?: number | null
  otherDeduction?: number | null
  deductionAmount: number | null
  memo: string | null
}

const TEMPLATE_EXPORT_FIELDS = [
  'employee_code',
  'employee_name',
  'department',
  'job_title',
  'job_type',
  'base_salary',
  'bonus',
  'meal_allowance',
  'transportation_allowance',
  'holiday_work_allowance',
  'domestic_travel_allowance',
  'annual_leave_allowance',
  'rnd_allowance',
  'other_allowance',
  'performance_incentive',
  'night_work_allowance',
  'vehicle_maintenance_allowance',
  'retroactive_pay',
  'overtime_allowance',
  'childcare_allowance',
  'gross_pay',
] as const

const TEMPLATE_EXPORT_HEADERS: Record<(typeof TEMPLATE_EXPORT_FIELDS)[number], string> = {
  employee_code:                 '사원코드',
  employee_name:                 '사원명',
  department:                    '부서',
  job_title:                     '직급',
  job_type:                      '직종',
  base_salary:                   '기본급',
  bonus:                         '상여',
  meal_allowance:                '식대(퇴)',
  transportation_allowance:      '교통비(퇴불)',
  holiday_work_allowance:        '휴일근무(퇴)',
  domestic_travel_allowance:     '국내출장(퇴불)',
  annual_leave_allowance:        '연차수당(퇴)',
  rnd_allowance:                 '연구개발비(퇴)',
  other_allowance:               '기타수당(퇴)',
  performance_incentive:         '일반성과인센티브(퇴불/3월,9월)',
  night_work_allowance:          '심야근무',
  vehicle_maintenance_allowance: '차량유지비',
  retroactive_pay:               '급여인상분 소급적용(퇴)',
  overtime_allowance:            '연장근무',
  childcare_allowance:           '보육수당',
  gross_pay:                     '지급액계',
}

const MONEY_FIELDS = new Set<string>([
  'base_salary',
  'bonus',
  'meal_allowance',
  'transportation_allowance',
  'holiday_work_allowance',
  'domestic_travel_allowance',
  'annual_leave_allowance',
  'rnd_allowance',
  'other_allowance',
  'performance_incentive',
  'night_work_allowance',
  'vehicle_maintenance_allowance',
  'retroactive_pay',
  'overtime_allowance',
  'childcare_allowance',
  'gross_pay',
])

const FIELD_TO_ROW_KEY: Partial<Record<string, keyof RowData>> = {
  payroll_period:           'payrollPeriod',
  payment_date:             'paymentDate',
  employee_code:             'employeeCode',
  employee_name:             'employeeName',
  department:                'department',
  job_title:                 'jobTitle',
  job_type:                  'jobType',
  base_salary:               'baseSalary',
  bonus:                     'bonus',
  meal_allowance:            'mealAllowance',
  transportation_allowance:  'transportationAllowance',
  holiday_work_allowance:    'holidayWorkAllowance',
  domestic_travel_allowance: 'domesticTravelAllowance',
  annual_leave_allowance:    'annualLeaveAllowance',
  rnd_allowance:             'rndAllowance',
  other_allowance:           'otherAllowance',
  performance_incentive:     'performanceIncentive',
  night_work_allowance:      'nightWorkAllowance',
  vehicle_maintenance_allowance: 'vehicleMaintenanceAllowance',
  retroactive_pay:           'retroactivePay',
  overtime_allowance:        'overtimeAllowance',
  childcare_allowance:       'childcareAllowance',
  national_pension:          'nationalPension',
  health_insurance:          'healthInsurance',
  long_term_care:            'longTermCare',
  employment_insurance:      'employmentInsurance',
  income_tax:                'incomeTax',
  local_income_tax:          'localIncomeTax',
  other_deduction:           'otherDeduction',
  deduction_amount:          'deductionAmount',
  memo:                      'memo',
}

const EARNING_KEYS: Array<keyof RowData> = [
  'baseSalary',
  'bonus',
  'mealAllowance',
  'transportationAllowance',
  'holidayWorkAllowance',
  'domesticTravelAllowance',
  'annualLeaveAllowance',
  'rndAllowance',
  'otherAllowance',
  'performanceIncentive',
  'nightWorkAllowance',
  'vehicleMaintenanceAllowance',
  'retroactivePay',
  'overtimeAllowance',
  'childcareAllowance',
]

const LEGACY_MAPPING_FIELDS = [
  'employee_code',
  'employee_name',
  'department',
  'job_title',
  'job_type',
  'base_salary',
  'bonus',
  'meal_allowance',
  'transportation_allowance',
  'holiday_work_allowance',
  'domestic_travel_allowance',
  'annual_leave_allowance',
  'rnd_allowance',
  'other_allowance',
  'performance_incentive',
  'night_work_allowance',
] as const

const PREVIOUS_CANDIDATE_MAPPING_FIELDS = [
  'payroll_period',
  'payment_date',
  'employee_code',
  'employee_name',
  'department',
  'job_title',
  'job_type',
  'base_salary',
  'bonus',
  'meal_allowance',
  'transportation_allowance',
  'holiday_work_allowance',
  'domestic_travel_allowance',
  'annual_leave_allowance',
  'rnd_allowance',
  'other_allowance',
  'performance_incentive',
  'night_work_allowance',
  'gross_pay',
  'national_pension',
  'health_insurance',
  'long_term_care',
  'employment_insurance',
  'income_tax',
  'local_income_tax',
  'other_deduction',
  'deduction_amount',
  'net_pay',
  'data_status',
  'memo',
] as const

function isLegacyDefaultMapping(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== LEGACY_MAPPING_FIELDS.length) return false
  return value.every((item, index) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as { field?: unknown; columnIndex?: unknown }
    return candidate.field === LEGACY_MAPPING_FIELDS[index] && candidate.columnIndex === index
  })
}

function isPreviousCandidateDefaultMapping(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== PREVIOUS_CANDIDATE_MAPPING_FIELDS.length) return false
  return value.every((item, index) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as { field?: unknown; columnIndex?: unknown }
    return candidate.field === PREVIOUS_CANDIDATE_MAPPING_FIELDS[index] && candidate.columnIndex === index
  })
}

function parseCandidateMapping(mappingJsonStr: string): { success: true; data: MappingJson } | { success: false; error: string } {
  let rawMapping: unknown
  try {
    rawMapping = JSON.parse(mappingJsonStr)
  } catch {
    return { success: false, error: '매핑 JSON 형식 오류' }
  }

  const mappingParsed = mappingJsonSchema.safeParse(rawMapping)
  if (mappingParsed.success) {
    return { success: true, data: mappingParsed.data }
  }

  if (isLegacyDefaultMapping(rawMapping) || isPreviousCandidateDefaultMapping(rawMapping)) {
    return { success: true, data: defaultPayrollExcelMapping }
  }

  return { success: false, error: `매핑 JSON 파싱 실패: ${mappingParsed.error.message}` }
}

function sumNumericValues(row: RowData, keys: Array<keyof RowData>): number {
  const values = keys
    .map((key) => row[key])
    .filter((value): value is number => typeof value === 'number')
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0)
}

function getTemplateLedgerValue(field: string, row: RowData): string | number {
  if (field === 'gross_pay') return sumNumericValues(row, EARNING_KEYS)
  const key = FIELD_TO_ROW_KEY[field]
  if (!key) return 0
  const value = row[key]
  if (MONEY_FIELDS.has(field)) {
    return typeof value === 'number' ? value : 0
  }
  return value ?? ''
}

function cloneCellStyle(cell: XLSX.CellObject | undefined): Pick<XLSX.CellObject, 's' | 'z'> {
  return {
    ...(cell?.s ? { s: cell.s } : {}),
    ...(cell?.z ? { z: cell.z } : {}),
  }
}

function clearTemplateDataRows(ws: XLSX.WorkSheet, dataStartRowIndex: number): void {
  for (const address of Object.keys(ws)) {
    if (address.startsWith('!')) continue
    const cell = XLSX.utils.decode_cell(address)
    if (cell.r >= dataStartRowIndex) {
      delete ws[address]
    }
  }
}

function validateTemplateHeaders(ws: XLSX.WorkSheet): string[] {
  const mismatches: string[] = []
  TEMPLATE_EXPORT_FIELDS.forEach((field, columnIndex) => {
    const headerRowIndex = columnIndex <= 4 ? 0 : 1
    const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex })
    const actual = String(ws[address]?.v ?? '').trim()
    const expected = TEMPLATE_EXPORT_HEADERS[field]
    if (actual !== expected) {
      mismatches.push(`${address}: expected ${expected}, got ${actual || '(blank)'}`)
    }
  })
  return mismatches
}

function writeTemplatePayrollRows(ws: XLSX.WorkSheet, rows: RowData[], dataStartRow: number): void {
  const dataStartRowIndex = Math.max(0, dataStartRow - 1)
  const styleSourceRowIndex = dataStartRowIndex
  const templateCellStyles = TEMPLATE_EXPORT_FIELDS.map((_, columnIndex) => (
    cloneCellStyle(ws[XLSX.utils.encode_cell({ r: styleSourceRowIndex, c: columnIndex })])
  ))

  clearTemplateDataRows(ws, dataStartRowIndex)

  rows.forEach((row, rowIndex) => {
    const excelRowIndex = dataStartRowIndex + rowIndex
    TEMPLATE_EXPORT_FIELDS.forEach((field, columnIndex) => {
      const value = getTemplateLedgerValue(field, row)
      const address = XLSX.utils.encode_cell({ r: excelRowIndex, c: columnIndex })
      const cell: XLSX.CellObject = {
        v: value,
        t: typeof value === 'number' ? 'n' : 's',
        ...templateCellStyles[columnIndex],
      }
      if (MONEY_FIELDS.has(field)) {
        cell.z = '#,##0'
      }
      ws[address] = cell
    })
  })

  const lastRowIndex = rows.length > 0 ? dataStartRowIndex + rows.length - 1 : Math.max(0, dataStartRowIndex - 1)
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: TEMPLATE_FIRST_COLUMN_INDEX },
    e: { r: lastRowIndex, c: TEMPLATE_LAST_COLUMN_INDEX },
  })
}

export type GenerateDraftResult =
  | { success: true; blobUrl: string; filename: string }
  | { success: false; error: string }

export async function generatePayrollExcelDraft(
  rows: RowData[],
  mappingJsonStr: string,
  dataStartRow: number,
  sheetName: string,
  payrollPeriod: string,
  sessionId: string,
  templateStorageKey: string,
  draftId: string,
): Promise<GenerateDraftResult> {
  let templateBuffer: Buffer
  // 1. 템플릿 storage_key를 검증하고 실제 workbook을 읽는다.
  try {
    const resolvedPath = resolveTemplatePath(templateStorageKey)
    templateBuffer = fs.readFileSync(resolvedPath)
  } catch (err) {
    return {
      success: false,
      error: `급여 엑셀 템플릿을 찾을 수 없습니다 (${templateStorageKey}): ${(err as Error).message}`,
    }
  }

  // 2. 매핑 파싱 (Zod)
  const mappingParsed = parseCandidateMapping(mappingJsonStr)
  if (!mappingParsed.success) {
    return { success: false, error: mappingParsed.error }
  }

  // 3. 지정된 업로드용 템플릿 형식을 유지하고, 샘플 데이터 행만 실제 payroll row로 교체한다.
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(templateBuffer, { type: 'buffer', cellStyles: true })
  } catch (err) {
    return {
      success: false,
      error: `급여 엑셀 템플릿을 읽을 수 없습니다 (${templateStorageKey}): ${(err as Error).message}`,
    }
  }

  const targetSheetName = wb.SheetNames.includes(sheetName) ? sheetName : DEFAULT_TEMPLATE_SHEET_NAME
  const ws = wb.Sheets[targetSheetName] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws) {
    return { success: false, error: '급여 엑셀 템플릿에 작성 가능한 시트가 없습니다' }
  }
  const headerMismatches = validateTemplateHeaders(ws)
  if (headerMismatches.length > 0) {
    return {
      success: false,
      error: `급여 엑셀 템플릿 헤더가 업로드용 양식과 다릅니다: ${headerMismatches.slice(0, 3).join('; ')}`,
    }
  }
  writeTemplatePayrollRows(ws, rows, dataStartRow)

  // 4. Buffer 직렬화
  const outputBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // 5. Vercel Blob 업로드
  const safeDraftId = draftId.replace(/[^\w-]/g, '').slice(0, 12) || 'draft'
  const filename = `douzone_upload_payroll_${sessionId}_${safeDraftId}_${payrollPeriod.replace(/-/g, '')}.xlsx`
  try {
    requireBlobEnv()
    const blob = await put(`payroll-drafts/${filename}`, outputBuffer, {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    return { success: true, blobUrl: blob.url, filename }
  } catch (err) {
    return { success: false, error: `Blob 업로드 실패: ${(err as Error).message}` }
  }
}

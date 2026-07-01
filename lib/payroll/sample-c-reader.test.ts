import { describe, expect, it } from 'vitest'
import {
  processSampleCStructuredSheets,
  type SampleCMutableEmployeeRow,
  type SampleCReaderEnv,
} from './sample-c-reader'

function createEnv(payrollPeriod: string) {
  const rows = new Map<string, SampleCMutableEmployeeRow>()

  const createRow = (): SampleCMutableEmployeeRow => ({
    employeeCode: null,
    employeeName: null,
    department: null,
    jobTitle: null,
    jobType: null,
    baseSalary: null,
    bonus: null,
    mealAllowance: null,
    fixedOvertimeAllowance: 0,
    vehicleMaintenanceAllowance: null,
    retroactivePay: null,
    childcareAllowance: null,
    rndAllowance: null,
    otherAllowance: null,
    welfareAllowance: null,
    domesticTravelAllowance: null,
    annualLeaveAllowanceAmount: null,
    ordinaryMonthlyWage: null,
    overtimeHours: 0,
    payrollVerificationFailed: false,
    notes: [],
    sources: [],
  })

  const env: SampleCReaderEnv = {
    payrollPeriod,
    getOrCreateEmployee: ({ employeeCode, employeeName }) => {
      const key = employeeCode
        ? `code:${employeeCode.replace(/\s+/g, '').trim().toLowerCase()}`
        : `name:${employeeName?.replace(/\s+/g, '').trim().toLowerCase() ?? rows.size}`
      const existing = rows.get(key)
      if (existing) return existing
      const row = createRow()
      row.employeeCode = employeeCode
      row.employeeName = employeeName
      rows.set(key, row)
      return row
    },
    addNote: (row, note) => {
      if (!row.notes.includes(note)) row.notes.push(note)
    },
    addSource: (row, source) => {
      row.sources.push(source)
    },
  }

  return { rows, env }
}

describe('processSampleCStructuredSheets', () => {
  it('converts SampleC memo sections into internal policy review warnings', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'input.xlsx',
        sheetName: 'Employee Master Data',
        rows: [
          { rowNumber: 14, cells: ['B. Long-term Business Trip Allowance: 50% of monthly Base Salary incl. (Fixed OT allowance, Car allowance, Childcare Allowance)'] },
          { rowNumber: 15, cells: ['', 'i. Kim : Travel to US (Apr 1, 2026 - July 10, 2026)'] },
          { rowNumber: 29, cells: ['A. Reflecting Year-End Tax Settlement Results'] },
          { rowNumber: 30, cells: ['     Kim (김OO), An (안OO), and Shin (신OO) — Payable in Three Monthly Installments'] },
        ],
      },
    ], rows, env)

    expect(result.recognizedSheets).toBe(0)
    expect(result.warnings).toEqual([
      expect.stringContaining('사내 규정 감지: 장기 출장수당'),
      expect.stringContaining('사내 규정 감지: 연말정산 분할납부'),
    ])
    expect(result.warnings.join('\n')).toContain('세액 정산/공제')
    expect(result.warnings.join('\n')).not.toContain('domesticTravelAllowance')
    expect(result.warnings.join('\n')).not.toContain('retroactive/other')
  })

  it('keeps company and department metadata as review context instead of payroll rows', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'input.xlsx',
        sheetName: 'Employee Master Data',
        rows: [
          { rowNumber: 1, cells: ['Company: SampleC Korea'] },
          { rowNumber: 2, cells: ['Department Mapping: Sales / R&D / Executive'] },
          { rowNumber: 3, cells: ['Prepared by HR Team'] },
        ],
      },
    ], rows, env)

    expect(result.recognizedSheets).toBe(0)
    expect(rows.size).toBe(0)
    expect(result.warnings).toEqual([
      expect.stringContaining('메타정보 감지: 회사/조직 메타정보'),
    ])
    expect(result.warnings.join('\n')).toContain('참고 메모로 보존')
  })

  it('does not surface regular employee table headers as metadata warnings', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'input.xlsx',
        sheetName: 'Employee Master Data',
        rows: [
          { rowNumber: 1, cells: ['User ID', 'Name (Kor)', 'Department', 'Job Title/Rank', 'Annual Base Salary', 'Monthly Salary'] },
        ],
      },
    ], rows, env)

    expect(result.recognizedSheets).toBe(0)
    expect(result.warnings).toEqual([])
  })

  it('reads Master and Movement rows by User ID without employee name', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'output.xlsx',
        sheetName: 'Master',
        rows: [
          { rowNumber: 3, cells: ['User ID', 'Name (Kor)', 'Name (Eng)', 'Join Date', 'Last Date', 'Department', 'Job Title/Rank', '급여구분', 'Annual Base Salary', 'Hourly Rate', '', 'Base salary', 'Monthly Salary', 'OT Allowance (monthly)', 'Car Allowance (Non-Tax)', 'R&D Allowance (Non-Tax)', 'Other Allowance', 'Other Allowance', 'Other Allowance', 'Other Allowance', 'Welfare Allowance', 'Child Tuition Allowance (Non-Tax)'] },
          { rowNumber: 4, cells: ['9', '', '', '1-Aug-12', '', '임원', '대표이사', '직원급여(802)', '', '', '', '16,961,140', '16,961,140', '0', '0', '0', '0', '0', '0', '0', '100,000', '0'] },
          { rowNumber: 5, cells: ['3', '', '', '1-Jul-10', '', '기술영업부', '차장', '직원급여(802)', '', '', '', '4,453,678', '5,321,670', '667,992', '200,000', '0', '0', '0', '0', '0', '100,000', '0'] },
        ],
      },
      {
        filename: 'output.xlsx',
        sheetName: 'Movement',
        rows: [
          { rowNumber: 2, cells: ['', 'User ID', 'Name', 'Name(English)', 'Join Date', 'Last date', 'month', '근무시간', '', '시간외근로', '', '', '', '무급 휴가', '연차 수당', 'Monthly Salary', 'OT Allowance (monthly)', 'Car Allowance (Non-Tax)', 'R&D Allowance (Non-Tax)', 'Other Allowance', 'Welfare Allowance', 'Child Tuition Allowance  (Non-Tax)', 'OT Allowance (Additional)', 'Other Allowance', 'Annual Leave Allowance', 'Bonus', 'unpaid leave', 'Retroactive Salary'] },
          { rowNumber: 3, cells: ['', '9', '', '', '1-Aug-12', '', 'May-26', '9:00 ... 18:00', '', '-', '', '', '', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] },
          { rowNumber: 4, cells: ['', '3', '', '', '1-Jul-10', '', 'May-26', '9:00 ... 18:00', '', '-', '', '', '', '-', '-', '-', '-', '-', '-', '-', '-', '-', '120,000', '-', '-', '-', '-', '-'] },
        ],
      },
    ], rows, env)

    expect(result.recognizedSheets).toBeGreaterThan(0)
    const employee9 = rows.get('code:9')
    const employee3 = rows.get('code:3')
    expect(employee9?.employeeCode).toBe('9')
    expect(employee9?.employeeName).toBeNull()
    expect(employee9?.baseSalary).toBe(16961140)
    expect(employee9?.welfareAllowance).toBe(100000)
    expect(employee3?.fixedOvertimeAllowance).toBe(667992 + 120000)
  })

  it('flags payroll verification mismatches for staff notification', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'output.xlsx',
        sheetName: 'Master',
        rows: [
          { rowNumber: 3, cells: ['User ID', 'Name (Kor)', 'Name (Eng)', 'Join Date', 'Last Date', 'Department', 'Job Title/Rank', '급여구분', 'Annual Base Salary', 'Hourly Rate', '', 'Base salary', 'Monthly Salary'] },
          { rowNumber: 4, cells: ['9', '', '', '1-Aug-12', '', '임원', '대표이사', '직원급여(802)', '', '', '', '16,000,000', '16,000,000'] },
        ],
      },
      {
        filename: 'output.xlsx',
        sheetName: 'Payroll',
        rows: [
          { rowNumber: 4, cells: ['', 'Information', '', '', '', 'Payment', 'Base Salary'] },
          { rowNumber: 5, cells: ['', 'EE', 'Name', 'Name', '급여구분', 'Month', 'Base Salary'] },
          { rowNumber: 6, cells: ['', '9', '', '', '직원급여(802)', 'May-26', '16,961,140'] },
        ],
      },
    ], rows, env)

    expect(result.warnings.some((warning) => warning.includes('Payroll 검증 불일치'))).toBe(true)
    expect(rows.get('code:9')?.payrollVerificationFailed).toBe(true)
  })

  it('reads Overtime (Mar) and Overtime (Apr) for the requested payroll period', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'input.xlsx',
        sheetName: 'Overtime (Mar)',
        rows: [
          { rowNumber: 5, cells: ['Code', 'Name_KR', 'Name_EN', 'Sun', 'Mon', 'Total', 'OT', 'OT (Night)', 'Holiday Work', 'Holiday OT'] },
          { rowNumber: 6, cells: ['38', '', '', '', '', '2', '2', '', '', ''] },
        ],
      },
      {
        filename: 'input.xlsx',
        sheetName: 'Overtime (Apr)',
        rows: [
          { rowNumber: 5, cells: ['Code', 'Name_KR', 'Name_EN', 'Wed', 'Thu', 'Total', 'OT', 'OT (Night)', 'Holiday Work', 'Holiday OT'] },
          { rowNumber: 6, cells: ['38', '', '', '3', '3', '9', '9', '', '', ''] },
        ],
      },
    ], rows, env)

    expect(result.recognizedSheets).toBe(2)
    expect(rows.get('code:38')?.overtimeHours).toBe(11)
    expect(rows.get('code:38')?.notes.some((note) => note.includes('Overtime (Mar)'))).toBe(true)
    expect(rows.get('code:38')?.notes.some((note) => note.includes('Overtime (Apr)'))).toBe(true)
  })

  it('uses Movement overtime hours only when Input OT sheets did not provide hours', () => {
    const { rows, env } = createEnv('2026-05')
    processSampleCStructuredSheets([
      {
        filename: 'output.xlsx',
        sheetName: 'Movement',
        rows: [
          { rowNumber: 2, cells: ['', 'User ID', 'Name', 'Name(English)', 'Join Date', 'Last date', 'month', '근무시간', '', '시간외근로', '', '', '', '무급 휴가', '연차 수당', 'Monthly Salary', 'OT Allowance (monthly)', 'Car Allowance (Non-Tax)', 'R&D Allowance (Non-Tax)', 'Other Allowance', 'Welfare Allowance', 'Child Tuition Allowance  (Non-Tax)', 'OT Allowance (Additional)', 'Other Allowance', 'Annual Leave Allowance', 'Bonus', 'unpaid leave', 'Retroactive Salary'] },
          { rowNumber: 3, cells: ['', '', '', '', '', '', '', '', '', '연장 x 1.5', '야간 x 0.5', '휴일 x 1.5', '휴일(연) x 0.5'] },
          { rowNumber: 4, cells: ['', '70', '', '', '1-Aug-12', '', 'May-26', '', '', '5', '', '', ''] },
        ],
      },
    ], rows, env)

    expect(rows.get('code:70')?.overtimeHours).toBe(5)
  })

  it('skips Movement overtime hours when Input OT sheets already provided hours', () => {
    const { rows, env } = createEnv('2026-05')
    processSampleCStructuredSheets([
      {
        filename: 'input.xlsx',
        sheetName: 'Overtime (Apr)',
        rows: [
          { rowNumber: 5, cells: ['Code', 'Name_KR', 'Name_EN', 'Wed', 'Thu', 'Total', 'OT', 'OT (Night)', 'Holiday Work', 'Holiday OT'] },
          { rowNumber: 6, cells: ['70', '', '', '', '', '5', '5', '', '', ''] },
        ],
      },
      {
        filename: 'output.xlsx',
        sheetName: 'Movement',
        rows: [
          { rowNumber: 2, cells: ['', 'User ID', 'Name', 'Name(English)', 'Join Date', 'Last date', 'month', '근무시간', '', '시간외근로', '', '', '', '무급 휴가', '연차 수당', 'Monthly Salary', 'OT Allowance (monthly)', 'Car Allowance (Non-Tax)', 'R&D Allowance (Non-Tax)', 'Other Allowance', 'Welfare Allowance', 'Child Tuition Allowance  (Non-Tax)', 'OT Allowance (Additional)', 'Other Allowance', 'Annual Leave Allowance', 'Bonus', 'unpaid leave', 'Retroactive Salary'] },
          { rowNumber: 3, cells: ['', '', '', '', '', '', '', '', '', '연장 x 1.5', '야간 x 0.5', '휴일 x 1.5', '휴일(연) x 0.5'] },
          { rowNumber: 4, cells: ['', '70', '', '', '1-Aug-12', '', 'May-26', '', '', '5', '', '', ''] },
        ],
      },
    ], rows, env)

    expect(rows.get('code:70')?.overtimeHours).toBe(5)
    expect(rows.get('code:70')?.sources.some((source) => source.kind === 'sample-c-movement-overtime-hours')).toBe(false)
  })

  it('adds policy warnings for non-target months in Movement and Payroll sheets', () => {
    const { rows, env } = createEnv('2026-05')
    const result = processSampleCStructuredSheets([
      {
        filename: 'output.xlsx',
        sheetName: 'Movement',
        rows: [
          { rowNumber: 2, cells: ['', 'User ID', 'Name', 'Name(English)', 'Join Date', 'Last date', 'month'] },
          { rowNumber: 3, cells: ['', '9', '', '', '1-Aug-12', '', 'Apr-26'] },
          { rowNumber: 4, cells: ['', '3', '', '', '1-Jul-10', '', 'May-26'] },
        ],
      },
      {
        filename: 'output.xlsx',
        sheetName: 'Payroll',
        rows: [
          { rowNumber: 5, cells: ['', 'EE', 'Name', 'Name', '급여구분', 'Month', 'Base Salary'] },
          { rowNumber: 6, cells: ['', '9', '', '', '직원급여(802)', 'Apr-26', '16,000,000'] },
          { rowNumber: 7, cells: ['', '3', '', '', '직원급여(802)', 'May-26', '5,000,000'] },
        ],
      },
    ], rows, env)

    expect(result.warnings.some((warning) => warning.includes('Movement 시트에 Apr-26'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('Payroll 시트에 Apr-26'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('검증 참고용'))).toBe(true)
  })
})

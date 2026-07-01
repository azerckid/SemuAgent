import * as XLSX from 'xlsx'
import { tmpdir } from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const blobMock = vi.hoisted(() => ({
  put: vi.fn(),
  lastBuffer: null as Buffer | null,
}))

vi.mock('@vercel/blob', () => ({
  put: blobMock.put,
}))

describe('generatePayrollExcelDraft', () => {
  beforeEach(() => {
    process.env.TURSO_DATABASE_URL = 'libsql://test.local'
    process.env.TURSO_AUTH_TOKEN = 'test-token'
    process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token'
    blobMock.lastBuffer = null
    blobMock.put.mockReset()
    blobMock.put.mockImplementation(async (_key: string, body: Buffer) => {
      blobMock.lastBuffer = body
      return { url: 'https://blob.example/payroll-draft.xlsx' }
    })
  })

  it('writes payroll rows into the uploaded payroll Excel template format', async () => {
    const {
      DEFAULT_MAPPING_JSON,
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    const result = await generatePayrollExcelDraft(
      [{
        payrollPeriod: '2026-06',
        paymentDate: null,
        employeeCode: 'E-001',
        employeeName: '홍길동',
        department: '세무1팀',
        jobTitle: '대리',
        jobType: '정규직',
        baseSalary: 3000000,
        bonus: 100000,
        mealAllowance: 200000,
        transportationAllowance: 50000,
        holidayWorkAllowance: 0,
        domesticTravelAllowance: 0,
        annualLeaveAllowance: 0,
        rndAllowance: 0,
        otherAllowance: 30000,
        performanceIncentive: 0,
        nightWorkAllowance: 10000,
        vehicleMaintenanceAllowance: 150000,
        retroactivePay: 80000,
        overtimeAllowance: 120000,
        childcareAllowance: 70000,
        nationalPension: 135000,
        healthInsurance: 106350,
        longTermCare: 13772,
        employmentInsurance: 27000,
        incomeTax: 25000,
        localIncomeTax: 2500,
        otherDeduction: null,
        deductionAmount: 310000,
        memo: '세금/공제 기준자료 일부 반영',
      }],
      DEFAULT_MAPPING_JSON,
      3,
      'Sheet1',
      '2026-06',
      'session-1',
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      'draft-1',
    )

    expect(result.success).toBe(true)
    expect(blobMock.lastBuffer).toBeInstanceOf(Buffer)

    const workbook = XLSX.read(blobMock.lastBuffer, { type: 'buffer' })
    expect(workbook.SheetNames).toEqual(['Sheet1'])
    const worksheet = workbook.Sheets['Sheet1']

    expect(worksheet.A1?.v).toBe('사원코드')
    expect(worksheet.B1?.v).toBe('사원명')
    expect(worksheet.F1?.v).toBe('수당')
    expect(worksheet.F2?.v).toBe('기본급')
    expect(worksheet.U2?.v).toBe('지급액계')
    expect(worksheet['!merges']).toHaveLength(6)
    expect(worksheet.A3?.v).toBe('E-001')
    expect(worksheet.B3?.v).toBe('홍길동')
    expect(worksheet.C3?.v).toBe('세무1팀')
    expect(worksheet.D3?.v).toBe('대리')
    expect(worksheet.E3?.v).toBe('정규직')
    expect(worksheet.F3?.v).toBe(3000000)
    expect(worksheet.G3?.v).toBe(100000)
    expect(worksheet.H3?.v).toBe(200000)
    expect(worksheet.I3?.v).toBe(50000)
    expect(worksheet.N3?.v).toBe(30000)
    expect(worksheet.P3?.v).toBe(10000)
    expect(worksheet.Q3?.v).toBe(150000)
    expect(worksheet.R3?.v).toBe(80000)
    expect(worksheet.S3?.v).toBe(120000)
    expect(worksheet.T3?.v).toBe(70000)
    expect(worksheet.U3?.v).toBe(3810000)
    expect(worksheet.A4?.v).toBeUndefined()
    expect(worksheet.A5?.v).toBeUndefined()
    expect(worksheet['!ref']).toBe('A1:U3')
    expect(blobMock.put).toHaveBeenCalledWith(
      'payroll-drafts/douzone_upload_payroll_session-1_draft-1_202606.xlsx',
      expect.any(Buffer),
      expect.objectContaining({ access: 'private', allowOverwrite: true }),
    )
    expect(result.success ? result.filename : '').toContain('douzone_upload_payroll')
  })

  it('loads the payroll upload template from the bundled file path, not the process working directory', async () => {
    const originalCwd = process.cwd()
    const {
      DEFAULT_MAPPING_JSON,
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    try {
      process.chdir(tmpdir())
      const result = await generatePayrollExcelDraft(
        [{
          payrollPeriod: '2026-06',
          paymentDate: null,
          employeeCode: 'E-CWD',
          employeeName: '경로검증',
          department: null,
          jobTitle: null,
          jobType: null,
          baseSalary: 1000000,
          bonus: null,
          mealAllowance: null,
          transportationAllowance: null,
          holidayWorkAllowance: null,
          domesticTravelAllowance: null,
          annualLeaveAllowance: null,
          rndAllowance: null,
          otherAllowance: null,
          performanceIncentive: null,
          nightWorkAllowance: null,
          vehicleMaintenanceAllowance: null,
          retroactivePay: null,
          overtimeAllowance: null,
          childcareAllowance: null,
          deductionAmount: null,
          memo: null,
        }],
        DEFAULT_MAPPING_JSON,
        3,
        'Sheet1',
        '2026-06',
        'session-cwd',
        DEFAULT_TEMPLATE_RELATIVE_PATH,
        'draft-cwd',
      )

      expect(result.success).toBe(true)
      const workbook = XLSX.read(blobMock.lastBuffer, { type: 'buffer' })
      const worksheet = workbook.Sheets['Sheet1']
      expect(worksheet.A3?.v).toBe('E-CWD')
      expect(worksheet.U3?.v).toBe(1000000)
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('upgrades legacy default A-P mappings to the upload template mapping', async () => {
    const {
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    const legacyMapping = JSON.stringify([
      { field: 'employee_code', column: 'A', columnIndex: 0 },
      { field: 'employee_name', column: 'B', columnIndex: 1 },
      { field: 'department', column: 'C', columnIndex: 2 },
      { field: 'job_title', column: 'D', columnIndex: 3 },
      { field: 'job_type', column: 'E', columnIndex: 4 },
      { field: 'base_salary', column: 'F', columnIndex: 5 },
      { field: 'bonus', column: 'G', columnIndex: 6 },
      { field: 'meal_allowance', column: 'H', columnIndex: 7 },
      { field: 'transportation_allowance', column: 'I', columnIndex: 8 },
      { field: 'holiday_work_allowance', column: 'J', columnIndex: 9 },
      { field: 'domestic_travel_allowance', column: 'K', columnIndex: 10 },
      { field: 'annual_leave_allowance', column: 'L', columnIndex: 11 },
      { field: 'rnd_allowance', column: 'M', columnIndex: 12 },
      { field: 'other_allowance', column: 'N', columnIndex: 13 },
      { field: 'performance_incentive', column: 'O', columnIndex: 14 },
      { field: 'night_work_allowance', column: 'P', columnIndex: 15 },
    ])

    const result = await generatePayrollExcelDraft(
      [{
        payrollPeriod: '2026-06',
        paymentDate: null,
        employeeCode: 'E-003',
        employeeName: '박레거시',
        department: null,
        jobTitle: null,
        jobType: null,
        baseSalary: 2000000,
        bonus: null,
        mealAllowance: null,
        transportationAllowance: null,
        holidayWorkAllowance: null,
        domesticTravelAllowance: null,
        annualLeaveAllowance: null,
        rndAllowance: null,
        otherAllowance: null,
        performanceIncentive: null,
        nightWorkAllowance: null,
        vehicleMaintenanceAllowance: null,
        retroactivePay: null,
        overtimeAllowance: null,
        childcareAllowance: null,
        deductionAmount: null,
        memo: null,
      }],
      legacyMapping,
      3,
      'Sheet1',
      '2026-06',
      'session-legacy',
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      'draft-legacy',
    )

    expect(result.success).toBe(true)
    const workbook = XLSX.read(blobMock.lastBuffer, { type: 'buffer' })
    expect(workbook.SheetNames[0]).toBe('Sheet1')
    const worksheet = workbook.Sheets['Sheet1']

    expect(worksheet.A1?.v).toBe('사원코드')
    expect(worksheet.U2?.v).toBe('지급액계')
    expect(worksheet.A3?.v).toBe('E-003')
    expect(worksheet.U3?.v).toBe(2000000)
  })

  it('upgrades previous A-AD mappings to the upload template mapping', async () => {
    const {
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    const previousFields = [
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
    ]
    const previousColumns = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
      'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
      'Y', 'Z', 'AA', 'AB', 'AC', 'AD',
    ]
    const previousMapping = JSON.stringify(previousFields.map((field, index) => ({
      field,
      column: previousColumns[index],
      columnIndex: index,
    })))

    const result = await generatePayrollExcelDraft(
      [{
        payrollPeriod: '2026-06',
        paymentDate: null,
        employeeCode: 'E-030',
        employeeName: '이전매핑',
        department: null,
        jobTitle: null,
        jobType: null,
        baseSalary: 2100000,
        bonus: null,
        mealAllowance: null,
        transportationAllowance: null,
        holidayWorkAllowance: null,
        domesticTravelAllowance: null,
        annualLeaveAllowance: null,
        rndAllowance: null,
        otherAllowance: null,
        performanceIncentive: null,
        nightWorkAllowance: null,
        vehicleMaintenanceAllowance: null,
        retroactivePay: null,
        overtimeAllowance: null,
        childcareAllowance: null,
        deductionAmount: null,
        memo: null,
      }],
      previousMapping,
      3,
      'Sheet1',
      '2026-06',
      'session-previous',
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      'draft-previous',
    )

    expect(result.success).toBe(true)
    const workbook = XLSX.read(blobMock.lastBuffer, { type: 'buffer' })
    const worksheet = workbook.Sheets['Sheet1']
    expect(worksheet.A3?.v).toBe('E-030')
    expect(worksheet.B3?.v).toBe('이전매핑')
    expect(worksheet.U3?.v).toBe(2100000)
  })

  it('exports payment totals without adding deduction columns to the upload template', async () => {
    const {
      DEFAULT_MAPPING_JSON,
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    const result = await generatePayrollExcelDraft(
      [{
        payrollPeriod: '2026-06',
        paymentDate: null,
        employeeCode: 'E-002',
        employeeName: '김자료',
        department: null,
        jobTitle: null,
        jobType: null,
        baseSalary: 2500000,
        bonus: null,
        mealAllowance: null,
        transportationAllowance: null,
        holidayWorkAllowance: null,
        domesticTravelAllowance: null,
        annualLeaveAllowance: null,
        rndAllowance: null,
        otherAllowance: null,
        performanceIncentive: null,
        nightWorkAllowance: null,
        vehicleMaintenanceAllowance: null,
        retroactivePay: null,
        overtimeAllowance: null,
        childcareAllowance: null,
        deductionAmount: null,
        memo: null,
      }],
      DEFAULT_MAPPING_JSON,
      3,
      'Sheet1',
      '2026-06',
      'session-2',
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      'draft-2',
    )

    expect(result.success).toBe(true)
    const workbook = XLSX.read(blobMock.lastBuffer, { type: 'buffer' })
    const worksheet = workbook.Sheets['Sheet1']

    expect(worksheet.U3?.v).toBe(2500000)
    expect(worksheet.V3?.v).toBeUndefined()
  })

  it('rejects mappings that try to write a field to the wrong template column', async () => {
    const {
      DEFAULT_MAPPING_JSON,
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      generatePayrollExcelDraft,
    } = await import('./payroll-service')

    const invalidMapping = JSON.stringify([
      ...JSON.parse(DEFAULT_MAPPING_JSON).slice(1),
      { field: 'employee_code', column: 'U', columnIndex: 20 },
    ])

    const result = await generatePayrollExcelDraft(
      [],
      invalidMapping,
      3,
      'Sheet1',
      '2026-06',
      'session-1',
      DEFAULT_TEMPLATE_RELATIVE_PATH,
      'draft-invalid',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('매핑 JSON 파싱 실패')
    }
    expect(blobMock.put).not.toHaveBeenCalled()
  })
})

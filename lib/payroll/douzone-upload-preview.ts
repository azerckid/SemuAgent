import {
  payrollExcelMappingFields,
  payrollExcelTemplateAllowanceGroupLabel,
  payrollExcelTemplateColumnLabels,
} from '@/lib/validations/payroll'

const IDENTITY_FIELD_COUNT = 5

export const DOUZONE_UPLOAD_PREVIEW_IDENTITY_FIELDS = payrollExcelMappingFields
  .slice(0, IDENTITY_FIELD_COUNT)
  .map((field) => ({
    field,
    label: payrollExcelTemplateColumnLabels[field],
  }))

export const DOUZONE_UPLOAD_PREVIEW_EARNING_FIELDS = payrollExcelMappingFields
  .slice(IDENTITY_FIELD_COUNT)
  .map((field) => ({
    field,
    label: payrollExcelTemplateColumnLabels[field],
    computed: field === 'gross_pay',
  }))

export { payrollExcelTemplateAllowanceGroupLabel as DOUZONE_UPLOAD_PREVIEW_ALLOWANCE_GROUP_LABEL }

type PreviewRow = {
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
}

const PREVIEW_FIELD_TO_ROW_KEY: Record<
  (typeof payrollExcelMappingFields)[number],
  keyof PreviewRow | null
> = {
  employee_code: 'employeeCode',
  employee_name: 'employeeName',
  department: 'department',
  job_title: 'jobTitle',
  job_type: 'jobType',
  base_salary: 'baseSalary',
  bonus: 'bonus',
  meal_allowance: 'mealAllowance',
  transportation_allowance: 'transportationAllowance',
  holiday_work_allowance: 'holidayWorkAllowance',
  domestic_travel_allowance: 'domesticTravelAllowance',
  annual_leave_allowance: 'annualLeaveAllowance',
  rnd_allowance: 'rndAllowance',
  other_allowance: 'otherAllowance',
  performance_incentive: 'performanceIncentive',
  night_work_allowance: 'nightWorkAllowance',
  vehicle_maintenance_allowance: 'vehicleMaintenanceAllowance',
  retroactive_pay: 'retroactivePay',
  overtime_allowance: 'overtimeAllowance',
  childcare_allowance: 'childcareAllowance',
  gross_pay: null,
}

const GROSS_PAY_ROW_KEYS: Array<keyof PreviewRow> = [
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

export function getDouzoneUploadPreviewCellValue(
  row: PreviewRow,
  field: (typeof payrollExcelMappingFields)[number],
): string | number | null {
  if (field === 'gross_pay') {
    return GROSS_PAY_ROW_KEYS.reduce((sum, key) => {
      const value = row[key]
      return sum + (typeof value === 'number' ? value : 0)
    }, 0)
  }
  const rowKey = PREVIEW_FIELD_TO_ROW_KEY[field]
  return rowKey ? row[rowKey] : null
}

export function isDouzoneUploadPreviewNumericField(
  field: (typeof payrollExcelMappingFields)[number],
): boolean {
  return field !== 'employee_code'
    && field !== 'employee_name'
    && field !== 'department'
    && field !== 'job_title'
    && field !== 'job_type'
}

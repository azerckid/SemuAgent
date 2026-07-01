import type { PayrollAdaptiveSampleRow } from './adaptive-structuring-proposal-schema'

export const PAYROLL_ADAPTIVE_SAMPLE_ROW_MAX_COUNT = 5

const RESIDENT_NUMBER_PATTERN = /\b\d{6}[-\s]?\d{7}\b/g
const PHONE_NUMBER_PATTERN = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g
const LONG_DIGIT_PATTERN = /\b\d{10,}\b/g

const REDACTION_MASK = '[마스킹됨]'

// 주민번호/전화번호/계좌번호로 보이는 패턴을 가린다. AI가 프롬프트 지시를 따르지 않고
// 그대로 반환한 경우에도 화면에 노출되지 않도록 Zod parse 이후 서버에서 다시 마스킹한다.
export function redactPayrollAdaptiveSampleValue(value: string): string {
  return value
    .replace(RESIDENT_NUMBER_PATTERN, REDACTION_MASK)
    .replace(PHONE_NUMBER_PATTERN, REDACTION_MASK)
    .replace(LONG_DIGIT_PATTERN, REDACTION_MASK)
}

export function redactAndBoundPayrollAdaptiveSampleRows(
  rows: PayrollAdaptiveSampleRow[],
  maxRows: number = PAYROLL_ADAPTIVE_SAMPLE_ROW_MAX_COUNT,
): PayrollAdaptiveSampleRow[] {
  return rows.slice(0, maxRows).map((row) => ({
    ...row,
    values: Object.fromEntries(
      Object.entries(row.values).map(([key, value]) => [key, redactPayrollAdaptiveSampleValue(value)]),
    ),
  }))
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatPayrollPeriodLabel(payrollPeriodKey: string): string {
  const [year, month] = payrollPeriodKey.split('-')
  if (!year || !month) return payrollPeriodKey
  return `${year}년 ${Number(month)}월 귀속`
}

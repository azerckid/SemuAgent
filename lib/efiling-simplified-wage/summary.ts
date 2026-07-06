import { loadSimplifiedWageEfilingContext } from './efiling-context'
import { buildSimplifiedWageEfilingSummary } from './panel-summary'

export type {
  EfilingFormatCheck,
  EfilingPanelTone,
  EfilingValidationDisplayItem,
  SimplifiedWageEfilingSummary,
} from './panel-summary'

export { buildSimplifiedWageEfilingSummary } from './panel-summary'
export { loadSimplifiedWageEfilingContext } from './efiling-context'
export type { SimplifiedWageEfilingContext } from './efiling-context'

export async function loadSimplifiedWageEfilingSummary(params: Parameters<typeof loadSimplifiedWageEfilingContext>[0]) {
  const ctx = await loadSimplifiedWageEfilingContext(params)
  if (!ctx) return null

  return buildSimplifiedWageEfilingSummary({
    paymentSummary: ctx.paymentSummary,
    business: ctx.business,
    employees: ctx.employees,
    missingPayrollMonths: ctx.missingPayrollMonths,
    submittedOn: ctx.submittedOn,
  })
}

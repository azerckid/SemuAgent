import type { SimplifiedWageEfilingGenerateInput } from '@/lib/validations/simplified-wage-efiling'
import type { BuildSimplifiedWageInput, SubmitterKind } from './types'
import type { SimplifiedWageEfilingContext } from './efiling-context'

export function assembleBuildInput(
  ctx: SimplifiedWageEfilingContext,
  body: SimplifiedWageEfilingGenerateInput,
): BuildSimplifiedWageInput {
  const submitterKind: SubmitterKind = ctx.business.submitterKind ?? 'individual'
  const obligorRegistrationId = body.representativeId ?? ''

  const employees = ctx.employees.map((emp) => ({
    ...emp,
    residentId:
      emp.simplifiedStatus === 'ready'
        ? (body.employeePii[emp.employeeKey]?.residentId ?? null)
        : null,
  }))

  return {
    year: ctx.paymentSummary.context.year,
    half: ctx.paymentSummary.context.half,
    submittedOn: ctx.submittedOn,
    taxOfficeCode: body.taxOfficeCode,
    submitterKind,
    businessRegistrationNumber: ctx.business.businessRegistrationNumber ?? '',
    businessName: ctx.business.businessName,
    representativeName: ctx.business.representativeName ?? '',
    obligorRegistrationId,
    contactDepartment: body.contactDepartment ?? '',
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    hometaxId: body.hometaxId,
    employees,
    missingPayrollMonths: ctx.missingPayrollMonths,
  }
}

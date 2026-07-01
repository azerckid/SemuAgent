import { z } from 'zod'

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))

const requiredTrimmedString = (fieldName: string) =>
  z.string().trim().min(1, `${fieldName}을 입력해 주세요`)

export const billingProfileInputSchema = z.object({
  businessRegistrationNumber: z
    .string()
    .trim()
    .transform((value) => normalizeBusinessRegistrationNumber(value))
    .refine((value) => value.length === 10, '사업자등록번호 10자리를 입력해 주세요'),
  businessName: requiredTrimmedString('상호명'),
  representativeName: requiredTrimmedString('대표자명'),
  businessAddress: requiredTrimmedString('사업장 주소'),
  businessType: optionalTrimmedString,
  businessItem: optionalTrimmedString,
  taxInvoiceEmail: z.string().trim().email('세금계산서 이메일 형식을 확인해 주세요'),
  billingContactName: requiredTrimmedString('청구 담당자명'),
  billingContactPhone: requiredTrimmedString('청구 담당자 연락처'),
  memo: optionalTrimmedString,
})

export type BillingProfileInput = z.input<typeof billingProfileInputSchema>

export type BillingProfileStatus = 'missing' | 'needs_review' | 'complete'

export type BillingProfileView = {
  id: string
  tenantId: string
  businessRegistrationNumber: string
  maskedBusinessRegistrationNumber: string
  businessName: string
  representativeName: string
  businessAddress: string
  businessType: string | null
  businessItem: string | null
  taxInvoiceEmail: string
  billingContactName: string
  billingContactPhone: string
  memo: string | null
  createdAt: string
  updatedAt: string
}

export function normalizeBusinessRegistrationNumber(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatBusinessRegistrationNumber(value: string): string {
  const normalized = normalizeBusinessRegistrationNumber(value)
  if (normalized.length !== 10) return value
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 5)}-${normalized.slice(5)}`
}

export function maskBusinessRegistrationNumber(value: string): string {
  const normalized = normalizeBusinessRegistrationNumber(value)
  if (normalized.length !== 10) return value ? '***-**-*****' : ''
  return `${normalized.slice(0, 3)}-**-*****`
}

export function getBillingProfileStatus(profile: BillingProfileView | null): BillingProfileStatus {
  if (!profile) return 'missing'
  const requiredValues = [
    profile.businessRegistrationNumber,
    profile.businessName,
    profile.representativeName,
    profile.businessAddress,
    profile.taxInvoiceEmail,
    profile.billingContactName,
    profile.billingContactPhone,
  ]
  return requiredValues.every((value) => value.trim().length > 0) ? 'complete' : 'needs_review'
}

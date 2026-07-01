import { describe, expect, it } from 'vitest'
import {
  billingProfileInputSchema,
  formatBusinessRegistrationNumber,
  getBillingProfileStatus,
  maskBusinessRegistrationNumber,
  normalizeBusinessRegistrationNumber,
  type BillingProfileView,
} from './profile-model'

function completeProfile(overrides: Partial<BillingProfileView> = {}): BillingProfileView {
  return {
    id: 'profile_1',
    tenantId: 'tenant_1',
    businessRegistrationNumber: '123-45-67890',
    maskedBusinessRegistrationNumber: '123-**-*****',
    businessName: '춘심회계법인',
    representativeName: '대표자',
    businessAddress: '서울시 중구',
    businessType: null,
    businessItem: null,
    taxInvoiceEmail: 'tax@example.com',
    billingContactName: '담당자',
    billingContactPhone: '010-1234-5678',
    memo: null,
    createdAt: '2026-06-14T00:00:00.000+09:00',
    updatedAt: '2026-06-14T00:00:00.000+09:00',
    ...overrides,
  }
}

describe('billing profile helpers', () => {
  it('normalizes and formats business registration numbers', () => {
    expect(normalizeBusinessRegistrationNumber('123-45-67890')).toBe('1234567890')
    expect(formatBusinessRegistrationNumber('1234567890')).toBe('123-45-67890')
    expect(maskBusinessRegistrationNumber('1234567890')).toBe('123-**-*****')
  })

  it('validates required invoice profile fields', () => {
    const parsed = billingProfileInputSchema.parse({
      businessRegistrationNumber: '123-45-67890',
      businessName: '춘심회계법인',
      representativeName: '대표자',
      businessAddress: '서울시 중구',
      taxInvoiceEmail: 'tax@example.com',
      billingContactName: '담당자',
      billingContactPhone: '010-1234-5678',
      businessType: '',
      businessItem: '세무',
      memo: '',
    })

    expect(parsed.businessRegistrationNumber).toBe('1234567890')
    expect(parsed.businessType).toBeNull()
    expect(parsed.businessItem).toBe('세무')
    expect(parsed.memo).toBeNull()
  })

  it('rejects invalid business registration and tax email values', () => {
    const result = billingProfileInputSchema.safeParse({
      businessRegistrationNumber: '123',
      businessName: '춘심회계법인',
      representativeName: '대표자',
      businessAddress: '서울시 중구',
      taxInvoiceEmail: 'not-email',
      billingContactName: '담당자',
      billingContactPhone: '010-1234-5678',
    })

    expect(result.success).toBe(false)
  })

  it('derives billing profile status', () => {
    expect(getBillingProfileStatus(null)).toBe('missing')
    expect(getBillingProfileStatus(completeProfile())).toBe('complete')
    expect(getBillingProfileStatus(completeProfile({ taxInvoiceEmail: '' }))).toBe('needs_review')
  })
})

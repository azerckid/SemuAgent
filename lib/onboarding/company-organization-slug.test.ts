import { describe, expect, it } from 'vitest'
import { buildCompanyOrganizationSlug } from './company-organization-slug'

describe('buildCompanyOrganizationSlug', () => {
  it('creates an internal slug without asking the user for a technical identifier', () => {
    expect(buildCompanyOrganizationSlug('Sample Company 2026', 'A1B2-C3D4')).toBe('sample-company-2026-a1b2c3d4')
  })

  it('uses a neutral prefix for Korean-only company names', () => {
    expect(buildCompanyOrganizationSlug('샘플컴퍼니(주)', '0123456789')).toBe('company-0123456789')
  })

  it('keeps the Better Auth organization slug within 30 characters', () => {
    expect(buildCompanyOrganizationSlug('this-is-a-very-long-company-name', '0123456789')).toHaveLength(30)
  })
})

const DEFAULT_COMPANY_SLUG = 'company'

export function buildCompanyOrganizationSlug(name: string, suffix: string): string {
  const normalizedSuffix = suffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
  if (!normalizedSuffix) throw new Error('Organization slug suffix is required')

  const normalizedName = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const prefix = normalizedName || DEFAULT_COMPANY_SLUG
  const maxPrefixLength = 30 - normalizedSuffix.length - 1

  return `${prefix.slice(0, maxPrefixLength).replace(/-+$/g, '') || DEFAULT_COMPANY_SLUG}-${normalizedSuffix}`
}

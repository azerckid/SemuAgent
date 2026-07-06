import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  loadSimplifiedWageEfilingContext: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/efiling-simplified-wage/efiling-context', () => ({
  loadSimplifiedWageEfilingContext: mocks.loadSimplifiedWageEfilingContext,
}))

const { POST } = await import('./route')

function postRequest(body: unknown) {
  return new Request('http://localhost/api/filing-preparation/simplified-wage-efiling/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  year: 2026,
  half: 1,
  taxOfficeCode: '114',
  contactName: 'KimRep',
  contactPhone: '0212345678',
  employeePii: { 'code:E-001': { residentId: '8001011234567' } },
}

const mockContext = {
  paymentSummary: {
    context: { year: 2026, half: 1 as const },
  },
  business: {
    businessRegistrationNumber: '1234567890',
    businessName: 'Haesol',
    representativeName: 'Kim CEO',
    submitterKind: 'individual' as const,
    maskedBusinessRegistrationNumber: null,
  },
  employees: [
    {
      employeeKey: 'code:E-001',
      employeeName: 'KimRep',
      simplifiedStatus: 'ready' as const,
      residentId: null,
      workPeriodStart: '20260101',
      workPeriodEnd: '20260630',
      grossPayKrw: 42_000_000,
      recognizedBonusKrw: 0,
      monthlyGrossPayKrw: {
        '2026-01': 7_000_000,
        '2026-02': 7_000_000,
        '2026-03': 7_000_000,
        '2026-04': 7_000_000,
        '2026-05': 7_000_000,
        '2026-06': 7_000_000,
      },
    },
  ],
  missingPayrollMonths: [],
  submittedOn: '20260705',
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.loadSimplifiedWageEfilingContext.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.loadSimplifiedWageEfilingContext.mockResolvedValue(mockContext)
})

describe('POST /api/filing-preparation/simplified-wage-efiling/generate', () => {
  it('rejects invalid zod input without echoing PII', async () => {
    const response = await POST(postRequest({ ...validBody, employeePii: { 'code:E-001': { residentId: 'short' } } }))
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).not.toContain('800101')
  })

  it('returns octet-stream for valid request', async () => {
    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(response.headers.get('Content-Disposition')).toContain('SC1234567890')
    const buf = Buffer.from(await response.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
  })

  it('returns validation errors without building when data fails checks', async () => {
    mocks.loadSimplifiedWageEfilingContext.mockResolvedValue({
      ...mockContext,
      employees: [{ ...mockContext.employees[0], simplifiedStatus: 'missing_months' }],
    })

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(400)
    const body = await response.json() as { errors: Array<{ message: string }> }
    expect(body.errors.some((e) => e.message.includes('missing_months'))).toBe(true)
    expect(JSON.stringify(body)).not.toContain('8001011234567')
  })

  it('rejects encryption password in slice 2a', async () => {
    const response = await POST(postRequest({ ...validBody, encryptionPassword: 'password12' }))
    expect(response.status).toBe(400)
  })
})

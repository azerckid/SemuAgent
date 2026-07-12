import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
  process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import { vatTaxTreatmentEvidenceAttestation } from '@/lib/db/schema'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { applyVatTaxTreatmentEvidenceMutation } from './tax-treatment-evidence'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import { buildVatTaxTreatmentGate } from './tax-treatment-gate'
import { applyVatTaxTreatmentEvidenceAttestations } from './tax-treatment-summary'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TENANT = 'tenant-1'
const CLIENT = 'client-1'
const STAFF = 'staff-1'
const ROW = 'row-1'
const SESSION = 'session-1'

function displayRow(overrides: Partial<VatTaxTreatmentDisplayRow> = {}) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    rowId: ROW,
    classificationRowId: ROW,
    tenantId: TENANT,
    businessEntityId: CLIENT,
    periodKey: '2026-H1',
    direction: 'sale',
    currentVatFact: {
      taxType: 'zero_rated',
      supplyAmountKrw: 100_000,
      taxAmountKrw: 0,
      grossAmountKrw: 100_000,
      source: 'parser',
      status: 'derived',
    },
    recommendation: 'likely_zero_rated',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '영세율 법정 증빙 확인이 필요합니다.',
    ruleReference: 'S-02',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [
      { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
      {
        code: 'export_or_zero_rate_documents',
        label: '수출·외화입금 등 영세율 법정 증빙',
        status: 'needs_review',
      },
    ],
    missingFacts: ['수출·외화입금 증빙 확인'],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'review_sales_tax_type',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '해외 거래처',
    description: '수출 매출',
    sourceType: 'tax_invoice',
    accountLabel: '매출',
    userActionStatus: 'pending',
    userActionReason: null,
    ...overrides,
  }))
}

function loader(row: VatTaxTreatmentDisplayRow) {
  return vi.fn(async () => row)
}

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'semuagent-vat-evidence-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute('CREATE TABLE tenant (id text PRIMARY KEY)')
  await client.execute('CREATE TABLE client (id text PRIMARY KEY)')
  await client.execute('CREATE TABLE staff (id text PRIMARY KEY)')
  await client.execute(`
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_transaction_classification (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      classification_run_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_type text NOT NULL,
      transaction_date text,
      merchant_name text,
      description text,
      amount_krw integer,
      direction text NOT NULL,
      recommendation_confidence text NOT NULL,
      final_account text,
      status text NOT NULL,
      vat_direction text,
      vat_tax_type text,
      vat_supply_amount_krw integer,
      vat_tax_amount_krw integer,
      vat_gross_amount_krw integer,
      vat_fact_source text,
      vat_fact_source_ref text,
      vat_fact_status text,
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  const migration = readFileSync(new URL('../../drizzle/0070_add_vat_tax_treatment_evidence_attestation.sql', import.meta.url), 'utf8')
  for (const statement of migration.split('--> statement-breakpoint').map((value) => value.trim()).filter(Boolean)) {
    await client.execute(statement)
  }
})

afterAll(() => {
  client.close()
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM vat_tax_treatment_evidence_attestation')
  await client.execute('DELETE FROM bookkeeping_transaction_classification')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM staff')
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM tenant')
  await client.execute({ sql: 'INSERT INTO tenant (id) VALUES (?)', args: [TENANT] })
  await client.execute({ sql: 'INSERT INTO client (id) VALUES (?)', args: [CLIENT] })
  await client.execute({ sql: 'INSERT INTO staff (id) VALUES (?)', args: [STAFF] })
  await client.execute({
    sql: 'INSERT INTO upload_session (id, tenant_id, client_id) VALUES (?, ?, ?)',
    args: [SESSION, TENANT, CLIENT],
  })
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_classification (
      id, tenant_id, classification_run_id, upload_session_id, source_type,
      transaction_date, merchant_name, description, amount_krw, direction,
      recommendation_confidence, final_account, status, vat_direction, vat_tax_type,
      vat_supply_amount_krw, vat_tax_amount_krw, vat_gross_amount_krw,
      vat_fact_source, vat_fact_source_ref, vat_fact_status, created_at, updated_at
    ) VALUES (
      ?, ?, 'run-1', ?, 'tax_invoice',
      '2026-06-15', '해외 거래처', '수출 매출', 100000, 'income',
      'low', 'sales', 'confirmed', 'sale', 'zero_rated',
      100000, 0, 100000,
      'parser', 'source-1', 'derived', '2026-06-15', '2026-06-15'
    )`,
    args: [ROW, TENANT, SESSION],
  })
})

describe('VAI-6b VAT statutory evidence attestation', () => {
  it('stores an attestation, merges it into the read model, and allows the confirmed row through the gate', async () => {
    const base = displayRow()
    const result = await applyVatTaxTreatmentEvidenceMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'confirm',
        periodKey: '2026-H1',
        recommendationFingerprint: base.recommendationFingerprint,
        evidenceCode: 'export_or_zero_rate_documents',
      },
      loadRecommendation: loader(base),
    })
    expect(result).toMatchObject({ ok: true, status: 'present', confirmedAt: expect.any(String) })

    const [attestation] = await testDb.select().from(vatTaxTreatmentEvidenceAttestation)
    expect(attestation).toMatchObject({
      tenantId: TENANT,
      clientId: CLIENT,
      periodKey: '2026-H1',
      classificationRowId: ROW,
      evidenceCode: 'export_or_zero_rate_documents',
      status: 'present',
      confirmedByStaffId: STAFF,
    })

    const [withEvidence] = applyVatTaxTreatmentEvidenceAttestations({
      rows: [base],
      attestations: [attestation],
    })
    expect(withEvidence!.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'export_or_zero_rate_documents',
      status: 'present',
      attestedAt: attestation.confirmedAt,
    }))
    const confirmed = vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
      ...withEvidence,
      finalDecision: 'zero_rated',
      confirmedByStaffId: STAFF,
      confirmedAt: '2026-07-11 16:00:00',
      userActionStatus: 'confirmed',
    }))
    expect(buildVatTaxTreatmentGate([confirmed])).toMatchObject({ isReady: true, blockerCount: 0 })
  })

  it('retains the audit row when confirmation is revoked and relocks the evidence state', async () => {
    const base = displayRow()
    await applyVatTaxTreatmentEvidenceMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'confirm',
        periodKey: '2026-H1',
        recommendationFingerprint: base.recommendationFingerprint,
        evidenceCode: 'export_or_zero_rate_documents',
      },
      loadRecommendation: loader(base),
    })
    const [stored] = await testDb.select().from(vatTaxTreatmentEvidenceAttestation)
    const [withEvidence] = applyVatTaxTreatmentEvidenceAttestations({ rows: [base], attestations: [stored] })

    const result = await applyVatTaxTreatmentEvidenceMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'revoke',
        periodKey: '2026-H1',
        recommendationFingerprint: withEvidence!.recommendationFingerprint,
        evidenceCode: 'export_or_zero_rate_documents',
      },
      loadRecommendation: loader(withEvidence!),
    })
    expect(result).toMatchObject({ ok: true, status: 'revoked', confirmedAt: null })

    const [revoked] = await testDb.select().from(vatTaxTreatmentEvidenceAttestation)
    expect(revoked).toMatchObject({
      status: 'revoked',
      confirmedByStaffId: STAFF,
      revokedByStaffId: STAFF,
      revokedAt: expect.any(String),
    })
    const [relocked] = applyVatTaxTreatmentEvidenceAttestations({ rows: [base], attestations: [revoked] })
    expect(relocked!.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'export_or_zero_rate_documents',
      status: 'needs_review',
    }))
  })

  it('rejects another tenant, a stale fingerprint, and an unrelated evidence code', async () => {
    const base = displayRow()
    const otherTenant = await applyVatTaxTreatmentEvidenceMutation({
      tenantId: 'tenant-other',
      staffId: 'staff-other',
      rowId: ROW,
      input: {
        action: 'confirm',
        periodKey: '2026-H1',
        recommendationFingerprint: base.recommendationFingerprint,
        evidenceCode: 'export_or_zero_rate_documents',
      },
      loadRecommendation: loader(base),
    })
    expect(otherTenant).toMatchObject({ ok: false, status: 404 })

    const stale = await applyVatTaxTreatmentEvidenceMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'confirm',
        periodKey: '2026-H1',
        recommendationFingerprint: 'f'.repeat(64),
        evidenceCode: 'export_or_zero_rate_documents',
      },
      loadRecommendation: loader(base),
    })
    expect(stale).toMatchObject({ ok: false, status: 409 })

    const unrelated = await applyVatTaxTreatmentEvidenceMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'confirm',
        periodKey: '2026-H1',
        recommendationFingerprint: base.recommendationFingerprint,
        evidenceCode: 'exemption_qualification',
      },
      loadRecommendation: loader(base),
    })
    expect(unrelated).toMatchObject({ ok: false, status: 400 })
    expect(await testDb.select().from(vatTaxTreatmentEvidenceAttestation)).toHaveLength(0)
  })
})

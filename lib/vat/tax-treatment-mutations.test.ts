import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
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
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import {
  bookkeepingTransactionClassification,
  vatDeductionReview,
  vatTaxTreatmentReview,
} from '@/lib/db/schema'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import { applyVatTaxTreatmentMutation } from './tax-treatment-mutations'

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

function displayRow(
  overrides: Partial<VatTaxTreatmentDisplayRow> = {},
): VatTaxTreatmentDisplayRow {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    rowId: ROW,
    classificationRowId: ROW,
    tenantId: TENANT,
    businessEntityId: CLIENT,
    periodKey: '2026-H1',
    direction: 'purchase',
    currentVatFact: {
      taxType: 'taxable',
      supplyAmountKrw: 100_000,
      taxAmountKrw: 10_000,
      grossAmountKrw: 110_000,
      source: 'parser',
      status: 'derived',
    },
    recommendation: 'likely_deductible',
    source: 'deterministic_rule',
    confidence: 'medium',
    basisLabel: '정확한 VAT fact와 업무용 계정항목이 확인되었습니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [
      { code: 'exact_vat_fact', label: '공급가액·세액·합계액 일치', status: 'present' },
      { code: 'qualified_purchase_evidence', label: '세금계산서 원천 행 있음', status: 'present' },
    ],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '클라우드서비스',
    description: '업무용 SaaS 이용료',
    sourceType: 'tax_invoice',
    accountLabel: '지급수수료',
    ...overrides,
  }))
}

function loader(row: VatTaxTreatmentDisplayRow) {
  return vi.fn(async () => row)
}

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'semuagent-vat-treatment-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

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
      source_batch_id text,
      upload_file_id text,
      source_type text NOT NULL DEFAULT 'other',
      transaction_date text,
      merchant_name text,
      description text,
      amount_krw integer,
      direction text NOT NULL DEFAULT 'unknown',
      recommended_account text,
      recommendation_confidence text NOT NULL DEFAULT 'low',
      recommendation_reason text,
      evidence_json text,
      final_account text,
      staff_memo text,
      status text NOT NULL DEFAULT 'suggested',
      vat_direction text,
      vat_tax_type text,
      vat_supply_amount_krw integer,
      vat_tax_amount_krw integer,
      vat_gross_amount_krw integer,
      vat_fact_source text,
      vat_fact_source_ref text,
      vat_fact_status text,
      linked_evidence_row_id text,
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE vat_deduction_review (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      period_key text NOT NULL,
      source_voucher_id text,
      source_voucher_line_id text,
      classification_row_id text,
      description text NOT NULL,
      counterparty text,
      supply_amount_krw integer NOT NULL DEFAULT 0,
      input_tax_krw integer NOT NULL DEFAULT 0,
      kind text NOT NULL DEFAULT 'deductible',
      decision text NOT NULL DEFAULT 'pending',
      reason text NOT NULL DEFAULT '',
      proration_rate_bps integer,
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE vat_tax_treatment_review (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      period_key text NOT NULL,
      classification_row_id text NOT NULL,
      direction text NOT NULL,
      recommendation text NOT NULL,
      recommendation_source text NOT NULL,
      confidence text NOT NULL,
      basis_label text NOT NULL,
      rule_reference text,
      rule_version text NOT NULL,
      ai_provider text,
      ai_model_name text,
      ai_prompt_version text,
      required_evidence_json text NOT NULL,
      missing_facts_json text NOT NULL,
      hometax_comparison_mode text NOT NULL,
      hometax_action text NOT NULL,
      recommendation_fingerprint text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      final_decision text,
      final_reason text,
      proration_rate_bps integer,
      confirmed_by_staff_id text,
      confirmed_at text,
      undo_token_hash text,
      undo_canonical_state_json text,
      undo_action_state_json text,
      recommended_at text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE UNIQUE INDEX vat_tax_treatment_review_scope_uidx
    ON vat_tax_treatment_review (tenant_id, client_id, period_key, classification_row_id)
  `)
})

afterAll(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DROP TRIGGER IF EXISTS fail_vat_tax_treatment_audit')
  await client.execute('DELETE FROM vat_tax_treatment_review')
  await client.execute('DELETE FROM vat_deduction_review')
  await client.execute('DELETE FROM bookkeeping_transaction_classification')
  await client.execute('DELETE FROM upload_session')
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
      '2026-06-15', '클라우드서비스', '업무용 SaaS 이용료', -110000, 'expense',
      'medium', 'fees', 'confirmed', 'purchase', 'taxable',
      100000, 10000, 110000,
      'parser', 'source-1', 'derived', '2026-06-15', '2026-06-15'
    )`,
    args: [ROW, TENANT, SESSION],
  })
})

describe('VAI-4a VAT tax treatment mutation transaction', () => {
  it('stores a purchase canonical decision and recommendation audit atomically', async () => {
    const recommendation = displayRow()
    const result = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'confirmed',
      finalDecision: 'deductible',
      undoToken: expect.any(String),
    })

    const [canonical] = await testDb.select().from(vatDeductionReview)
    expect(canonical).toMatchObject({
      tenantId: TENANT,
      clientId: CLIENT,
      periodKey: '2026-H1',
      classificationRowId: ROW,
      decision: 'deductible',
      confirmedByStaffId: STAFF,
    })

    const [audit] = await testDb.select().from(vatTaxTreatmentReview)
    expect(audit).toMatchObject({
      recommendation: 'likely_deductible',
      recommendationSource: 'deterministic_rule',
      recommendationFingerprint: recommendation.recommendationFingerprint,
      status: 'confirmed',
      finalDecision: 'deductible',
      confirmedByStaffId: STAFF,
      undoTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      undoCanonicalStateJson: expect.any(String),
      undoActionStateJson: expect.any(String),
    })
  })

  it('undoes the latest purchase confirmation and clears its one-time token', async () => {
    const recommendation = displayRow()
    const applied = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok || !applied.undoToken) throw new Error('undo token expected')

    const undone = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'undo',
        periodKey: '2026-H1',
        undoToken: applied.undoToken,
      },
    })

    expect(undone).toEqual({
      ok: true,
      status: 'pending',
      finalDecision: null,
      undoToken: null,
    })
    expect(await testDb.select().from(vatDeductionReview)).toHaveLength(0)
    const [audit] = await testDb.select().from(vatTaxTreatmentReview)
    expect(audit).toMatchObject({
      status: 'pending',
      finalDecision: null,
      undoTokenHash: null,
      undoCanonicalStateJson: null,
      undoActionStateJson: null,
    })
  })

  it('updates an existing purchase review kind and restores it on undo', async () => {
    const recommendation = displayRow({
      finalDecision: 'deductible',
      confirmedByStaffId: STAFF,
      confirmedAt: '2026-06-16 00:00:00',
    })
    await testDb.insert(vatDeductionReview).values({
      id: 'review-existing',
      tenantId: TENANT,
      clientId: CLIENT,
      periodKey: '2026-H1',
      classificationRowId: ROW,
      description: '업무용 SaaS 이용료',
      counterparty: '클라우드서비스',
      supplyAmountKrw: 100_000,
      inputTaxKrw: 10_000,
      kind: 'deductible',
      decision: 'deductible',
      reason: '기존 공제 확정',
      confirmedByStaffId: STAFF,
      confirmedAt: '2026-06-16 00:00:00',
      createdAt: '2026-06-16 00:00:00',
      updatedAt: '2026-06-16 00:00:00',
    })

    const applied = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'confirm_different',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
        finalDecision: 'non_deductible',
        reason: '업무 관련 증빙 부족',
      },
      loadRecommendation: loader(recommendation),
    })
    if (!applied.ok || !applied.undoToken) throw new Error('undo token expected')

    const [changed] = await testDb.select().from(vatDeductionReview)
    expect(changed).toMatchObject({
      kind: 'non_deductible_candidate',
      decision: 'non_deductible',
      reason: '업무 관련 증빙 부족',
    })

    await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'undo',
        periodKey: '2026-H1',
        undoToken: applied.undoToken,
      },
    })

    const [restored] = await testDb.select().from(vatDeductionReview)
    expect(restored).toMatchObject({
      kind: 'deductible',
      decision: 'deductible',
      reason: '기존 공제 확정',
    })
  })

  it('rejects an invalid or already consumed undo token', async () => {
    const recommendation = displayRow()
    const applied = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'hold',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })
    expect(applied.ok).toBe(true)

    const rejected = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'undo',
        periodKey: '2026-H1',
        undoToken: randomUUID(),
      },
    })
    expect(rejected).toMatchObject({ ok: false, status: 409 })
  })

  it('confirms a sale tax type in the existing exact VAT fact canonical row', async () => {
    await testDb
      .update(bookkeepingTransactionClassification)
      .set({ direction: 'income', amountKrw: 110_000, vatDirection: 'sale' })
      .where(eq(bookkeepingTransactionClassification.id, ROW))
    const recommendation = displayRow({
      direction: 'sale',
      recommendation: 'likely_taxable',
      basisLabel: '국내 과세 매출입니다.',
      ruleReference: 'S-01',
      currentVatFact: {
        ...displayRow().currentVatFact,
        taxType: 'taxable',
      },
    })

    const result = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })

    expect(result).toMatchObject({ ok: true, finalDecision: 'taxable' })
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, ROW))
    expect(row).toMatchObject({
      vatTaxType: 'taxable',
      vatFactSource: 'manual',
      vatFactStatus: 'confirmed',
      confirmedByStaffId: STAFF,
    })
  })

  it('restores the original parser VAT fact when a sale confirmation is undone', async () => {
    await testDb
      .update(bookkeepingTransactionClassification)
      .set({ direction: 'income', amountKrw: 110_000, vatDirection: 'sale' })
      .where(eq(bookkeepingTransactionClassification.id, ROW))
    const recommendation = displayRow({
      direction: 'sale',
      recommendation: 'likely_taxable',
      basisLabel: '국내 과세 매출입니다.',
      ruleReference: 'S-01',
    })
    const applied = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })
    if (!applied.ok || !applied.undoToken) throw new Error('undo token expected')

    const undone = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'undo',
        periodKey: '2026-H1',
        undoToken: applied.undoToken,
      },
    })
    expect(undone).toMatchObject({ ok: true, status: 'pending', finalDecision: null })

    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, ROW))
    expect(row).toMatchObject({
      vatTaxType: 'taxable',
      vatFactSource: 'parser',
      vatFactSourceRef: 'source-1',
      vatFactStatus: 'derived',
      confirmedByStaffId: null,
      confirmedAt: null,
      updatedAt: '2026-06-15',
    })
  })

  it('does not expose another tenant row', async () => {
    const recommendation = displayRow()
    const result = await applyVatTaxTreatmentMutation({
      tenantId: 'tenant-other',
      staffId: 'staff-other',
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: '부가세 판단 거래를 찾을 수 없습니다.',
    })
    expect((await testDb.select().from(vatTaxTreatmentReview))).toHaveLength(0)
  })

  it('rejects a stale recommendation fingerprint without writing', async () => {
    const recommendation = displayRow()
    const result = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: 'f'.repeat(64),
      },
      loadRecommendation: loader(recommendation),
    })

    expect(result).toMatchObject({ ok: false, status: 409 })
    expect((await testDb.select().from(vatDeductionReview))).toHaveLength(0)
    expect((await testDb.select().from(vatTaxTreatmentReview))).toHaveLength(0)
  })

  it('blocks zero-rated confirmation while required evidence is unresolved', async () => {
    const recommendation = displayRow({
      direction: 'sale',
      recommendation: 'likely_zero_rated',
      currentVatFact: {
        taxType: 'zero_rated',
        supplyAmountKrw: 110_000,
        taxAmountKrw: 0,
        grossAmountKrw: 110_000,
        source: 'parser',
        status: 'derived',
      },
      requiredEvidence: [{
        code: 'export_or_zero_rate_documents',
        label: '수출·외화입금 등 영세율 법정 증빙',
        status: 'needs_review',
      }],
    })
    const result = await applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })

    expect(result).toMatchObject({ ok: false, status: 409 })
    expect((await testDb.select().from(vatTaxTreatmentReview))).toHaveLength(0)
  })

  it('rolls back the canonical decision when the audit write fails', async () => {
    await client.execute(`
      CREATE TRIGGER fail_vat_tax_treatment_audit
      BEFORE INSERT ON vat_tax_treatment_review
      BEGIN
        SELECT RAISE(ABORT, 'audit failure');
      END
    `)
    const recommendation = displayRow()

    await expect(applyVatTaxTreatmentMutation({
      tenantId: TENANT,
      staffId: STAFF,
      rowId: ROW,
      input: {
        action: 'apply_recommendation',
        periodKey: '2026-H1',
        recommendationFingerprint: recommendation.recommendationFingerprint,
      },
      loadRecommendation: loader(recommendation),
    })).rejects.toThrow()

    expect((await testDb.select().from(vatDeductionReview))).toHaveLength(0)
    expect((await testDb.select().from(vatTaxTreatmentReview))).toHaveLength(0)
  })
})

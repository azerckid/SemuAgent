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
import { DateTime } from 'luxon'
import * as authSchema from '@/lib/db/auth-schema'
import * as appSchema from '@/lib/db/schema'
import { vatTaxTreatmentAiResult } from '@/lib/db/schema'
import {
  VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
  VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
} from '@/lib/validations/vat-tax-treatment-ai-result'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import {
  applyReusableVatTaxTreatmentAiResults,
  applyStoredVatTaxTreatmentAiResults as applyStoredVatTaxTreatmentAiResultsFromStore,
  completeVatTaxTreatmentAiResult as completeVatTaxTreatmentAiResultInStore,
  reserveVatTaxTreatmentAiResult as reserveVatTaxTreatmentAiResultInStore,
  startVatTaxTreatmentAiResult as startVatTaxTreatmentAiResultInStore,
  type VatTaxTreatmentAiDatabase,
  type VatTaxTreatmentAiResultReadRow,
} from './tax-treatment-ai-result'

let client: Client
let testDb: VatTaxTreatmentAiDatabase
let testDir: string

function applyStoredVatTaxTreatmentAiResults(
  params: Parameters<typeof applyStoredVatTaxTreatmentAiResultsFromStore>[0],
) {
  return applyStoredVatTaxTreatmentAiResultsFromStore({ ...params, database: testDb })
}

function reserveVatTaxTreatmentAiResult(
  params: Parameters<typeof reserveVatTaxTreatmentAiResultInStore>[0],
) {
  return reserveVatTaxTreatmentAiResultInStore({ ...params, database: testDb })
}

function startVatTaxTreatmentAiResult(
  params: Parameters<typeof startVatTaxTreatmentAiResultInStore>[0],
) {
  return startVatTaxTreatmentAiResultInStore({ ...params, database: testDb })
}

function completeVatTaxTreatmentAiResult(
  params: Parameters<typeof completeVatTaxTreatmentAiResultInStore>[0],
) {
  return completeVatTaxTreatmentAiResultInStore({ ...params, database: testDb })
}

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TENANT = 'tenant-1'
const CLIENT = 'client-1'
const ROW = 'row-1'

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
    userActionStatus: 'pending',
    userActionReason: null,
    ...overrides,
  }))
}

function aiRow(base: VatTaxTreatmentDisplayRow) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    ...base,
    recommendation: 'likely_non_deductible' as const,
    source: 'ai_single' as const,
    confidence: 'medium' as const,
    basisLabel: 'AI가 업무 관련성 근거가 부족하다고 판단했습니다.',
    ruleReference: null,
    missingFacts: ['업무 목적'],
    hometaxAction: 'review_deduction' as const,
    aiTrace: {
      provider: 'gemini' as const,
      modelName: 'gemini-test',
      promptVersion: VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
      consensusProviders: [],
    },
    aiRuntimeStatus: 'completed' as const,
  }))
}

function fallbackRow(base: VatTaxTreatmentDisplayRow) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    ...base,
    recommendation: 'needs_review' as const,
    source: 'deterministic_rule' as const,
    confidence: 'low' as const,
    basisLabel: 'AI 판단을 완료하지 못해 사용자가 직접 확인해야 합니다.',
    ruleReference: null,
    missingFacts: ['AI 판단 일시 실패'],
    hometaxAction: 'review_deduction' as const,
    aiTrace: null,
    aiRuntimeStatus: 'manual_fallback' as const,
  }))
}

function payload(row: VatTaxTreatmentDisplayRow) {
  return JSON.stringify({
    version: VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
    recommendation: row.recommendation,
    source: row.source,
    confidence: row.confidence,
    basisLabel: row.basisLabel,
    ruleReference: row.ruleReference,
    missingFacts: row.missingFacts,
    hometaxAction: row.hometaxAction,
    aiTrace: row.aiTrace,
    aiRuntimeStatus: row.aiRuntimeStatus,
  })
}

function readResult(params: {
  base: VatTaxTreatmentDisplayRow
  result: VatTaxTreatmentDisplayRow
  status?: 'ready' | 'manual_fallback'
  nextRetryAt?: string | null
}): VatTaxTreatmentAiResultReadRow {
  return {
    id: 'result-1',
    tenantId: params.base.tenantId,
    clientId: params.base.businessEntityId,
    periodKey: params.base.periodKey,
    classificationRowId: params.base.classificationRowId,
    inputFingerprint: params.base.recommendationFingerprint,
    ruleVersion: params.base.ruleVersion,
    promptVersion: VAT_TAX_TREATMENT_AI_PROMPT_VERSION,
    status: params.status ?? 'ready',
    payloadVersion: VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION,
    resultPayloadJson: payload(params.result),
    resultFingerprint: params.result.recommendationFingerprint,
    nextRetryAt: params.nextRetryAt ?? null,
    updatedAt: '2026-07-12T10:00:00.000+09:00',
  }
}

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'semuagent-vat-ai-result-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: { ...appSchema, ...authSchema } })
  await client.execute('PRAGMA foreign_keys = ON')
  await client.execute('CREATE TABLE tenant (id text PRIMARY KEY)')
  await client.execute('CREATE TABLE client (id text PRIMARY KEY)')
  await client.execute('CREATE TABLE bookkeeping_transaction_classification (id text PRIMARY KEY)')
  const migration = readFileSync(
    new URL('../../drizzle/0073_add_vat_tax_treatment_ai_result.sql', import.meta.url),
    'utf8',
  )
  for (const statement of migration.split('--> statement-breakpoint').map((value) => value.trim()).filter(Boolean)) {
    await client.execute(statement)
  }
  await client.execute({ sql: 'INSERT INTO tenant (id) VALUES (?)', args: [TENANT] })
  await client.execute({ sql: 'INSERT INTO client (id) VALUES (?)', args: [CLIENT] })
  await client.execute({
    sql: 'INSERT INTO bookkeeping_transaction_classification (id) VALUES (?)',
    args: [ROW],
  })
})

afterAll(() => {
  client?.close()
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM vat_tax_treatment_ai_result')
})

describe('VAI-7b reusable VAT AI result', () => {
  it('applies only a matching ready payload and verifies its output fingerprint', () => {
    const base = displayRow()
    const result = aiRow(base)
    const [reused] = applyReusableVatTaxTreatmentAiResults({
      rows: [base],
      resultRows: [readResult({ base, result })],
    })
    expect(reused).toMatchObject({
      recommendation: 'likely_non_deductible',
      source: 'ai_single',
      aiRuntimeStatus: 'completed',
      recommendationFingerprint: result.recommendationFingerprint,
    })

    const [ignored] = applyReusableVatTaxTreatmentAiResults({
      rows: [base],
      resultRows: [{
        ...readResult({ base, result }),
        inputFingerprint: 'f'.repeat(64),
      }],
    })
    expect(ignored).toEqual(base)
  })

  it('reuses manual fallback only before nextRetryAt and never replaces a confirmed row', () => {
    const base = displayRow()
    const result = fallbackRow(base)
    const stored = readResult({
      base,
      result,
      status: 'manual_fallback',
      nextRetryAt: '2026-07-12T10:15:00.000+09:00',
    })
    expect(applyReusableVatTaxTreatmentAiResults({
      rows: [base],
      resultRows: [stored],
      nowAt: DateTime.fromISO('2026-07-12T10:05:00.000+09:00'),
    })[0]).toMatchObject({ aiRuntimeStatus: 'manual_fallback' })
    expect(applyReusableVatTaxTreatmentAiResults({
      rows: [base],
      resultRows: [stored],
      nowAt: DateTime.fromISO('2026-07-12T10:16:00.000+09:00'),
    })[0]).toEqual(base)

    const confirmed = displayRow({
      finalDecision: 'deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-12T09:00:00.000+09:00',
      userActionStatus: 'confirmed',
    })
    expect(applyReusableVatTaxTreatmentAiResults({
      rows: [confirmed],
      resultRows: [readResult({ base: confirmed, result: aiRow(confirmed) })],
    })[0]).toEqual(confirmed)
  })

  it('rejects a matching fingerprint from another tenant, business, or period', () => {
    const base = displayRow()
    const result = aiRow(base)
    const stored = readResult({ base, result })
    for (const scopeOverride of [
      { tenantId: 'tenant-2' },
      { clientId: 'client-2' },
      { periodKey: '2025-H2' },
    ]) {
      expect(applyReusableVatTaxTreatmentAiResults({
        rows: [base],
        resultRows: [{ ...stored, ...scopeOverride }],
      })[0]).toEqual(base)
    }
  })
})

describe('VAI-7b execution reservation and persistence', () => {
  it('allows only one concurrent reservation and reuses the completed result', async () => {
    const base = displayRow()
    const at = DateTime.fromISO('2026-07-12T10:00:00.000+09:00')
    const reservations = await Promise.all([
      reserveVatTaxTreatmentAiResult({ row: base, nowAt: at }),
      reserveVatTaxTreatmentAiResult({ row: base, nowAt: at }),
    ])
    expect(reservations.filter((item) => item.shouldRun)).toHaveLength(1)
    const owner = reservations.find((item) => item.shouldRun)!
    expect(await startVatTaxTreatmentAiResult({
      resultId: owner.resultId!,
      executionToken: owner.executionToken!,
      nowAt: at,
    })).toBe(true)
    expect(await startVatTaxTreatmentAiResult({
      resultId: owner.resultId!,
      executionToken: owner.executionToken!,
      nowAt: at,
    })).toBe(false)

    const result = aiRow(base)
    expect(await completeVatTaxTreatmentAiResult({
      resultId: owner.resultId!,
      executionToken: owner.executionToken!,
      inputFingerprint: base.recommendationFingerprint,
      result,
      nowAt: at.plus({ seconds: 10 }),
    })).toBe(true)

    const [stored] = await testDb.select().from(vatTaxTreatmentAiResult)
    expect(stored).toMatchObject({
      status: 'ready',
      resultFingerprint: result.recommendationFingerprint,
      executionToken: null,
      leaseExpiresAt: null,
      attemptCount: 1,
    })
    expect(await reserveVatTaxTreatmentAiResult({ row: base, nowAt: at.plus({ minutes: 1 }) }))
      .toMatchObject({ status: 'ready', shouldRun: false })
    expect((await applyStoredVatTaxTreatmentAiResults({
      tenantId: TENANT,
      businessEntityId: CLIENT,
      periodKey: '2026-H1',
      rows: [base],
      nowAt: at.plus({ minutes: 1 }),
    }))[0]).toMatchObject({
      recommendation: 'likely_non_deductible',
      source: 'ai_single',
    })
  })

  it('marks the old fingerprint stale and claims the changed row once', async () => {
    const base = displayRow()
    const first = await reserveVatTaxTreatmentAiResult({
      row: base,
      nowAt: DateTime.fromISO('2026-07-12T10:00:00.000+09:00'),
    })
    expect(first.shouldRun).toBe(true)
    const changed = displayRow({
      currentVatFact: {
        ...base.currentVatFact,
        supplyAmountKrw: 200_000,
        taxAmountKrw: 20_000,
        grossAmountKrw: 220_000,
      },
    })
    const second = await reserveVatTaxTreatmentAiResult({
      row: changed,
      nowAt: DateTime.fromISO('2026-07-12T10:01:00.000+09:00'),
    })
    expect(second.shouldRun).toBe(true)
    const rows = await testDb.select().from(vatTaxTreatmentAiResult)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.inputFingerprint === base.recommendationFingerprint)?.status)
      .toBe('stale')
    expect(rows.find((row) => row.inputFingerprint === changed.recommendationFingerprint)?.status)
      .toBe('queued')
  })

  it('holds manual fallback until backoff expires, then gives one new lease', async () => {
    const base = displayRow()
    const at = DateTime.fromISO('2026-07-12T10:00:00.000+09:00')
    const reserved = await reserveVatTaxTreatmentAiResult({ row: base, nowAt: at })
    await startVatTaxTreatmentAiResult({
      resultId: reserved.resultId!,
      executionToken: reserved.executionToken!,
      nowAt: at,
    })
    await completeVatTaxTreatmentAiResult({
      resultId: reserved.resultId!,
      executionToken: reserved.executionToken!,
      inputFingerprint: base.recommendationFingerprint,
      result: fallbackRow(base),
      nowAt: at.plus({ seconds: 10 }),
    })

    expect(await reserveVatTaxTreatmentAiResult({ row: base, nowAt: at.plus({ minutes: 5 }) }))
      .toMatchObject({ status: 'manual_fallback', shouldRun: false })
    const retries = await Promise.all([
      reserveVatTaxTreatmentAiResult({ row: base, nowAt: at.plus({ minutes: 16 }) }),
      reserveVatTaxTreatmentAiResult({ row: base, nowAt: at.plus({ minutes: 16 }) }),
    ])
    expect(retries.filter((item) => item.shouldRun)).toHaveLength(1)
  })

  it('applies the additive migration with the unique scope and lease columns', async () => {
    const columns = await client.execute('PRAGMA table_info(vat_tax_treatment_ai_result)')
    const columnNames = columns.rows.map((row) => row.name)
    expect(columnNames).toEqual(expect.arrayContaining([
      'input_fingerprint',
      'result_payload_json',
      'execution_token',
      'lease_expires_at',
      'next_retry_at',
    ]))
    expect(columnNames).not.toEqual(expect.arrayContaining([
      'raw_prompt',
      'raw_provider_response',
      'resident_registration_number',
      'card_number',
      'account_number',
    ]))
    const indexes = await client.execute('PRAGMA index_list(vat_tax_treatment_ai_result)')
    expect(indexes.rows.map((row) => row.name)).toEqual(expect.arrayContaining([
      'vat_tax_treatment_ai_result_scope_fingerprint_uidx',
      'vat_tax_treatment_ai_result_active_scope_uidx',
    ]))
  })
})
  it('keeps one active execution when different fingerprints race for the same row', async () => {
    const base = displayRow()
    const changed = displayRow({
      currentVatFact: {
        ...base.currentVatFact,
        supplyAmountKrw: 200_000,
        taxAmountKrw: 20_000,
        grossAmountKrw: 220_000,
      },
    })
    const at = DateTime.fromISO('2026-07-12T10:00:00.000+09:00')
    const reservations = await Promise.all([
      reserveVatTaxTreatmentAiResult({ row: base, nowAt: at }),
      reserveVatTaxTreatmentAiResult({ row: changed, nowAt: at }),
    ])
    expect(reservations.filter((item) => item.shouldRun)).toHaveLength(1)
    const rows = await testDb.select().from(vatTaxTreatmentAiResult)
    expect(rows.filter((row) => row.status === 'queued' || row.status === 'running'))
      .toHaveLength(1)
  })

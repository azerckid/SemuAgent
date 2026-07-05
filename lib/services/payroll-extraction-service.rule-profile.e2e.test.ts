import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import { toDBString, now } from '@/lib/time'
import {
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  type ClientPayrollRuleProfileV1,
} from '@/lib/validations/payroll-rule-profile'
import type { PayrollExtractedRow } from '@/lib/validations/payroll'

/**
 * Slice 7 통합 e2e — `executePayrollExtraction`를 실제로 구동해 급여기준 프로필
 * 트랙의 end-to-end 동작을 검증한다. 실제로 실행되는 것: 레지스트리 조회
 * (getActiveClientPayrollRuleProfile), profile_json Zod 파싱, 결정론 규칙 엔진
 * (applyClientPayrollRuleProfileToRows), 충돌 행 강등, row 저장, 적용 스냅샷 저장.
 * 모킹하는 것: 파일/AI 추출 상위 단계(Blob·extract·payroll-extract)와 다른
 * 추출 경로(구조화 계산·adaptive 모델)뿐. 즉 규칙 엔진 자체는 mock하지 않는다.
 *
 * 핵심 시나리오:
 * - 승인 프로필 있음 → F~T(지급) 항목이 규정대로 채워지고 스냅샷이 저장된다.
 * - 승인 프로필 없음 → 데이터 그대로 완료. needs_review로 보내지 않고, 스냅샷도
 *   만들지 않는다("사내지급기준 없음 = 그대로 마무리" 제품 방향).
 * - 업로드 금액과 규정 금액 충돌 → 결과 엑셀 안전 게이트를 위해 해당 행만 fail로 강등.
 */

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

vi.mock('@vercel/blob', () => ({
  // statusCode 200 + stream을 흉내. 실제 파일 내용은 extractDocumentTextChunks를
  // 모킹하므로 사용되지 않는다.
  get: vi.fn(async () => ({ statusCode: 200, stream: null })),
}))

vi.mock('@/lib/ai/extract', () => ({
  extractDocumentTextChunks: vi.fn(async () => [
    { text: '급여대장', summary: '', chunkIndex: 0, chunkTotal: 1 },
  ]),
}))

vi.mock('@/lib/ai/payroll-extract', () => ({
  extractPayrollWithProviderFallbackInBatches: vi.fn(),
  getPayrollAiModelChainLabel: () => 'gemini -> gpt -> claude',
}))

// 다른 추출 경로는 비활성화해 AI(모킹) 경로로 흐르게 한다.
vi.mock('@/lib/payroll/structured-calculation', () => ({
  extractStructuredPayrollFromSourceTexts: vi.fn(() => null),
}))

vi.mock('@/lib/payroll/adaptive-structuring-apply', () => ({
  applyApprovedPayrollAdaptiveModel: vi.fn(async () => null),
}))

const {
  uploadSession,
  uploadFile,
  payrollExtractionRow,
  payrollExtractionBatch,
  clientPayrollRuleProfile,
  payrollRuleProfileApplication,
} = appSchema

const { extractPayrollWithProviderFallbackInBatches } = await import('@/lib/ai/payroll-extract')
const { executePayrollExtraction } = await import('./payroll-extraction-service')

const TENANT = 'tenant-1'
const CLIENT = 'client-1'
const STAFF = 'staff-1'
const PERIOD = '2026-03'

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })

  // 실제 마이그레이션(drizzle/*.sql)에서 추출한 DDL. 손으로 줄이지 않고 현재
  // 스키마 그대로 사용해 drift를 막는다. libsql in-memory는 FK를 강제하지
  // 않으므로 부모 테이블(tenant/client/staff) 없이도 동작한다.
  const ddl = [
    `CREATE TABLE upload_session (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      created_by_staff_id text NOT NULL,
      accounting_period text NOT NULL,
      token_hash text NOT NULL,
      upload_url text,
      expires_at text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      analysis_notes text,
      session_evaluation text,
      request_email_subject text,
      request_email_body text,
      extracted_criteria text,
      additional_criteria text,
      last_accessed_at text,
      request_event_id text,
      deleted_at text,
      deleted_by_staff_id text,
      created_at text NOT NULL,
      request_kind text NOT NULL DEFAULT 'general',
      request_email_cc text,
      source text NOT NULL DEFAULT 'customer_upload',
      bookkeeping_period_type text,
      bookkeeping_period_start text,
      bookkeeping_period_end text,
      staff_direct_label text
    )`,
    `CREATE TABLE upload_file (
      id text PRIMARY KEY NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
      tenant_id text NOT NULL,
      original_filename text NOT NULL,
      storage_key text NOT NULL,
      file_type text NOT NULL,
      file_size integer NOT NULL,
      content_hash text NOT NULL,
      status text DEFAULT 'uploaded' NOT NULL,
      uploaded_at text NOT NULL,
      password_status text DEFAULT 'none' NOT NULL,
      password_last_submitted_at text,
      password_attempt_count integer DEFAULT 0 NOT NULL,
      staff_review_status text DEFAULT 'none' NOT NULL,
      staff_review_note text,
      staff_reviewed_by_staff_id text,
      staff_reviewed_at text
    )`,
    `CREATE TABLE payroll_extraction_batch (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      upload_session_id TEXT NOT NULL,
      request_event_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source_upload_file_ids TEXT NOT NULL,
      model TEXT,
      error_message TEXT,
      created_by_staff_id TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )`,
    `CREATE UNIQUE INDEX payroll_batch_running_uidx ON payroll_extraction_batch (upload_session_id) WHERE status = 'running'`,
    `CREATE TABLE payroll_extraction_row (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      upload_session_id TEXT NOT NULL,
      payroll_period TEXT NOT NULL,
      employee_code TEXT,
      employee_name TEXT,
      department TEXT,
      job_title TEXT,
      job_type TEXT,
      base_salary INTEGER,
      bonus INTEGER,
      meal_allowance INTEGER,
      transportation_allowance INTEGER,
      holiday_work_allowance INTEGER,
      domestic_travel_allowance INTEGER,
      annual_leave_allowance INTEGER,
      rnd_allowance INTEGER,
      other_allowance INTEGER,
      performance_incentive INTEGER,
      night_work_allowance INTEGER,
      deduction_amount INTEGER,
      memo TEXT,
      source_reference TEXT,
      confidence TEXT NOT NULL DEFAULT 'unknown',
      review_status TEXT NOT NULL DEFAULT 'needs_review',
      reviewed_by_staff_id TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ai_verdict TEXT,
      ai_verdict_reason TEXT,
      vehicle_maintenance_allowance integer,
      retroactive_pay integer,
      overtime_allowance integer,
      childcare_allowance integer
    )`,
    `CREATE TABLE client_payroll_rule_profile (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      version integer DEFAULT 1 NOT NULL,
      effective_from text NOT NULL,
      effective_to text,
      profile_json text NOT NULL,
      source_summary_json text NOT NULL,
      approval_notes text,
      approved_by_staff_id text,
      approved_at text,
      created_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE TABLE payroll_rule_profile_application (
      id text PRIMARY KEY NOT NULL,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      profile_id text NOT NULL,
      profile_version integer NOT NULL,
      upload_session_id text NOT NULL,
      batch_id text,
      snapshot_json text NOT NULL,
      applied_at text NOT NULL,
      created_at text NOT NULL
    )`,
  ]
  for (const stmt of ddl) await client.execute(stmt)
})

beforeEach(async () => {
  for (const t of [
    'payroll_rule_profile_application',
    'payroll_extraction_row',
    'payroll_extraction_batch',
    'client_payroll_rule_profile',
    'upload_file',
    'upload_session',
  ]) {
    await client.execute(`DELETE FROM ${t}`)
  }
  vi.mocked(extractPayrollWithProviderFallbackInBatches).mockReset()
})

async function seedPayrollSession(): Promise<string> {
  const ts = toDBString(now())
  const sessionId = 'session-1'
  await testDb.insert(uploadSession).values({
    id: sessionId,
    tenantId: TENANT,
    clientId: CLIENT,
    createdByStaffId: STAFF,
    accountingPeriod: PERIOD,
    tokenHash: 'hash-1',
    expiresAt: ts,
    requestKind: 'payroll',
    createdAt: ts,
  })
  await testDb.insert(uploadFile).values({
    id: 'file-1',
    uploadSessionId: sessionId,
    tenantId: TENANT,
    originalFilename: '급여대장.xlsx',
    storageKey: 'blob/file-1',
    fileType: 'excel',
    fileSize: 1024,
    contentHash: 'c-1',
    uploadedAt: ts,
  })
  return sessionId
}

function mealRuleProfile(): ClientPayrollRuleProfileV1 {
  return {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: CLIENT,
    effectiveFrom: PERIOD,
    sourcePriority: ['rule_document', 'statutory_default'],
    allowanceRules: [
      {
        sourceRuleId: 'r1',
        displayName: '식대',
        category: 'allowance',
        targetField: 'meal_allowance',
        formulaKind: 'fixed_amount',
        formulaJson: { amount: 200000, nonTaxableLimit: 200000 },
        taxableTreatment: 'non_taxable',
        requiredInputs: [],
        sourceCitations: [{ sourceType: 'rule_document', reference: '임금규정 p.3' }],
        status: 'ready',
      },
    ],
    deductionRules: [],
    taxabilityRules: [],
    statutoryFallbacks: [],
    requiredInputs: [],
    conflictItems: [],
    approvalChecklist: {
      sourcesReviewed: true,
      mappingReviewed: true,
      formulasReviewed: true,
      statutoryReviewed: true,
    },
  }
}

async function seedActiveMealProfile(): Promise<void> {
  const ts = toDBString(now())
  await testDb.insert(clientPayrollRuleProfile).values({
    id: 'profile-1',
    tenantId: TENANT,
    clientId: CLIENT,
    status: 'active',
    version: 1,
    effectiveFrom: PERIOD,
    effectiveTo: null,
    profileJson: JSON.stringify(mealRuleProfile()),
    sourceSummaryJson: JSON.stringify({ sources: [] }),
    createdByStaffId: STAFF,
    createdAt: ts,
    updatedAt: ts,
  })
}

function aiRows(rows: PayrollExtractedRow[]) {
  vi.mocked(extractPayrollWithProviderFallbackInBatches).mockResolvedValue({
    success: true,
    data: { rows, warnings: [] },
  } as unknown as Awaited<ReturnType<typeof extractPayrollWithProviderFallbackInBatches>>)
}

const employee = (overrides: Partial<PayrollExtractedRow>): PayrollExtractedRow => ({
  confidence: 'high',
  aiVerdict: 'pass',
  ...overrides,
})

async function storedRows(batchId: string) {
  return testDb
    .select()
    .from(payrollExtractionRow)
    .where(and(eq(payrollExtractionRow.batchId, batchId), eq(payrollExtractionRow.tenantId, TENANT)))
}

describe('executePayrollExtraction × 급여기준 프로필 (Slice 7 e2e)', () => {
  it('승인 프로필이 있으면 빈 F~T(식대)를 규정대로 채우고 적용 스냅샷을 저장한다', async () => {
    const sessionId = await seedPayrollSession()
    await seedActiveMealProfile()
    aiRows([
      employee({ employeeCode: 'E1', employeeName: '김OO', baseSalary: 3000000 }),
      employee({ employeeCode: 'E2', employeeName: '이OO', baseSalary: 3200000 }),
    ])

    const result = await executePayrollExtraction({ sessionId, tenantId: TENANT, createdByStaffId: STAFF })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.rowCount).toBe(2)

    const rows = (await storedRows(result.batchId)).sort((a, b) =>
      (a.employeeCode ?? '').localeCompare(b.employeeCode ?? ''),
    )
    expect(rows.map((r) => r.mealAllowance)).toEqual([200000, 200000])
    expect(rows.every((r) => r.aiVerdict === 'pass')).toBe(true)

    const batch = (await testDb.select().from(payrollExtractionBatch).where(eq(payrollExtractionBatch.id, result.batchId)))[0]
    expect(batch.status).toBe('completed')

    const applications = await testDb
      .select()
      .from(payrollRuleProfileApplication)
      .where(eq(payrollRuleProfileApplication.batchId, result.batchId))
    expect(applications).toHaveLength(1)
    expect(applications[0].profileId).toBe('profile-1')
    expect(applications[0].profileVersion).toBe(1)
    expect(applications[0].snapshotJson.length).toBeGreaterThan(0)
  })

  it('승인 프로필이 없으면 데이터 그대로 완료한다 — 채우지 않고, 스냅샷도 만들지 않으며, fail 강등도 없다', async () => {
    const sessionId = await seedPayrollSession()
    // 프로필 미생성: "사내지급기준 없음"
    aiRows([
      employee({ employeeCode: 'E1', employeeName: '김OO', baseSalary: 3000000 }),
      employee({ employeeCode: 'E2', employeeName: '이OO', baseSalary: 3200000 }),
    ])

    const result = await executePayrollExtraction({ sessionId, tenantId: TENANT, createdByStaffId: STAFF })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.rowCount).toBe(2)

    const rows = await storedRows(result.batchId)
    expect(rows.every((r) => r.mealAllowance === null)).toBe(true)
    // 규칙 부재 자체가 검토 사유가 되어선 안 된다(묻지 않는다).
    expect(rows.every((r) => r.aiVerdict === 'pass')).toBe(true)

    const applications = await testDb.select().from(payrollRuleProfileApplication)
    expect(applications).toHaveLength(0)
  })

  it('업로드 금액이 규정과 충돌하면 해당 행만 fail로 강등하고(안전 게이트) 빈 행은 규정대로 채운다', async () => {
    const sessionId = await seedPayrollSession()
    await seedActiveMealProfile()
    aiRows([
      // 규정 200,000과 다른 값이 이미 들어옴 → 충돌
      employee({ employeeCode: 'E1', employeeName: '김OO', baseSalary: 3000000, mealAllowance: 150000 }),
      // 빈 값 → 규정대로 채움
      employee({ employeeCode: 'E2', employeeName: '이OO', baseSalary: 3200000 }),
    ])

    const result = await executePayrollExtraction({ sessionId, tenantId: TENANT, createdByStaffId: STAFF })

    expect(result.success).toBe(true)
    if (!result.success) return

    const rows = (await storedRows(result.batchId)).sort((a, b) =>
      (a.employeeCode ?? '').localeCompare(b.employeeCode ?? ''),
    )
    const e1 = rows.find((r) => r.employeeCode === 'E1')!
    const e2 = rows.find((r) => r.employeeCode === 'E2')!

    // 충돌 행: 업로드 값 보존 + fail 강등
    expect(e1.mealAllowance).toBe(150000)
    expect(e1.aiVerdict).toBe('fail')
    expect(e1.aiVerdictReason ?? '').toContain('승인된 급여기준')

    // 빈 행: 규정대로 채움 + pass
    expect(e2.mealAllowance).toBe(200000)
    expect(e2.aiVerdict).toBe('pass')

    // 규정을 실제 적용했으므로 스냅샷은 저장된다.
    const applications = await testDb.select().from(payrollRuleProfileApplication)
    expect(applications).toHaveLength(1)
  })
})

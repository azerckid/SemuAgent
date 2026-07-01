import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import { PAYROLL_UPLOAD_BASELINE_ITEMS, PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME } from '@/lib/payroll/upload-checklist-baseline'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE tenant (
      id text PRIMARY KEY,
      name text NOT NULL,
      subdomain text NOT NULL,
      plan text NOT NULL DEFAULT 'free',
      timezone text NOT NULL DEFAULT 'Asia/Seoul',
      reminder_days_before integer NOT NULL DEFAULT 7,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE staff (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'STAFF',
      phone text,
      active integer NOT NULL DEFAULT 1,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      staff_id text,
      email text NOT NULL,
      contact_name text,
      name text NOT NULL,
      address text,
      phone text,
      analysis_notes text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      created_by_staff_id text NOT NULL,
      accounting_period text NOT NULL,
      bookkeeping_period_type text,
      bookkeeping_period_start text,
      bookkeeping_period_end text,
      token_hash text NOT NULL UNIQUE,
      upload_url text,
      expires_at text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      analysis_notes text,
      session_evaluation text,
      request_email_subject text,
      request_email_body text,
      request_email_cc text,
      extracted_criteria text,
      additional_criteria text,
      last_accessed_at text,
      request_event_id text,
      request_kind text NOT NULL DEFAULT 'general',
      source text NOT NULL DEFAULT 'customer_upload',
      staff_direct_label text,
      deleted_at text,
      deleted_by_staff_id text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE checklist_template (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      description text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE checklist_item (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      template_id text NOT NULL,
      name text NOT NULL,
      description text,
      required integer NOT NULL DEFAULT 1,
      analysis_rules text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE client_checklist (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      template_id text NOT NULL,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE request_template (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text,
      checklist_template_id text,
      name text NOT NULL,
      work_type text,
      frequency text NOT NULL,
      request_items text,
      email_subject_template text NOT NULL,
      email_body_template text NOT NULL,
      analysis_criteria_template text,
      due_rule text,
      send_rule text,
      send_policy text NOT NULL DEFAULT 'approval_required',
      is_default_for_work_type integer NOT NULL DEFAULT 0,
      is_active integer NOT NULL DEFAULT 1,
      created_by_staff_id text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE upload_file (
      id text PRIMARY KEY,
      upload_session_id text NOT NULL,
      tenant_id text NOT NULL,
      original_filename text NOT NULL,
      storage_key text NOT NULL,
      file_type text NOT NULL,
      file_size integer NOT NULL,
      content_hash text NOT NULL,
      status text NOT NULL DEFAULT 'uploaded',
      password_status text NOT NULL DEFAULT 'none',
      password_last_submitted_at text,
      password_attempt_count integer NOT NULL DEFAULT 0,
      staff_review_status text NOT NULL DEFAULT 'none',
      staff_review_note text,
      staff_reviewed_by_staff_id text,
      staff_reviewed_at text,
      uploaded_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE request_item_validation (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      request_event_id text,
      item_name text NOT NULL,
      item_group text,
      criterion_type text,
      requiredness text NOT NULL DEFAULT 'required',
      condition_text text,
      period_start text,
      period_end text,
      validation_status text NOT NULL DEFAULT 'uncertain',
      review_status text NOT NULL DEFAULT 'ai_suggested',
      ai_reasoning text,
      requested_action text,
      staff_note text,
      reviewed_by_staff_id text,
      reviewed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  for (const table of [
    'request_item_validation',
    'upload_file',
    'client_checklist',
    'checklist_item',
    'checklist_template',
    'request_template',
    'upload_session',
    'client',
    'staff',
    'tenant',
  ]) {
    await client.execute(`DELETE FROM ${table}`)
  }

  await testDb.insert(appSchema.tenant).values({
    id: 'tenant-1',
    name: '춘심회계법인',
    subdomain: 'chunsim',
    plan: 'free',
    timezone: 'Asia/Seoul',
    reminderDaysBefore: 7,
    createdAt: '2026-06-26T00:00:00.000+09:00',
  })
  await testDb.insert(appSchema.staff).values({
    id: 'staff-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'staff@example.com',
    name: '춘심이',
    role: 'STAFF',
    phone: null,
    active: true,
    createdAt: '2026-06-26T00:00:00.000+09:00',
  })
  await testDb.insert(appSchema.client).values({
    id: 'client-1',
    tenantId: 'tenant-1',
    staffId: 'staff-1',
    email: 'client@example.com',
    contactName: null,
    name: '솔메이트',
    address: null,
    phone: null,
    analysisNotes: null,
    createdAt: '2026-06-26T00:00:00.000+09:00',
  })
})

async function seedUploadSession(params: { id: string; requestKind?: 'general' | 'payroll' }) {
  await testDb.insert(appSchema.uploadSession).values({
    id: params.id,
    tenantId: 'tenant-1',
    clientId: 'client-1',
    createdByStaffId: 'staff-1',
    accountingPeriod: '2026-06',
    bookkeepingPeriodType: 'monthly',
    bookkeepingPeriodStart: '2026-06',
    bookkeepingPeriodEnd: '2026-06',
    tokenHash: `token-${params.id}`,
    uploadUrl: null,
    expiresAt: '2026-06-30T23:59:59.000+09:00',
    status: 'active',
    analysisNotes: null,
    sessionEvaluation: null,
    requestEmailSubject: '2026년 6월 기장 자료 요청',
    requestEmailBody: '기장 자료를 제출해 주세요.',
    requestEmailCc: null,
    extractedCriteria: null,
    additionalCriteria: null,
    lastAccessedAt: null,
    requestEventId: null,
    requestKind: params.requestKind ?? 'general',
    source: 'customer_upload',
    staffDirectLabel: null,
    deletedAt: null,
    deletedByStaffId: null,
    createdAt: '2026-06-26T00:00:00.000+09:00',
  })
}

describe('getPortalData', () => {
  it('고객사 체크리스트가 비어 있으면 기장 기본 필요자료를 실제 체크리스트로 배정한다', async () => {
    const { getPortalData } = await import('./session')
    await seedUploadSession({ id: 'session-1' })

    const data = await getPortalData('session-1', 'tenant-1')

    expect(data?.checklistItems.map((item) => item.name)).toEqual([
      '통장 거래내역',
      '카드 사용내역',
      '매출 세금계산서',
      '매입 세금계산서',
      '현금영수증',
      '온라인 매출/PG 정산자료',
      '전표·입출금 정리',
      '기타 증빙자료',
    ])
    expect(data?.checklistItems.every((item) => !item.id.startsWith('validation:'))).toBe(true)

    const assignments = await testDb.select().from(appSchema.clientChecklist)
    const items = await testDb.select().from(appSchema.checklistItem)
    expect(assignments).toHaveLength(1)
    expect(items).toHaveLength(8)
  })

  it('급여 요청은 고객사 기장 체크리스트 대신 급여정산 업로드 기준을 표시한다', async () => {
    const { getPortalData } = await import('./session')
    await seedUploadSession({ id: 'session-payroll', requestKind: 'payroll' })
    await testDb.insert(appSchema.checklistTemplate).values({
      id: 'template-bookkeeping',
      tenantId: 'tenant-1',
      name: '기장 자료 기준 샘플',
      description: null,
      createdAt: '2026-06-26T00:00:00.000+09:00',
    })
    await testDb.insert(appSchema.checklistItem).values({
      id: 'item-bookkeeping-bank',
      tenantId: 'tenant-1',
      templateId: 'template-bookkeeping',
      name: '통장 거래내역',
      description: null,
      required: true,
      analysisRules: null,
      sortOrder: 10,
      createdAt: '2026-06-26T00:00:00.000+09:00',
    })
    await testDb.insert(appSchema.clientChecklist).values({
      id: 'client-checklist-bookkeeping',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      templateId: 'template-bookkeeping',
      createdAt: '2026-06-26T00:00:00.000+09:00',
    })

    const data = await getPortalData('session-payroll', 'tenant-1')

    expect(data?.checklistItems.map((item) => item.name)).toEqual(
      PAYROLL_UPLOAD_BASELINE_ITEMS.map((item) => item.name),
    )
    const assignments = await testDb.select().from(appSchema.clientChecklist)
    expect(assignments).toHaveLength(1)
    expect(assignments[0].templateId).toBe('template-bookkeeping')

    const payrollTemplates = await testDb
      .select()
      .from(appSchema.checklistTemplate)
      .where(eq(appSchema.checklistTemplate.name, PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME))
    expect(payrollTemplates).toHaveLength(1)
  })

  it('기본 request template에 연결된 체크리스트가 있으면 그 기준을 배정한다', async () => {
    const { getPortalData } = await import('./session')
    await seedUploadSession({ id: 'session-template' })
    await testDb.insert(appSchema.checklistTemplate).values({
      id: 'template-custom',
      tenantId: 'tenant-1',
      name: '커스텀 기장 기준',
      description: null,
      createdAt: '2026-06-26T00:00:00.000+09:00',
    })
    await testDb.insert(appSchema.checklistItem).values({
      id: 'item-custom-bank',
      tenantId: 'tenant-1',
      templateId: 'template-custom',
      name: '커스텀 통장 자료',
      description: null,
      required: true,
      analysisRules: null,
      sortOrder: 10,
      createdAt: '2026-06-26T00:00:00.000+09:00',
    })
    await testDb.insert(appSchema.requestTemplate).values({
      id: 'request-template-1',
      tenantId: 'tenant-1',
      clientId: null,
      checklistTemplateId: 'template-custom',
      name: '기본 기장 요청',
      workType: 'bookkeeping',
      frequency: 'monthly',
      requestItems: null,
      emailSubjectTemplate: '',
      emailBodyTemplate: '',
      analysisCriteriaTemplate: null,
      dueRule: null,
      sendRule: null,
      sendPolicy: 'approval_required',
      isDefaultForWorkType: true,
      isActive: true,
      createdByStaffId: 'staff-1',
      createdAt: '2026-06-26T00:00:00.000+09:00',
      updatedAt: '2026-06-26T00:00:00.000+09:00',
    })

    const data = await getPortalData('session-template', 'tenant-1')

    expect(data?.checklistItems.map((item) => item.name)).toEqual(['커스텀 통장 자료'])
    const assignments = await testDb
      .select()
      .from(appSchema.clientChecklist)
      .where(eq(appSchema.clientChecklist.templateId, 'template-custom'))
    expect(assignments).toHaveLength(1)
  })
})

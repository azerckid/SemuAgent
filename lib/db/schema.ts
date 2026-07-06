import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// tenant  (Better Auth organization 과 1:1 대응. id = organization.id)
// ---------------------------------------------------------------------------
export const tenant = sqliteTable('tenant', {
  // id는 Better Auth organization.id 와 동일하게 설정됨 (앱 레이어에서 보장)
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  plan: text('plan', { enum: ['free', 'starter', 'pro'] }).notNull().default('free'),
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(7),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// staff  (Better Auth user + member 와 연동. user_id = user.id)
// 한 사용자가 여러 organization에 속할 수 있으므로 userId 단독 unique는 사용하지 않음.
// (tenantId, userId) 복합 유니크로 테넌트 범위 내 중복만 방지.
// ---------------------------------------------------------------------------
export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  // Better Auth user.id — FK는 앱 레이어에서 보장 (auth-schema 교차 참조 방지)
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  // Better Auth member.role 과 동기화: owner → TENANT_ADMIN, member → STAFF
  role: text('role', { enum: ['TENANT_ADMIN', 'STAFF'] }).notNull().default('STAFF'),
  phone: text('phone'),
  // false: 비활성화 처리 (계정 삭제 아님, 배정된 클라이언트는 유지)
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('staff_userId_tenantId_uidx').on(table.userId, table.tenantId),
])

// ---------------------------------------------------------------------------
// billing_plan  (가격 정책 스냅샷/향후 운영자 관리용)
// 현재 UI는 코드 상수 기준으로 렌더링하고, 이 테이블은 결제 이력의 기준값 보존을 위해 둔다.
// ---------------------------------------------------------------------------
export const billingPlan = sqliteTable('billing_plan', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  maxClients: integer('max_clients'),
  monthlyPriceKrw: integer('monthly_price_krw'),
  currency: text('currency').notNull().default('KRW'),
  vatIncluded: integer('vat_included', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// billing_customer  (PG 고객 식별자 + 서버 전용 빌링키 보관)
// provider_customer_key는 Toss customerKey이며, 유추 불가능한 랜덤 값만 사용한다.
// provider_billing_key는 클라이언트로 절대 반환하지 않는다.
// ---------------------------------------------------------------------------
export const billingCustomer = sqliteTable('billing_customer', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  provider: text('provider', { enum: ['toss_payments'] }).notNull(),
  providerCustomerKey: text('provider_customer_key').notNull(),
  providerBillingKey: text('provider_billing_key'),
  billingEmail: text('billing_email'),
  billingName: text('billing_name'),
  methodType: text('method_type', { enum: ['card', 'account_transfer'] }).notNull().default('card'),
  paymentMethodSnapshot: text('payment_method_snapshot'),
  billingKeyIssuedAt: text('billing_key_issued_at'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('billing_customer_tenant_provider_uidx').on(table.tenantId, table.provider),
  uniqueIndex('billing_customer_provider_key_uidx').on(table.providerCustomerKey),
])

// ---------------------------------------------------------------------------
// tenant_billing_profile  (수동 세금계산서/파일럿 청구 정보)
// PG 빌링키와 분리된 테넌트 청구 주체 정보다. 자동 과금 실행에는 사용하지 않는다.
// ---------------------------------------------------------------------------
export const tenantBillingProfile = sqliteTable('tenant_billing_profile', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  businessRegistrationNumber: text('business_registration_number').notNull(),
  businessName: text('business_name').notNull(),
  representativeName: text('representative_name').notNull(),
  businessAddress: text('business_address').notNull(),
  businessType: text('business_type'),
  businessItem: text('business_item'),
  taxInvoiceEmail: text('tax_invoice_email').notNull(),
  billingContactName: text('billing_contact_name').notNull(),
  billingContactPhone: text('billing_contact_phone').notNull(),
  memo: text('memo'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  updatedByStaffId: text('updated_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('tenant_billing_profile_tenant_uidx').on(table.tenantId),
])

// ---------------------------------------------------------------------------
// tenant_subscription  (테넌트 현재 구독 상태)
// 서비스 차단은 아직 적용하지 않고, 결제 준비/상태 표시와 후속 자동결제 기준만 저장한다.
// ---------------------------------------------------------------------------
export const tenantSubscription = sqliteTable('tenant_subscription', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  planCode: text('plan_code', {
    enum: ['starter', 'growth', 'pro', 'enterprise', 'pilot'],
  }).notNull(),
  status: text('status', {
    enum: ['manual_pilot', 'pending_payment', 'active', 'past_due', 'canceled'],
  }).notNull().default('pending_payment'),
  contractType: text('contract_type', {
    enum: ['manual_pilot', 'manual_invoice', 'provider_auto_billing'],
  }).notNull(),
  provider: text('provider', { enum: ['toss_payments', 'manual'] }).notNull(),
  billingCustomerId: text('billing_customer_id').references(() => billingCustomer.id),
  billingOwnerStaffId: text('billing_owner_staff_id').references(() => staff.id),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  nextBillingAt: text('next_billing_at'),
  cancelAt: text('cancel_at'),
  canceledAt: text('canceled_at'),
  providerSubscriptionId: text('provider_subscription_id'),
  providerPaymentMethodId: text('provider_payment_method_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('tenant_subscription_tenant_uidx').on(table.tenantId),
  index('tenant_subscription_status_idx').on(table.status),
])

// ---------------------------------------------------------------------------
// billing_invoice_event  (결제 감사 로그)
// provider_payload는 Toss 원문 전체가 아니라 결제 식별자/카드사 등 최소 스냅샷만 저장한다.
// ---------------------------------------------------------------------------
export const billingInvoiceEvent = sqliteTable('billing_invoice_event', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  subscriptionId: text('subscription_id').references(() => tenantSubscription.id),
  billingCustomerId: text('billing_customer_id').references(() => billingCustomer.id),
  provider: text('provider', { enum: ['toss_payments', 'manual'] }).notNull(),
  eventType: text('event_type', {
    enum: [
      'setup_started',
      'billing_key_issued',
      'charge_scheduled',
      'charge_succeeded',
      'charge_failed',
      'subscription_updated',
      'setup_failed',
      'payment_status_changed',
      'payment_canceled',
      'payment_partially_canceled',
      'billing_key_deleted',
    ],
  }).notNull(),
  status: text('status', { enum: ['pending', 'succeeded', 'failed', 'skipped'] }).notNull(),
  orderId: text('order_id'),
  amountKrw: integer('amount_krw'),
  currency: text('currency').notNull().default('KRW'),
  paymentKey: text('payment_key'),
  providerEventId: text('provider_event_id'),
  providerCode: text('provider_code'),
  providerMessage: text('provider_message'),
  providerPayload: text('provider_payload'),
  idempotencyKey: text('idempotency_key'),
  occurredAt: text('occurred_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('billing_invoice_event_tenant_idx').on(table.tenantId, table.occurredAt),
  index('billing_invoice_event_subscription_idx').on(table.subscriptionId, table.occurredAt),
])

// ---------------------------------------------------------------------------
// billing_webhook_event  (Toss 웹훅 수신/처리 idempotency 감사 로그)
// provider_payload는 웹훅 원문 전체가 아니라 eventType, 결제 식별자, 상태 등 최소 스냅샷만 저장한다.
// ---------------------------------------------------------------------------
export const billingWebhookEvent = sqliteTable('billing_webhook_event', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['toss_payments'] }).notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  eventType: text('event_type').notNull(),
  status: text('status', {
    enum: ['received', 'processed', 'skipped', 'failed'],
  }).notNull().default('received'),
  tenantId: text('tenant_id').references(() => tenant.id),
  subscriptionId: text('subscription_id').references(() => tenantSubscription.id),
  billingCustomerId: text('billing_customer_id').references(() => billingCustomer.id),
  providerEventId: text('provider_event_id'),
  transmissionId: text('transmission_id'),
  transmissionTime: text('transmission_time'),
  retriedCount: integer('retried_count'),
  providerCode: text('provider_code'),
  providerMessage: text('provider_message'),
  providerPayload: text('provider_payload'),
  receivedAt: text('received_at').notNull(),
  processedAt: text('processed_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('billing_webhook_event_idempotency_uidx').on(table.idempotencyKey),
  index('billing_webhook_event_status_idx').on(table.status, table.receivedAt),
  index('billing_webhook_event_tenant_idx').on(table.tenantId, table.receivedAt),
])

// ---------------------------------------------------------------------------
// client
// ---------------------------------------------------------------------------
export const client = sqliteTable('client', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  staffId: text('staff_id').references(() => staff.id),
  email: text('email').notNull(),
  contactName: text('contact_name'),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  // 회사별 AI 분석 기준 (프롬프트형 자유 텍스트). 변경 시 과거 분석에는 미적용.
  analysisNotes: text('analysis_notes'),
  // 사업자 유형(개인/법인/면세). 신고 준비 허브(JC-029) dimming의 실데이터 소스.
  // null = 미지정 → 흐림 없음(전체 트랙 표시).
  taxEntityType: text('tax_entity_type', { enum: ['individual', 'corporation', 'tax_exempt'] }),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('client_tenant_email_uidx').on(table.tenantId, sql`lower(${table.email})`),
])

// ---------------------------------------------------------------------------
// client_document  (사업자등록증·통장사본 등 고객사 보관 문서. 직원이 직접
// 업로드한다 — 클라이언트 업로드 포털과 무관한 내부 보관 용도.)
// ---------------------------------------------------------------------------
export const clientDocument = sqliteTable('client_document', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  documentType: text('document_type').notNull(), // 자유 텍스트: 사업자등록증/통장사본/기타
  originalFilename: text('original_filename').notNull(),
  storageKey: text('storage_key').notNull(), // Vercel Blob private URL
  contentType: text('content_type').notNull(),
  fileSize: integer('file_size').notNull(),
  contentHash: text('content_hash').notNull(),
  uploadedByStaffId: text('uploaded_by_staff_id').notNull().references(() => staff.id),
  memo: text('memo'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('client_document_client_idx').on(table.tenantId, table.clientId),
])

// ---------------------------------------------------------------------------
// client_cc_group  (고객사별 요청 메일 참조 그룹)
// ---------------------------------------------------------------------------
export const clientCcGroup = sqliteTable('client_cc_group', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  name: text('name').notNull(),
  purpose: text('purpose', { enum: ['general', 'payroll', 'all'] }).notNull().default('general'),
  emails: text('emails').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('client_cc_group_client_idx').on(table.tenantId, table.clientId),
  uniqueIndex('client_cc_group_name_uidx').on(table.tenantId, table.clientId, sql`lower(${table.name})`),
])

// ---------------------------------------------------------------------------
// internal_cc_group  (회계사무실 내부 요청 메일 참조 그룹)
// ---------------------------------------------------------------------------
export const internalCcGroup = sqliteTable('internal_cc_group', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  name: text('name').notNull(),
  purpose: text('purpose', { enum: ['general', 'payroll', 'all'] }).notNull().default('general'),
  emails: text('emails').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('internal_cc_group_tenant_idx').on(table.tenantId),
  uniqueIndex('internal_cc_group_name_uidx').on(table.tenantId, sql`lower(${table.name})`),
])

// ---------------------------------------------------------------------------
// checklist_template
// ---------------------------------------------------------------------------
export const checklistTemplate = sqliteTable('checklist_template', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// checklist_item
// ---------------------------------------------------------------------------
export const checklistItem = sqliteTable('checklist_item', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  templateId: text('template_id')
    .notNull()
    .references(() => checklistTemplate.id),
  name: text('name').notNull(),
  description: text('description'),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  // v1.1 이후 구조화 규칙 추가 예정
  analysisRules: text('analysis_rules'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// client_checklist  (특정 클라이언트에 배정된 체크리스트)
// ---------------------------------------------------------------------------
export const clientChecklist = sqliteTable('client_checklist', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  templateId: text('template_id')
    .notNull()
    .references(() => checklistTemplate.id),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// request_template  (테넌트·고객사별 재사용 요청 템플릿)
// client_id = null 이면 테넌트 공통 템플릿
// ---------------------------------------------------------------------------
export const requestTemplate = sqliteTable('request_template', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id').references(() => client.id),
  checklistTemplateId: text('checklist_template_id').references(() => checklistTemplate.id),
  name: text('name').notNull(),
  workType: text('work_type', {
    enum: ['bookkeeping', 'payroll', 'vat'],
  }),
  frequency: text('frequency', {
    enum: ['monthly', 'quarterly', 'semiannual', 'annual', 'custom'],
  }).notNull(),
  requestItems: text('request_items'),             // JSON: RequestItem[]
  emailSubjectTemplate: text('email_subject_template').notNull(),
  emailBodyTemplate: text('email_body_template').notNull(),
  analysisCriteriaTemplate: text('analysis_criteria_template'),
  dueRule: text('due_rule'),                       // JSON: DueRule
  sendRule: text('send_rule'),                     // JSON: SendRule — 자동 발송 날짜 규칙
  sendPolicy: text('send_policy', {
    enum: ['approval_required', 'scheduled_draft', 'auto_send_candidate'],
  }).notNull().default('approval_required'),
  isDefaultForWorkType: integer('is_default_for_work_type', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdByStaffId: text('created_by_staff_id')
    .notNull()
    .references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// client_request_schedule  (고객사에 적용된 반복 요청 설정)
// ---------------------------------------------------------------------------
export const clientRequestSchedule = sqliteTable('client_request_schedule', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  requestTemplateId: text('request_template_id').references(() => requestTemplate.id),
  frequency: text('frequency', {
    enum: ['monthly', 'quarterly', 'semiannual', 'annual'],
  }).notNull(),
  startsOn: text('starts_on').notNull(),   // YYYY-MM-DD
  endsOn: text('ends_on'),                 // YYYY-MM-DD nullable
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  generationPolicy: text('generation_policy', {
    enum: ['manual', 'auto_generate_draft'],
  }).notNull().default('manual'),
  sendPolicy: text('send_policy', {
    enum: ['approval_required', 'scheduled_draft', 'auto_send_candidate'],
  }).notNull().default('approval_required'),
  dueRule: text('due_rule'),    // JSON: DueRule — 제출 기한 계산 규칙
  sendRule: text('send_rule'),  // JSON: SendRule — Cron 자동 발송 날짜 규칙
  // 스냅샷 — 스케줄에서 직접 메일 초안을 지정할 때 사용 (템플릿 없이 간편 설정)
  emailSubjectTemplate: text('email_subject_template'),
  emailBodyTemplate: text('email_body_template'),
  emailGreetingTemplate: text('email_greeting_template'),
  senderPhoneTemplate: text('sender_phone_template'),
  ccEmailTemplate: text('cc_email_template'),
  analysisCriteriaTemplate: text('analysis_criteria_template'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  deletedAt: text('deleted_at'),
  deletedByStaffId: text('deleted_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// upload_session
// ---------------------------------------------------------------------------
export const uploadSession = sqliteTable('upload_session', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  createdByStaffId: text('created_by_staff_id')
    .notNull()
    .references(() => staff.id),
  accountingPeriod: text('accounting_period').notNull(), // e.g. '2026-05'
  bookkeepingPeriodType: text('bookkeeping_period_type', { enum: ['monthly', 'quarterly', 'yearly'] }),
  bookkeepingPeriodStart: text('bookkeeping_period_start'), // inclusive YYYY-MM
  bookkeepingPeriodEnd: text('bookkeeping_period_end'), // inclusive YYYY-MM
  // raw_token을 단독으로 저장하지 않음. DB에는 SHA-256 해시만 저장.
  // upload_url은 raw_token을 포함하지만 Cron·누락요청 재발송에 필요하므로 이 컬럼에 한해 허용.
  tokenHash: text('token_hash').notNull().unique(),
  uploadUrl: text('upload_url'),
  expiresAt: text('expires_at').notNull(), // ISO 8601, Asia/Seoul
  status: text('status', {
    enum: ['draft', 'requested', 'active', 'submitted', 'ai_checking', 'needs_resubmission', 'ready_for_accountant', 'completed', 'expired', 'revoked'],
  })
    .notNull()
    .default('draft'),
  // 세션별 임시 AI 분석 기준 (client.analysis_notes를 덮거나 보완)
  analysisNotes: text('analysis_notes'),
  // AI 선검증 결과 (JSON). criterion 단위 구조화 평가 결과를 저장한다.
  sessionEvaluation: text('session_evaluation'),
  // 클라이언트에게 실제 발송한 자료 요청 메일 제목과 본문.
  // 향후 AI 선검증의 기준 원문으로 사용한다.
  requestEmailSubject: text('request_email_subject'),
  requestEmailBody: text('request_email_body'),
  requestEmailCc: text('request_email_cc'),
  // 요청 메일 본문에서 추출한 AI 검토 기준과 담당자가 별도로 추가한 내부 기준.
  extractedCriteria: text('extracted_criteria'),
  additionalCriteria: text('additional_criteria'),
  lastAccessedAt: text('last_accessed_at'),
  // client_request_event 와의 연결. 순환 참조 방지를 위해 FK 제약 없이 앱 레이어에서 보장.
  requestEventId: text('request_event_id'),
  requestKind: text('request_kind', { enum: ['general', 'payroll'] }).notNull().default('general'),
  source: text('source', { enum: ['customer_upload', 'staff_direct'] }).notNull().default('customer_upload'),
  // 세션 표시명. 기존 컬럼명은 staff_direct_label이지만, 고객 메일 업로드와 담당자 직접 업로드
  // 양쪽 모두 생성 시점에 고정한 표시명을 저장해 화면마다 다시 계산하지 않게 한다.
  staffDirectLabel: text('staff_direct_label'),
  deletedAt: text('deleted_at'),
  deletedByStaffId: text('deleted_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// source_batch
// SemuAgent 내부 source lineage 모델. JC-031 Slice 3a에서는 upload_session과
// dual-write/backfill로 병행하고, Slice 4 전까지 upload_session compatibility를 유지한다.
// ---------------------------------------------------------------------------
export const sourceBatch = sqliteTable('source_batch', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  createdByStaffId: text('created_by_staff_id')
    .notNull()
    .references(() => staff.id),
  sourceKind: text('source_kind', {
    enum: ['staff_direct', 'customer_upload', 'legacy_upload_session', 'sample_data'],
  })
    .notNull()
    .default('staff_direct'),
  accountingPeriod: text('accounting_period').notNull(),
  bookkeepingPeriodType: text('bookkeeping_period_type', { enum: ['monthly', 'quarterly', 'yearly'] }),
  bookkeepingPeriodStart: text('bookkeeping_period_start'),
  bookkeepingPeriodEnd: text('bookkeeping_period_end'),
  displayLabel: text('display_label'),
  legacyUploadSessionId: text('legacy_upload_session_id').references(() => uploadSession.id),
  deletedAt: text('deleted_at'),
  deletedByStaffId: text('deleted_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('source_batch_legacy_upload_session_uidx').on(table.legacyUploadSessionId),
  index('source_batch_tenant_client_period_idx').on(table.tenantId, table.clientId, table.accountingPeriod),
  index('source_batch_tenant_created_idx').on(table.tenantId, table.createdAt),
])

// ---------------------------------------------------------------------------
// upload_file
// ---------------------------------------------------------------------------
export const uploadFile = sqliteTable('upload_file', {
  id: text('id').primaryKey(),
  uploadSessionId: text('upload_session_id')
    .notNull()
    .references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  // tenant_id 비정규화 — 조회 효율
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  originalFilename: text('original_filename').notNull(),
  storageKey: text('storage_key').notNull(), // Vercel Blob URL or key
  fileType: text('file_type', { enum: ['pdf', 'excel', 'image', 'other'] }).notNull(),
  fileSize: integer('file_size').notNull(),
  // SHA-256 of file content — 감사 로그 및 중복 감지
  contentHash: text('content_hash').notNull(),
  status: text('status', {
    enum: ['uploaded', 'analyzing', 'matched', 'needs_review', 'rejected', 'failed'],
  })
    .notNull()
    .default('uploaded'),
  // 비밀번호 보호 파일 상태. 'required'는 처리 실패가 아니라 "확인 필요" 신호다.
  // Slice 3-B: required→(비밀번호 입력)→consumed(복호화·분석 완료, 비밀번호는 폐기) / invalid(오답).
  // 비밀번호 값 자체는 어디에도 저장하지 않는다.
  passwordStatus: text('password_status', {
    enum: ['none', 'required', 'supplied', 'invalid', 'consumed', 'not_needed'],
  })
    .notNull()
    .default('none'),
  // 비밀번호가 제출된 마지막 시각(값은 저장하지 않고 시각만 추적).
  passwordLastSubmittedAt: text('password_last_submitted_at'),
  // 비밀번호 제출 시도 횟수(재시도 가시성·남용 방지용).
  passwordAttemptCount: integer('password_attempt_count').notNull().default(0),
  uploadedAt: text('uploaded_at').notNull(),
  // 담당자가 미연결·문제 파일을 자료 검토에서 제외 확인한 상태.
  staffReviewStatus: text('staff_review_status', {
    enum: ['none', 'excluded'],
  })
    .notNull()
    .default('none'),
  staffReviewNote: text('staff_review_note'),
  staffReviewedByStaffId: text('staff_reviewed_by_staff_id').references(() => staff.id),
  staffReviewedAt: text('staff_reviewed_at'),
}, (table) => [
  index('upload_file_source_batch_idx').on(table.tenantId, table.sourceBatchId),
])

// ---------------------------------------------------------------------------
// bookkeeping_material_attribution
// 기장 자료 충족 이후, 계정항목 정리 전에 업로드 자료의 귀속기간과 반영 결정을 기록한다.
// ---------------------------------------------------------------------------
export const bookkeepingMaterialAttribution = sqliteTable('bookkeeping_material_attribution', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  uploadFileId: text('upload_file_id').references(() => uploadFile.id),
  status: text('status', {
    enum: ['active', 'superseded'],
  }).notNull().default('active'),
  sourceKind: text('source_kind', {
    enum: ['file_summary', 'transaction_row'],
  }).notNull().default('file_summary'),
  sourceLabel: text('source_label').notNull(),
  evidenceDate: text('evidence_date'),             // YYYY-MM-DD when row-level evidence exists
  attributedPeriod: text('attributed_period'),     // YYYY-MM
  requestedPeriod: text('requested_period').notNull(), // upload_session.accounting_period snapshot
  closePeriod: text('close_period').notNull(),     // e.g. 2026-04~2026-06
  periodRelation: text('period_relation', {
    enum: ['requested', 'prior', 'future', 'unknown'],
  }).notNull().default('unknown'),
  amountKrw: integer('amount_krw'),
  counterparty: text('counterparty'),
  description: text('description'),
  duplicateStatus: text('duplicate_status', {
    enum: ['none', 'possible_duplicate'],
  }).notNull().default('none'),
  duplicateBasis: text('duplicate_basis'),
  recommendation: text('recommendation', {
    enum: ['include', 'hold', 'exclude_duplicate', 'reference_only'],
  }).notNull().default('include'),
  staffDecision: text('staff_decision', {
    enum: ['include', 'hold', 'exclude_duplicate', 'reference_only'],
  }),
  staffNote: text('staff_note'),
  decidedByStaffId: text('decided_by_staff_id').references(() => staff.id),
  decidedAt: text('decided_at'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  sessionIdx: index('bookkeeping_attr_session_idx').on(t.tenantId, t.uploadSessionId, t.status),
  sourceBatchIdx: index('bookkeeping_attr_source_batch_idx').on(t.tenantId, t.sourceBatchId),
  fileIdx: index('bookkeeping_attr_file_idx').on(t.tenantId, t.uploadFileId),
  periodIdx: index('bookkeeping_attr_period_idx').on(t.tenantId, t.attributedPeriod, t.periodRelation),
}))

// ---------------------------------------------------------------------------
// bookkeeping_fiscal_year_ledger
// 고객사 + 회계연도 단위의 누적 기장 장부 read model.
// 월별 업로드 세션은 이 장부에 반영될 입력 이벤트이며, 장부 자체는 연간 상태를 보존한다.
// ---------------------------------------------------------------------------
export const bookkeepingFiscalYearLedger = sqliteTable('bookkeeping_fiscal_year_ledger', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  fiscalYear: integer('fiscal_year').notNull(),
  status: text('status', {
    enum: ['open', 'needs_review', 'ready_for_close', 'closed', 'archived'],
  }).notNull().default('open'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  tenantClientYearUidx: uniqueIndex('bookkeeping_fiscal_ledger_tenant_client_year_uidx')
    .on(t.tenantId, t.clientId, t.fiscalYear),
  statusIdx: index('bookkeeping_fiscal_ledger_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_ledger_month
// 회계연도 장부 안의 12개월 상태 슬롯. 자료가 없는 달도 표시하기 위해 별도 row로 둔다.
// Slice 1 derives core progress statuses; decision/close states are later slices.
// ---------------------------------------------------------------------------
export const bookkeepingLedgerMonth = sqliteTable('bookkeeping_ledger_month', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  ledgerId: text('ledger_id').notNull().references(() => bookkeepingFiscalYearLedger.id),
  periodMonth: text('period_month').notNull(),
  status: text('status', {
    enum: [
      'not_requested',
      'requested',
      'material_received',
      'classification_needed',
      'journal_needed',
      'needs_decision',
      'journal_draft_ready',
      'month_ready',
      'closed_by_staff',
    ],
  }).notNull().default('not_requested'),
  lastUploadSessionId: text('last_upload_session_id').references(() => uploadSession.id),
  lastMaterialAttributionRunAt: text('last_material_attribution_run_at'),
  // 기존 classification/journal run은 아직 session-scoped라 FK 없이 id 스냅샷만 보존한다.
  lastClassificationRunId: text('last_classification_run_id'),
  lastJournalEntryRunId: text('last_journal_entry_run_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  tenantLedgerMonthUidx: uniqueIndex('bookkeeping_ledger_month_tenant_ledger_month_uidx')
    .on(t.tenantId, t.ledgerId, t.periodMonth),
  ledgerIdx: index('bookkeeping_ledger_month_ledger_idx').on(t.tenantId, t.ledgerId),
  statusIdx: index('bookkeeping_ledger_month_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_ledger_material_link
// 세션에서 포함 확정된 자료를 회계연도 ledger/month에 연결한 레코드.
// source_fingerprint로 같은 물리적 자료의 중복 반영을 막고, attribution이 재실행되거나
// 포함 결정이 바뀌면 기존 링크를 지우지 않고 superseded/stale로 남겨 감사 추적을 보존한다.
// ---------------------------------------------------------------------------
export const bookkeepingLedgerMaterialLink = sqliteTable('bookkeeping_ledger_material_link', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  ledgerId: text('ledger_id').notNull().references(() => bookkeepingFiscalYearLedger.id),
  periodMonth: text('period_month').notNull(),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  uploadFileId: text('upload_file_id').references(() => uploadFile.id),
  materialAttributionId: text('material_attribution_id').references(() => bookkeepingMaterialAttribution.id),
  sourceFingerprint: text('source_fingerprint').notNull(),
  status: text('status', {
    enum: ['included', 'superseded', 'excluded', 'stale'],
  }).notNull().default('included'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  // 동시 merge 호출이 같은 fingerprint로 included row를 두 번 만들지 못하도록
  // status='included'인 row에만 unique 제약을 둔다 (partial unique index).
  includedFingerprintUidx: uniqueIndex('bookkeeping_ledger_link_included_fingerprint_uidx')
    .on(t.tenantId, t.ledgerId, t.periodMonth, t.sourceFingerprint)
    .where(sql`status = 'included'`),
  sessionIdx: index('bookkeeping_ledger_link_session_idx').on(t.tenantId, t.uploadSessionId),
  sourceBatchIdx: index('bookkeeping_ledger_link_source_batch_idx').on(t.tenantId, t.sourceBatchId),
  attributionIdx: index('bookkeeping_ledger_link_attribution_idx').on(t.tenantId, t.materialAttributionId),
  statusIdx: index('bookkeeping_ledger_link_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// analysis_run  (모델별 분석 실행 이력)
// ---------------------------------------------------------------------------
export const analysisRun = sqliteTable('analysis_run', {
  id: text('id').primaryKey(),
  uploadFileId: text('upload_file_id')
    .notNull()
    .references(() => uploadFile.id),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  provider: text('provider', { enum: ['claude', 'openai', 'gemini'] }).notNull(),
  model: text('model').notNull(), // e.g. 'claude-sonnet-4-6'
  rawOutput: text('raw_output'),          // 모델 원본 응답 (JSON string)
  parsedOutput: text('parsed_output'),    // Zod 검증 통과 후 구조화 응답 (JSON string)
  confidence: text('confidence', {
    enum: ['high', 'medium', 'low', 'unknown'],
  }).notNull().default('unknown'),
  consensusGroup: text('consensus_group', {
    enum: ['high_confidence', 'medium_confidence', 'needs_review', 'failed'],
  }),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed'],
  })
    .notNull()
    .default('pending'),
  errorMessage: text('error_message'),
  // 분석 실행 시 적용된 기준 스냅샷 — 기준 수정 후에도 과거 근거 설명 가능
  appliedAnalysisNotes: text('applied_analysis_notes'),
  criteriaSummary: text('criteria_summary'),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// material_match  (파일 ↔ 체크리스트 항목 매칭 결과)
// ---------------------------------------------------------------------------
export const materialMatch = sqliteTable('material_match', {
  id: text('id').primaryKey(),
  uploadFileId: text('upload_file_id')
    .notNull()
    .references(() => uploadFile.id),
  checklistItemId: text('checklist_item_id')
    .notNull()
    .references(() => checklistItem.id),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  analysisRunId: text('analysis_run_id').references(() => analysisRun.id),
  status: text('status', {
    enum: ['matched', 'needs_review', 'rejected', 'manual_approved', 'manual_rejected'],
  }).notNull(),
  confidence: text('confidence', { enum: ['high', 'medium', 'low', 'unknown'] }).notNull(),
  explanation: text('explanation'), // AI 판단 근거 요약
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// request_item_validation  (요청 항목별 충족 상태)
// material_match는 파일↔체크리스트 항목 매칭, 이 테이블은 요청 항목 단위 충족 판단.
// 하나의 요청 항목에 여러 파일이 연결될 수 있으므로 파일 연결은 request_item_validation_file로 분리.
// ---------------------------------------------------------------------------
export const requestItemValidation = sqliteTable('request_item_validation', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  requestEventId: text('request_event_id').references(() => clientRequestEvent.id),
  itemName: text('item_name').notNull(),
  itemGroup: text('item_group'),                  // bank_statement, sales, purchase, payroll, ...
  criterionType: text('criterion_type', {
    enum: ['material', 'reconciliation', 'format_check', 'other'],
  }),
  requiredness: text('requiredness', {
    enum: ['required', 'conditional', 'optional'],
  }).notNull().default('required'),
  conditionText: text('condition_text'),           // 조건부 자료의 조건 설명
  periodStart: text('period_start'),               // YYYY-MM-DD
  periodEnd: text('period_end'),                   // YYYY-MM-DD
  validationStatus: text('validation_status', {
    enum: ['satisfied', 'partially_satisfied', 'missing', 'non_compliant', 'uncertain'],
  }).notNull().default('uncertain'),
  reviewStatus: text('review_status', {
    enum: ['ai_suggested', 'confirmed', 'overridden', 'excluded'],
  }).notNull().default('ai_suggested'),
  aiReasoning: text('ai_reasoning'),              // AI 판단 근거
  requestedAction: text('requested_action'),      // 클라이언트에게 요청할 조치
  staffNote: text('staff_note'),                  // 담당자 메모
  reviewedByStaffId: text('reviewed_by_staff_id').references(() => staff.id),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  tenantSessionIdx: index('riv_tenant_session_idx').on(t.tenantId, t.uploadSessionId),
  tenantSourceBatchIdx: index('riv_tenant_source_batch_idx').on(t.tenantId, t.sourceBatchId),
}))

// ---------------------------------------------------------------------------
// request_item_validation_file  (요청 항목 검증 ↔ 업로드 파일 연결)
// 한 요청 항목에 여러 파일이, 한 파일이 여러 항목에 기여할 수 있다.
// ---------------------------------------------------------------------------
export const requestItemValidationFile = sqliteTable('request_item_validation_file', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  validationId: text('validation_id').notNull().references(() => requestItemValidation.id),
  uploadFileId: text('upload_file_id').notNull().references(() => uploadFile.id),
  contribution: text('contribution', {
    enum: ['satisfied', 'partial', 'non_compliant', 'unrelated', 'uncertain'],
  }),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  validationIdx: index('rivf_validation_idx').on(t.validationId),
  tenantValidationFileUidx: uniqueIndex('rivf_tenant_validation_file_uidx').on(t.tenantId, t.validationId, t.uploadFileId),
}))

// ---------------------------------------------------------------------------
// upload_item_declaration  (고객 자료 항목 선언: 없음 표시 / 나중에 제출)
// 고객이 업로드 포털에서 "이번 기간 해당 자료 없음" 또는 "나중에 제출"을
// 명시 선언한 신호. request_item_validation(AI/담당자, itemName 키, 평가 시
// 생성)과 분리해, 세션 × 체크리스트 항목 단위로 저장한다. 완료 판정은 담당자
// 게이트를 유지하며 이 선언이 자동 충족시키지 않는다.
// ref: docs/03_Technical_Specs/34_CLIENT_ITEM_DECLARATION_SPEC.md
// ---------------------------------------------------------------------------
export const uploadItemDeclaration = sqliteTable('upload_item_declaration', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  checklistItemId: text('checklist_item_id').notNull().references(() => checklistItem.id),
  declaration: text('declaration', { enum: ['none', 'later'] }).notNull(),
  note: text('note'),
  declaredAt: text('declared_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  // 한 세션의 한 항목에 선언은 하나만 (조건절 없는 일반 복합 unique).
  tenantSessionItemUidx: uniqueIndex('uid_tenant_session_item_uidx')
    .on(t.tenantId, t.uploadSessionId, t.checklistItemId),
  tenantSessionIdx: index('uid_tenant_session_idx').on(t.tenantId, t.uploadSessionId),
  tenantSourceBatchIdx: index('uid_tenant_source_batch_idx').on(t.tenantId, t.sourceBatchId),
}))

// ---------------------------------------------------------------------------
// bookkeeping_classification_run
// 기장 자료 충족 이후 거래별 계정항목 추천/검토 실행 단위
// ---------------------------------------------------------------------------
export const bookkeepingClassificationRun = sqliteTable('bookkeeping_classification_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  status: text('status', {
    enum: ['draft', 'running', 'completed', 'failed', 'superseded'],
  }).notNull().default('draft'),
  sourceFileCount: integer('source_file_count').notNull().default(0),
  extractedRowCount: integer('extracted_row_count').notNull().default(0),
  confirmedRowCount: integer('confirmed_row_count').notNull().default(0),
  unclassifiedRowCount: integer('unclassified_row_count').notNull().default(0),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  appliedCategoryNotes: text('applied_category_notes').notNull(),
  errorMessage: text('error_message'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  sessionCreatedIdx: index('bookkeeping_run_session_created_idx').on(t.tenantId, t.uploadSessionId, t.createdAt),
  sourceBatchCreatedIdx: index('bookkeeping_run_source_batch_created_idx').on(t.tenantId, t.sourceBatchId, t.createdAt),
  statusIdx: index('bookkeeping_run_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_transaction_classification
// AI 추천 및 담당자 확정 계정항목 행
// ---------------------------------------------------------------------------
export const bookkeepingTransactionClassification = sqliteTable('bookkeeping_transaction_classification', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  classificationRunId: text('classification_run_id').notNull().references(() => bookkeepingClassificationRun.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  uploadFileId: text('upload_file_id').references(() => uploadFile.id),
  sourceType: text('source_type', {
    enum: ['bank', 'card', 'receipt', 'tax_invoice', 'other'],
  }).notNull().default('other'),
  transactionDate: text('transaction_date'),
  merchantName: text('merchant_name'),
  description: text('description'),
  amountKrw: integer('amount_krw'),
  direction: text('direction', {
    enum: ['income', 'expense', 'unknown'],
  }).notNull().default('unknown'),
  recommendedAccount: text('recommended_account'),
  recommendationConfidence: text('recommendation_confidence', {
    enum: ['high', 'medium', 'low'],
  }).notNull().default('low'),
  recommendationReason: text('recommendation_reason'),
  evidenceJson: text('evidence_json'),
  finalAccount: text('final_account'),
  staffMemo: text('staff_memo'),
  status: text('status', {
    enum: ['suggested', 'needs_decision', 'confirmed', 'unclassified', 'excluded'],
  }).notNull().default('suggested'),
  confirmedByStaffId: text('confirmed_by_staff_id').references(() => staff.id),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  runIdx: index('bookkeeping_tx_run_idx').on(t.tenantId, t.classificationRunId),
  sessionIdx: index('bookkeeping_tx_session_idx').on(t.tenantId, t.uploadSessionId),
  sourceBatchIdx: index('bookkeeping_tx_source_batch_idx').on(t.tenantId, t.sourceBatchId),
  statusIdx: index('bookkeeping_tx_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_transaction_purpose_request
// 기장검토 중 거래 용도 확인 기록(과거 GIWA 고객 메일 흐름 포함). JC-031 Slice 2c 이후
// 신규 고객 메일 draft/발송 없음. 분류 확정 시 purpose row 연동(classification-service)만 유지.
// ---------------------------------------------------------------------------
export const bookkeepingTransactionPurposeRequest = sqliteTable('bookkeeping_transaction_purpose_request', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  classificationRunId: text('classification_run_id').references(() => bookkeepingClassificationRun.id),
  clientId: text('client_id').notNull().references(() => client.id),
  status: text('status', {
    enum: ['draft', 'sent', 'partially_answered', 'submitted', 'closed', 'expired', 'cancelled'],
  }).notNull().default('draft'),
  // 발송 시점 제목/본문 스냅샷. 본문에는 거래 상세를 나열하지 않는다.
  subjectSnapshot: text('subject_snapshot').notNull(),
  bodySnapshot: text('body_snapshot').notNull(),
  dueAt: text('due_at'),
  createdByStaffId: text('created_by_staff_id').notNull().references(() => staff.id),
  sentByStaffId: text('sent_by_staff_id').references(() => staff.id),
  sentAt: text('sent_at'),
  submittedAt: text('submitted_at'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  sessionCreatedIdx: index('bk_purpose_request_session_created_idx').on(t.tenantId, t.uploadSessionId, t.createdAt),
  statusIdx: index('bk_purpose_request_status_idx').on(t.tenantId, t.status),
  clientCreatedIdx: index('bk_purpose_request_client_created_idx').on(t.tenantId, t.clientId, t.createdAt),
}))

// ---------------------------------------------------------------------------
// bookkeeping_transaction_purpose_request_row
// 고객에게 확인 요청한 거래 row. 표시 필드는 고객이 본 것을 보존하기 위해
// 스냅샷으로 저장한다(spec §4.2/§10 stale 대응).
// ---------------------------------------------------------------------------
export const bookkeepingTransactionPurposeRequestRow = sqliteTable('bookkeeping_transaction_purpose_request_row', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  purposeRequestId: text('purpose_request_id').notNull().references(() => bookkeepingTransactionPurposeRequest.id),
  classificationRowId: text('classification_row_id').references(() => bookkeepingTransactionClassification.id),
  // 고객-safe 표시 스냅샷 (원본 파일명/storage key 아님)
  sourceDisplayDate: text('source_display_date'),
  sourceDisplayCounterparty: text('source_display_counterparty'),
  sourceDisplayAmountKrw: integer('source_display_amount_krw'),
  sourceDisplayMemo: text('source_display_memo'),
  staffQuestion: text('staff_question').notNull(),
  // 담당자 전용 (고객 비노출)
  aiRecommendedAccount: text('ai_recommended_account'),
  ambiguityReason: text('ambiguity_reason'),
  // 고객 답변
  clientPurposeCode: text('client_purpose_code'),
  clientPurposeMemo: text('client_purpose_memo'),
  clientAnsweredAt: text('client_answered_at'),
  // 담당자 최종 확정
  staffFinalAccount: text('staff_final_account'),
  staffMemo: text('staff_memo'),
  status: text('status', {
    enum: ['pending', 'answered', 'staff_confirmed', 'skipped', 'cancelled'],
  }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  requestIdx: index('bk_purpose_row_request_idx').on(t.tenantId, t.purposeRequestId),
  classificationRowIdx: index('bk_purpose_row_classification_idx').on(t.tenantId, t.classificationRowId),
  statusIdx: index('bk_purpose_row_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_journal_entry_run
// 기장 계정항목 정리 이후 전표 분개표 초안 생성 실행 단위
// ---------------------------------------------------------------------------
export const bookkeepingJournalEntryRun = sqliteTable('bookkeeping_journal_entry_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  classificationRunId: text('classification_run_id').notNull().references(() => bookkeepingClassificationRun.id),
  status: text('status', {
    enum: ['draft', 'completed', 'failed', 'superseded'],
  }).notNull().default('draft'),
  rowCount: integer('row_count').notNull().default(0),
  unresolvedRowCount: integer('unresolved_row_count').notNull().default(0),
  appliedRulesSnapshot: text('applied_rules_snapshot').notNull(),
  errorMessage: text('error_message'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  sessionCreatedIdx: index('bookkeeping_journal_run_session_created_idx').on(t.tenantId, t.uploadSessionId, t.createdAt),
  sourceBatchCreatedIdx: index('bookkeeping_journal_run_source_batch_created_idx').on(t.tenantId, t.sourceBatchId, t.createdAt),
  statusIdx: index('bookkeeping_journal_run_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_journal_entry_row
// 전표 분개표 초안 행. 담당자가 검토/확정 후 엑셀 작업표로 내려받는다.
// ---------------------------------------------------------------------------
export const bookkeepingJournalEntryRow = sqliteTable('bookkeeping_journal_entry_row', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  journalEntryRunId: text('journal_entry_run_id').notNull().references(() => bookkeepingJournalEntryRun.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  classificationRowId: text('classification_row_id').notNull().references(() => bookkeepingTransactionClassification.id),
  entryDate: text('entry_date'),
  requestedPeriod: text('requested_period').notNull(),
  attributedPeriod: text('attributed_period'),
  closePeriod: text('close_period').notNull(),
  debitAccount: text('debit_account'),
  debitAmountKrw: integer('debit_amount_krw'),
  creditAccount: text('credit_account'),
  creditAmountKrw: integer('credit_amount_krw'),
  counterparty: text('counterparty'),
  memo: text('memo'),
  status: text('status', {
    enum: ['draft', 'needs_decision', 'confirmed', 'excluded'],
  }).notNull().default('draft'),
  reason: text('reason'),
  staffMemo: text('staff_memo'),
  confirmedByStaffId: text('confirmed_by_staff_id').references(() => staff.id),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  runIdx: index('bookkeeping_journal_row_run_idx').on(t.tenantId, t.journalEntryRunId),
  sessionIdx: index('bookkeeping_journal_row_session_idx').on(t.tenantId, t.uploadSessionId),
  sourceBatchIdx: index('bookkeeping_journal_row_source_batch_idx').on(t.tenantId, t.sourceBatchId),
  statusIdx: index('bookkeeping_journal_row_status_idx').on(t.tenantId, t.status),
}))

// ---------------------------------------------------------------------------
// bookkeeping_journal_entry_voucher
// N줄 전표 그룹. 2차-0부터 신규 run의 primary 저장 경로.
// ---------------------------------------------------------------------------
export const bookkeepingJournalEntryVoucher = sqliteTable('bookkeeping_journal_entry_voucher', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  journalEntryRunId: text('journal_entry_run_id').notNull().references(() => bookkeepingJournalEntryRun.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  classificationRowId: text('classification_row_id').notNull().references(() => bookkeepingTransactionClassification.id),
  sourceClassificationRowIds: text('source_classification_row_ids'),
  voucherNumber: text('voucher_number').notNull(),
  entryDate: text('entry_date'),
  requestedPeriod: text('requested_period').notNull(),
  attributedPeriod: text('attributed_period'),
  closePeriod: text('close_period').notNull(),
  status: text('status', {
    enum: ['draft', 'needs_decision', 'confirmed', 'excluded'],
  }).notNull().default('draft'),
  reason: text('reason'),
  staffMemo: text('staff_memo'),
  confirmedByStaffId: text('confirmed_by_staff_id').references(() => staff.id),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  runIdx: index('bookkeeping_journal_voucher_run_idx').on(t.tenantId, t.journalEntryRunId),
  sessionIdx: index('bookkeeping_journal_voucher_session_idx').on(t.tenantId, t.uploadSessionId),
  sourceBatchIdx: index('bookkeeping_journal_voucher_source_batch_idx').on(t.tenantId, t.sourceBatchId),
  voucherNumberIdx: index('bookkeeping_journal_voucher_number_idx').on(t.tenantId, t.journalEntryRunId, t.voucherNumber),
}))

// ---------------------------------------------------------------------------
// bookkeeping_journal_entry_voucher_line
// 전표 줄 단위 저장. 엑셀 1행 = line 1건.
// ---------------------------------------------------------------------------
export const bookkeepingJournalEntryVoucherLine = sqliteTable('bookkeeping_journal_entry_voucher_line', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  voucherId: text('voucher_id').notNull().references(() => bookkeepingJournalEntryVoucher.id),
  lineSequence: integer('line_sequence').notNull(),
  side: text('side', { enum: ['debit', 'credit'] }).notNull(),
  accountName: text('account_name'),
  accountCode: text('account_code'),
  amountKrw: integer('amount_krw').notNull().default(0),
  counterparty: text('counterparty'),
  counterpartyCode: text('counterparty_code'),
  memo: text('memo'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  voucherIdx: index('bookkeeping_journal_voucher_line_voucher_idx').on(t.tenantId, t.voucherId, t.lineSequence),
}))

// ---------------------------------------------------------------------------
// vat_period_summary
// 사업장·부가세 기간별 세액/패키지 상태 스냅샷.
// 과세/영세율/면세 매출 구분은 현재 전표 라인만으로 안정적으로 복원할 수 없어
// VAT 전용 summary에 저장한다.
// ---------------------------------------------------------------------------
export const vatPeriodSummary = sqliteTable('vat_period_summary', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  periodKey: text('period_key').notNull(),
  periodStartMonth: text('period_start_month').notNull(),
  periodEndMonth: text('period_end_month').notNull(),
  filingType: text('filing_type', { enum: ['preliminary', 'final'] }).notNull().default('final'),
  taxableSupplyKrw: integer('taxable_supply_krw').notNull().default(0),
  taxableOutputTaxKrw: integer('taxable_output_tax_krw').notNull().default(0),
  zeroRatedSupplyKrw: integer('zero_rated_supply_krw').notNull().default(0),
  exemptSupplyKrw: integer('exempt_supply_krw').notNull().default(0),
  outputTaxKrw: integer('output_tax_krw').notNull().default(0),
  inputTaxKrw: integer('input_tax_krw').notNull().default(0),
  inputTaxDeductibleKrw: integer('input_tax_deductible_krw').notNull().default(0),
  payableTaxKrw: integer('payable_tax_krw').notNull().default(0),
  pendingDeductionCount: integer('pending_deduction_count').notNull().default(0),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
  packageStatus: text('package_status', { enum: ['locked', 'ready', 'generated'] }).notNull().default('locked'),
  packageStorageKey: text('package_storage_key'),
  generatedAt: text('generated_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  scopeUidx: uniqueIndex('vat_period_summary_scope_uidx')
    .on(t.tenantId, t.clientId, t.periodKey, t.filingType),
  periodIdx: index('vat_period_summary_period_idx').on(t.tenantId, t.clientId, t.periodKey),
  packageIdx: index('vat_period_summary_package_idx').on(t.tenantId, t.clientId, t.packageStatus),
}))

// ---------------------------------------------------------------------------
// vat_deduction_review
// 매입 전표/거래별 부가세 공제 판정 상태. 신고 패키지 생성 잠금은 pending
// review가 남아 있는지로 결정한다.
// ---------------------------------------------------------------------------
export const vatDeductionReview = sqliteTable('vat_deduction_review', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  periodKey: text('period_key').notNull(),
  sourceVoucherId: text('source_voucher_id').references(() => bookkeepingJournalEntryVoucher.id),
  sourceVoucherLineId: text('source_voucher_line_id').references(() => bookkeepingJournalEntryVoucherLine.id),
  classificationRowId: text('classification_row_id').references(() => bookkeepingTransactionClassification.id),
  description: text('description').notNull(),
  counterparty: text('counterparty'),
  supplyAmountKrw: integer('supply_amount_krw').notNull().default(0),
  inputTaxKrw: integer('input_tax_krw').notNull().default(0),
  kind: text('kind', {
    enum: ['deductible', 'non_deductible_candidate', 'proration_required'],
  }).notNull().default('deductible'),
  decision: text('decision', {
    enum: ['pending', 'deductible', 'non_deductible', 'prorated'],
  }).notNull().default('pending'),
  reason: text('reason').notNull().default(''),
  prorationRateBps: integer('proration_rate_bps'),
  confirmedByStaffId: text('confirmed_by_staff_id').references(() => staff.id),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  periodIdx: index('vat_deduction_review_period_idx').on(t.tenantId, t.clientId, t.periodKey),
  decisionIdx: index('vat_deduction_review_decision_idx').on(t.tenantId, t.clientId, t.periodKey, t.decision),
  voucherIdx: index('vat_deduction_review_voucher_idx').on(t.tenantId, t.sourceVoucherId),
  voucherLineIdx: index('vat_deduction_review_voucher_line_idx').on(t.tenantId, t.sourceVoucherLineId),
}))

// ---------------------------------------------------------------------------
// client_request_event  (캘린더 요청 인스턴스)
// upload_session_id: event → session 단방향 FK. 역방향은 upload_session.request_event_id (text only).
// ---------------------------------------------------------------------------
export const clientRequestEvent = sqliteTable('client_request_event', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  clientId: text('client_id')
    .notNull()
    .references(() => client.id),
  requestScheduleId: text('request_schedule_id').references(() => clientRequestSchedule.id),
  requestTemplateId: text('request_template_id').references(() => requestTemplate.id),
  // event → session 방향 FK 보유. session → event 는 FK 없이 text로 보관.
  uploadSessionId: text('upload_session_id').references(() => uploadSession.id),
  accountingPeriod: text('accounting_period').notNull(), // e.g. '2026-05', '2026-Q2'
  frequency: text('frequency', {
    enum: ['monthly', 'quarterly', 'semiannual', 'annual', 'custom'],
  }).notNull(),
  requestKind: text('request_kind', { enum: ['general', 'payroll'] }).notNull().default('general'),
  title: text('title').notNull(),
  dueAt: text('due_at').notNull(),                      // ISO 8601 datetime, Asia/Seoul
  status: text('status', {
    enum: ['scheduled', 'draft_ready', 'sent', 'waiting_upload', 'submitted', 'analyzing', 'needs_review', 'completed', 'expired', 'cancelled'],
  }).notNull().default('scheduled'),
  requestItemsSnapshot: text('request_items_snapshot'), // JSON: RequestItem[]
  emailSubjectSnapshot: text('email_subject_snapshot'),
  emailBodySnapshot: text('email_body_snapshot'),
  emailGreetingSnapshot: text('email_greeting_snapshot'),
  senderPhoneSnapshot: text('sender_phone_snapshot'),
  ccEmailSnapshot: text('cc_email_snapshot'),
  analysisCriteriaSnapshot: text('analysis_criteria_snapshot'),
  deletedAt: text('deleted_at'),
  deletedByStaffId: text('deleted_by_staff_id').references(() => staff.id),
  createdByStaffId: text('created_by_staff_id')
    .notNull()
    .references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// outbound_email
// ---------------------------------------------------------------------------
export const outboundEmail = sqliteTable('outbound_email', {
  id: text('id').primaryKey(),
  uploadSessionId: text('upload_session_id')
    .notNull()
    .references(() => uploadSession.id),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  type: text('type', {
    enum: [
      'upload_request',
      'missing_request',
      'completion_thanks',
      'reminder',
      'staff_notification',
      'transaction_purpose_request',
    ],
  }).notNull(),
  // draft → sent (MVP: 담당자 승인 후 즉시 발송)
  // rejected: 담당자가 발송하지 않기로 결정, failed: 기술적 발송 실패
  status: text('status', { enum: ['draft', 'sent', 'failed', 'rejected'] })
    .notNull()
    .default('draft'),
  toEmail: text('to_email').notNull(),
  ccEmail: text('cc_email'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  // 메일 초안 생성 시 적용된 기준 스냅샷
  appliedAnalysisNotes: text('applied_analysis_notes'),
  criteriaSummary: text('criteria_summary'),
  // 요청 일정·템플릿과의 연결 (nullable — 기존 세션 레코드 호환)
  requestEventId: text('request_event_id').references(() => clientRequestEvent.id),
  requestTemplateId: text('request_template_id').references(() => requestTemplate.id),
  approvedByStaffId: text('approved_by_staff_id').references(() => staff.id),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// outbound_send_lock  (요청 발송 멱등성 보호용 idempotency record)
// 동시 실행만 차단한다 — unique는 status = 'running' partial 인덱스.
// release 시 status가 'completed'/'failed'로 바뀌면 unique 슬롯에서 빠지므로
// 실패 후 재시도가 가능하다. 락 row 자체는 감사용으로 영구 보존한다.
// 이미 발송 성공한 이벤트의 재요청 차단은 라우트의 event.uploadSessionId 체크가 담당한다.
// ---------------------------------------------------------------------------
export const outboundSendLock = sqliteTable('outbound_send_lock', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  requestEventId: text('request_event_id')
    .notNull()
    .references(() => clientRequestEvent.id),
  status: text('status', { enum: ['running', 'completed', 'failed'] })
    .notNull()
    .default('running'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('outbound_send_lock_running_uidx')
    .on(table.requestEventId)
    .where(sql`status = 'running'`),
])

// ---------------------------------------------------------------------------
// cron_run  (Vercel Cron 중복 실행 방지용 idempotency key 레코드)
// isRunning 플래그는 서버리스 환경에서 동작하지 않으므로 DB 잠금으로 대체.
// ---------------------------------------------------------------------------
export const cronRun = sqliteTable('cron_run', {
  id: text('id').primaryKey(),
  jobName: text('job_name').notNull(),  // 'reminder' | 'retry_failed' | 'stale_notify' | 'cleanup_send_locks'
  runKey: text('run_key').notNull(),    // idempotency key (e.g. 'reminder-2026-05-09')
  status: text('status', { enum: ['running', 'completed', 'failed'] })
    .notNull()
    .default('running'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('cron_run_job_key_uidx').on(table.jobName, table.runKey),
])

// ---------------------------------------------------------------------------
// audit_proof  (Giwa Chain 해커톤 proof + v2 수신 증명)
// ---------------------------------------------------------------------------
export const auditProof = sqliteTable('audit_proof', {
  id: text('id').primaryKey(),
  uploadFileId: text('upload_file_id').references(() => uploadFile.id),
  uploadSessionId: text('upload_session_id').references(() => uploadSession.id),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenant.id),
  txHash: text('tx_hash'),
  proofType: text('proof_type', { enum: ['file_received', 'session_completed'] }).notNull(),
  // proof 실패가 핵심 흐름을 차단하지 않도록 비동기 레이어로 분리
  status: text('status', { enum: ['pending', 'submitted', 'confirmed', 'failed'] })
    .notNull()
    .default('pending'),
  errorMessage: text('error_message'),
  // 온체인 메타 — Explorer 링크 표시와 감사 추적용
  chain: text('chain'),              // 'giwa-sepolia'
  chainId: integer('chain_id'),      // 91342
  contractAddress: text('contract_address'),
  explorerUrl: text('explorer_url'), // https://sepolia-explorer.giwa.io/tx/{txHash}
  payloadHash: text('payload_hash'), // 온체인 기록된 핵심 해시 (fileHash or checklistSummaryHash)
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// payroll_excel_template  (급여정산 결과 엑셀 양식 + 컬럼 매핑)
// ---------------------------------------------------------------------------
export const payrollExcelTemplate = sqliteTable('payroll_excel_template', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').references(() => client.id),
  name: text('name').notNull(),
  originalFilename: text('original_filename').notNull(),
  storageKey: text('storage_key').notNull(), // 서버 경로 또는 Blob URL
  sheetName: text('sheet_name').notNull(),
  headerRow: integer('header_row').notNull(),
  subHeaderRow: integer('sub_header_row'),
  dataStartRow: integer('data_start_row').notNull(),
  mappingJson: text('mapping_json').notNull(), // [{field, column, columnIndex}]
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// client_payroll_rule_profile  (고객사별 급여기준 프로필 — AI 초안 → 담당자 승인 → 결정론적 적용)
//   profile_json = Zod ClientPayrollRuleProfileV1 (직원 원자료 미저장, 규칙/매핑/근거만)
// ---------------------------------------------------------------------------
export const clientPayrollRuleProfile = sqliteTable('client_payroll_rule_profile', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  status: text('status', {
    enum: ['draft', 'active', 'superseded', 'retired', 'rejected'],
  }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  effectiveFrom: text('effective_from').notNull(), // ISO date / yyyy-MM (Luxon 정규화)
  effectiveTo: text('effective_to'),
  profileJson: text('profile_json').notNull(), // Zod ClientPayrollRuleProfileV1
  sourceSummaryJson: text('source_summary_json').notNull(), // 출처 id/hash/type 요약
  approvalNotes: text('approval_notes'),
  approvedByStaffId: text('approved_by_staff_id').references(() => staff.id),
  approvedAt: text('approved_at'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('client_payroll_rule_profile_lookup_idx').on(table.tenantId, table.clientId, table.status),
])

// ---------------------------------------------------------------------------
// client_payroll_rule_profile_source  (프로필 초안이 만들어진 출처 기록)
// ---------------------------------------------------------------------------
export const clientPayrollRuleProfileSource = sqliteTable('client_payroll_rule_profile_source', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  profileId: text('profile_id').notNull().references(() => clientPayrollRuleProfile.id),
  clientId: text('client_id').notNull().references(() => client.id), // 중복 client guard
  sourceType: text('source_type', {
    enum: ['natural_language', 'mapping_table', 'rule_document', 'excel_embedded', 'statutory_default'],
  }).notNull(),
  sourceFileId: text('source_file_id'),
  sourceHash: text('source_hash').notNull(),
  sourceEffectiveFrom: text('source_effective_from'),
  securityLane: text('security_lane', {
    enum: ['normal', 'redacted', 'tee_required'],
  }).notNull().default('normal'),
  aiProviderMetadataJson: text('ai_provider_metadata_json'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('client_payroll_rule_profile_source_profile_idx').on(table.tenantId, table.profileId),
])

// ---------------------------------------------------------------------------
// payroll_rule_profile_application  (급여 실행에 적용된 프로필 스냅샷 — 실행당 불변)
//   payroll_extraction_batch ALTER 대신 별도 테이블: hot 테이블 미변경 + 감사 스냅샷 보존
// ---------------------------------------------------------------------------
export const payrollRuleProfileApplication = sqliteTable('payroll_rule_profile_application', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  profileId: text('profile_id').notNull().references(() => clientPayrollRuleProfile.id),
  profileVersion: integer('profile_version').notNull(),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  batchId: text('batch_id').references(() => payrollExtractionBatch.id),
  snapshotJson: text('snapshot_json').notNull(), // 적용 시점 규칙 스냅샷 (불변)
  appliedAt: text('applied_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('payroll_rule_profile_application_session_idx').on(table.tenantId, table.uploadSessionId),
  index('payroll_rule_profile_application_source_batch_idx').on(table.tenantId, table.sourceBatchId),
])

// ---------------------------------------------------------------------------
// payroll_extraction_batch  (세션 기준 급여 추출 실행 묶음)
// ---------------------------------------------------------------------------
export const payrollExtractionBatch = sqliteTable('payroll_extraction_batch', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  requestEventId: text('request_event_id').references(() => clientRequestEvent.id),
  status: text('status', {
    enum: ['pending', 'running', 'needs_review', 'completed', 'failed'],
  }).notNull().default('pending'),
  sourceUploadFileIds: text('source_upload_file_ids').notNull(), // JSON array of upload_file.id
  model: text('model'),
  errorMessage: text('error_message'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  // 동일 세션의 'running' batch 동시 INSERT 차단 (partial unique index)
  uniqueIndex('payroll_batch_running_uidx').on(table.uploadSessionId).where(sql`status = 'running'`),
  index('payroll_batch_source_batch_idx').on(table.tenantId, table.sourceBatchId),
])

// ---------------------------------------------------------------------------
// payroll_extraction_row  (직원별 급여 변동 후보 — 담당자 검토 대상)
// ---------------------------------------------------------------------------
export const payrollExtractionRow = sqliteTable('payroll_extraction_row', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  batchId: text('batch_id').notNull().references(() => payrollExtractionBatch.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  payrollPeriod: text('payroll_period').notNull(),
  employeeCode: text('employee_code'),
  employeeName: text('employee_name'),
  department: text('department'),
  jobTitle: text('job_title'),
  jobType: text('job_type'),
  baseSalary: integer('base_salary'),
  bonus: integer('bonus'),
  mealAllowance: integer('meal_allowance'),
  transportationAllowance: integer('transportation_allowance'),
  holidayWorkAllowance: integer('holiday_work_allowance'),
  domesticTravelAllowance: integer('domestic_travel_allowance'),
  annualLeaveAllowance: integer('annual_leave_allowance'),
  rndAllowance: integer('rnd_allowance'),
  otherAllowance: integer('other_allowance'),
  performanceIncentive: integer('performance_incentive'),
  nightWorkAllowance: integer('night_work_allowance'),
  vehicleMaintenanceAllowance: integer('vehicle_maintenance_allowance'),
  retroactivePay: integer('retroactive_pay'),
  overtimeAllowance: integer('overtime_allowance'),
  childcareAllowance: integer('childcare_allowance'),
  deductionAmount: integer('deduction_amount'),
  memo: text('memo'),
  sourceReference: text('source_reference'), // JSON: {filename, sheetName, rowHint}
  confidence: text('confidence', { enum: ['high', 'medium', 'low', 'unknown'] }).notNull().default('unknown'),
  aiVerdict: text('ai_verdict', { enum: ['pass', 'fail'] }),
  aiVerdictReason: text('ai_verdict_reason'),
  reviewStatus: text('review_status', {
    enum: ['needs_review', 'confirmed', 'excluded'],
  }).notNull().default('needs_review'),
  reviewedByStaffId: text('reviewed_by_staff_id').references(() => staff.id),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('payroll_extraction_row_source_batch_idx').on(table.tenantId, table.sourceBatchId),
])

// ---------------------------------------------------------------------------
// payroll_excel_draft  (작성된 결과 엑셀 초안)
// ---------------------------------------------------------------------------
export const payrollExcelDraft = sqliteTable('payroll_excel_draft', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  sourceBatchId: text('source_batch_id').references(() => sourceBatch.id),
  batchId: text('batch_id').notNull().references(() => payrollExtractionBatch.id),
  templateId: text('template_id').notNull().references(() => payrollExcelTemplate.id),
  status: text('status', { enum: ['generated', 'failed'] }).notNull(),
  storageKey: text('storage_key'), // Blob URL
  filename: text('filename').notNull(),
  passRowCount: integer('confirmed_row_count').notNull(),
  excludedRowCount: integer('excluded_row_count').notNull(),
  errorMessage: text('error_message'),
  generatedByStaffId: text('generated_by_staff_id').notNull().references(() => staff.id),
  generatedAt: text('generated_at').notNull(),
}, (table) => [
  index('payroll_excel_draft_source_batch_idx').on(table.tenantId, table.sourceBatchId),
])

// ---------------------------------------------------------------------------
// payroll_period_summary
// 사업장·귀속월별 급여 요약과 마감 상태. payroll_extraction_row는 원천 후보이고,
// 이 테이블은 회사용 급여 화면과 신고지원이 참조할 실행 결과 스냅샷이다.
// ---------------------------------------------------------------------------
export const payrollPeriodSummary = sqliteTable('payroll_period_summary', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  payrollPeriod: text('payroll_period').notNull(),
  paymentDate: text('payment_date'),
  employeeCount: integer('employee_count').notNull().default(0),
  issueCount: integer('issue_count').notNull().default(0),
  grossPayKrw: integer('gross_pay_krw').notNull().default(0),
  withholdingTaxKrw: integer('withholding_tax_krw').notNull().default(0),
  socialInsuranceKrw: integer('social_insurance_krw').notNull().default(0),
  deductionTotalKrw: integer('deduction_total_krw').notNull().default(0),
  netPayKrw: integer('net_pay_krw').notNull().default(0),
  noticeImportStatus: text('notice_import_status', {
    enum: ['missing', 'partial', 'matched'],
  }).notNull().default('missing'),
  closeStatus: text('close_status', {
    enum: ['open', 'blocked', 'closed'],
  }).notNull().default('open'),
  closedByStaffId: text('closed_by_staff_id').references(() => staff.id),
  closedAt: text('closed_at'),
  payslipStatus: text('payslip_status', {
    enum: ['not_generated', 'ready', 'generated', 'failed'],
  }).notNull().default('not_generated'),
  withholdingStatementStatus: text('withholding_statement_status', {
    enum: ['not_generated', 'ready', 'generated', 'failed'],
  }).notNull().default('not_generated'),
  insuranceStatementStatus: text('insurance_statement_status', {
    enum: ['not_generated', 'ready', 'generated', 'failed'],
  }).notNull().default('not_generated'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  scopeUidx: uniqueIndex('payroll_period_summary_scope_uidx')
    .on(t.tenantId, t.clientId, t.payrollPeriod),
  periodIdx: index('payroll_period_summary_period_idx').on(t.tenantId, t.clientId, t.payrollPeriod),
  closeIdx: index('payroll_period_summary_close_idx').on(t.tenantId, t.clientId, t.closeStatus),
}))

// ---------------------------------------------------------------------------
// payroll_employee_line
// 직원별 급여대장 실행 결과. 건강보험 EDI/사회보험 고지액이 있으면
// 계산 추정값보다 이 line의 최종 4대보험 공제액에 우선 반영된다.
// ---------------------------------------------------------------------------
export const payrollEmployeeLine = sqliteTable('payroll_employee_line', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  periodSummaryId: text('period_summary_id').notNull().references(() => payrollPeriodSummary.id),
  sourceBatchId: text('source_batch_id').references(() => payrollExtractionBatch.id),
  sourceRowId: text('source_row_id').references(() => payrollExtractionRow.id),
  uploadSessionId: text('upload_session_id').references(() => uploadSession.id),
  employeeCode: text('employee_code'),
  employeeName: text('employee_name').notNull(),
  department: text('department'),
  jobTitle: text('job_title'),
  jobType: text('job_type'),
  baseSalaryKrw: integer('base_salary_krw').notNull().default(0),
  allowanceKrw: integer('allowance_krw').notNull().default(0),
  grossPayKrw: integer('gross_pay_krw').notNull().default(0),
  incomeTaxKrw: integer('income_tax_krw').notNull().default(0),
  localIncomeTaxKrw: integer('local_income_tax_krw').notNull().default(0),
  nationalPensionKrw: integer('national_pension_krw').notNull().default(0),
  healthInsuranceKrw: integer('health_insurance_krw').notNull().default(0),
  longTermCareKrw: integer('long_term_care_krw').notNull().default(0),
  employmentInsuranceKrw: integer('employment_insurance_krw').notNull().default(0),
  socialInsuranceKrw: integer('social_insurance_krw').notNull().default(0),
  otherDeductionKrw: integer('other_deduction_krw').notNull().default(0),
  deductionTotalKrw: integer('deduction_total_krw').notNull().default(0),
  netPayKrw: integer('net_pay_krw').notNull().default(0),
  noticeMatchStatus: text('notice_match_status', {
    enum: ['matched', 'missing_notice', 'ambiguous', 'unmatched'],
  }).notNull().default('missing_notice'),
  // 순환 FK를 피하기 위해 DB FK는 notice line -> employee line 방향만 둔다.
  noticeLineId: text('notice_line_id'),
  status: text('status', {
    enum: ['ready', 'needs_review', 'closed'],
  }).notNull().default('needs_review'),
  issueCode: text('issue_code'),
  issueMessage: text('issue_message'),
  editedByStaffId: text('edited_by_staff_id').references(() => staff.id),
  editedAt: text('edited_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  periodIdx: index('payroll_employee_line_period_idx').on(t.tenantId, t.clientId, t.periodSummaryId),
  statusIdx: index('payroll_employee_line_status_idx').on(t.tenantId, t.clientId, t.periodSummaryId, t.status),
  sourceRowIdx: index('payroll_employee_line_source_row_idx').on(t.tenantId, t.sourceRowId),
  noticeMatchIdx: index('payroll_employee_line_notice_match_idx')
    .on(t.tenantId, t.clientId, t.periodSummaryId, t.noticeMatchStatus),
}))

// ---------------------------------------------------------------------------
// payroll_insurance_notice_import
// 건강보험 EDI/사회보험징수포털 고지내역 파일 또는 수동 입력 묶음.
// 자격증명·공동인증서·포털 비밀번호는 저장하지 않는다.
// ---------------------------------------------------------------------------
export const payrollInsuranceNoticeImport = sqliteTable('payroll_insurance_notice_import', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  payrollPeriod: text('payroll_period').notNull(),
  sourceType: text('source_type', {
    enum: ['nhis_edi', 'social_insurance_portal', 'manual'],
  }).notNull(),
  originalFilename: text('original_filename'),
  storageKey: text('storage_key'),
  fileHash: text('file_hash'),
  status: text('status', {
    enum: ['uploaded', 'parsed', 'matched', 'failed'],
  }).notNull().default('uploaded'),
  importedByStaffId: text('imported_by_staff_id').references(() => staff.id),
  importedAt: text('imported_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  periodIdx: index('payroll_insurance_notice_import_period_idx').on(t.tenantId, t.clientId, t.payrollPeriod),
  statusIdx: index('payroll_insurance_notice_import_status_idx').on(t.tenantId, t.clientId, t.status),
}))

// ---------------------------------------------------------------------------
// payroll_insurance_notice_line
// 고지내역 직원별 보험료 라인. 주민등록번호 원문은 저장하지 않고 match_key_hash만
// 보관한다.
// ---------------------------------------------------------------------------
export const payrollInsuranceNoticeLine = sqliteTable('payroll_insurance_notice_line', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  noticeImportId: text('notice_import_id').notNull().references(() => payrollInsuranceNoticeImport.id),
  employeeCode: text('employee_code'),
  employeeName: text('employee_name'),
  matchKeyHash: text('match_key_hash'),
  nationalPensionKrw: integer('national_pension_krw').notNull().default(0),
  healthInsuranceKrw: integer('health_insurance_krw').notNull().default(0),
  longTermCareKrw: integer('long_term_care_krw').notNull().default(0),
  employmentInsuranceKrw: integer('employment_insurance_krw').notNull().default(0),
  matchStatus: text('match_status', {
    enum: ['matched', 'missing_notice', 'ambiguous', 'unmatched'],
  }).notNull().default('unmatched'),
  matchedEmployeeLineId: text('matched_employee_line_id').references(() => payrollEmployeeLine.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  importIdx: index('payroll_insurance_notice_line_import_idx').on(t.tenantId, t.noticeImportId),
  matchIdx: index('payroll_insurance_notice_line_match_idx').on(t.tenantId, t.clientId, t.matchStatus),
  employeeLineIdx: index('payroll_insurance_notice_line_employee_line_idx').on(t.tenantId, t.matchedEmployeeLineId),
}))

// ---------------------------------------------------------------------------
// filing_item
// 신고지원 워크스페이스의 신고 항목 상태 스냅샷. 실제 홈택스/EDI 제출은 회사가
// 직접 수행하며, 이 테이블은 내부 패키지와 사용자가 기록한 제출 상태만 보관한다.
// ---------------------------------------------------------------------------
export const filingItem = sqliteTable('filing_item', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  filingPeriodKey: text('filing_period_key').notNull(),
  payrollPeriodKey: text('payroll_period_key').notNull(),
  itemType: text('item_type', {
    enum: ['vat', 'withholding', 'social_insurance'],
  }).notNull(),
  sourceModule: text('source_module', { enum: ['vat', 'payroll'] }).notNull(),
  sourceRefId: text('source_ref_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['locked', 'ready', 'needs_review', 'submitted'],
  }).notNull().default('locked'),
  packageStatus: text('package_status', {
    enum: ['locked', 'ready', 'generated', 'submitted'],
  }).notNull().default('locked'),
  lockReason: text('lock_reason'),
  packageStorageKey: text('package_storage_key'),
  generatedAt: text('generated_at'),
  submittedAt: text('submitted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  scopeUidx: uniqueIndex('filing_item_scope_uidx').on(t.tenantId, t.clientId, t.filingPeriodKey, t.itemType),
  statusIdx: index('filing_item_status_idx').on(t.tenantId, t.clientId, t.status),
  packageIdx: index('filing_item_package_idx').on(t.tenantId, t.clientId, t.packageStatus),
}))

// ---------------------------------------------------------------------------
// filing_receipt
// 홈택스/EDI에서 회사가 직접 제출한 뒤 받은 접수증 보관 메타데이터.
// storage_key는 private Blob key/URL이므로 UI에 직접 노출하지 않는다.
// ---------------------------------------------------------------------------
export const filingReceipt = sqliteTable('filing_receipt', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  filingItemId: text('filing_item_id').notNull().references(() => filingItem.id),
  receiptType: text('receipt_type', {
    enum: ['hometax_receipt', 'payment_receipt', 'insurance_receipt'],
  }).notNull(),
  originalFilename: text('original_filename').notNull(),
  storageKey: text('storage_key').notNull(),
  fileHash: text('file_hash'),
  uploadedByStaffId: text('uploaded_by_staff_id').references(() => staff.id),
  uploadedAt: text('uploaded_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  itemIdx: index('filing_receipt_item_idx').on(t.tenantId, t.clientId, t.filingItemId),
  typeIdx: index('filing_receipt_type_idx').on(t.tenantId, t.clientId, t.receiptType),
}))

// ---------------------------------------------------------------------------
// filing_checklist_item
// 제출 후 납부·접수증 보관 같은 사후 확인 상태. 완료 체크는 내부 확인일 뿐
// 시스템이 제출/납부를 대행했다는 뜻이 아니다.
// ---------------------------------------------------------------------------
export const filingChecklistItem = sqliteTable('filing_checklist_item', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  filingPeriodKey: text('filing_period_key').notNull(),
  filingItemId: text('filing_item_id').references(() => filingItem.id),
  code: text('code').notNull(),
  label: text('label').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedByStaffId: text('completed_by_staff_id').references(() => staff.id),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  scopeUidx: uniqueIndex('filing_checklist_item_scope_uidx').on(t.tenantId, t.clientId, t.filingPeriodKey, t.code),
  completedIdx: index('filing_checklist_item_completed_idx').on(t.tenantId, t.clientId, t.completed),
}))

// ---------------------------------------------------------------------------
// employee_profile  (JC-015 직원 명부)
// 급여 실행 결과(payroll_employee_line)와 분리된 상시 직원 마스터. 주민등록번호·
// 계좌번호·전화번호 원문은 저장하지 않고 이름·사번·부서·업무 이메일만 관리한다.
// 급여·4대보험 고지액 매칭·내부 리마인드(JC-016) 수신자의 기준 데이터다.
// ---------------------------------------------------------------------------
export const employeeProfile = sqliteTable('employee_profile', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  employeeCode: text('employee_code'),
  displayName: text('display_name').notNull(),
  department: text('department'),
  jobTitle: text('job_title'),
  employeeStatus: text('employee_status', { enum: ['active', 'leave', 'terminated'] }).notNull().default('active'),
  payrollEligibility: text('payroll_eligibility', { enum: ['eligible', 'excluded'] }).notNull().default('eligible'),
  insuranceEnrollmentStatus: text('insurance_enrollment_status', {
    enum: ['not_checked', 'enrolled', 'needs_review', 'not_applicable'],
  }).notNull().default('not_checked'),
  hireDate: text('hire_date'),
  terminationDate: text('termination_date'),
  workEmail: text('work_email'),
  notificationEnabled: integer('notification_enabled', { mode: 'boolean' }).notNull().default(true),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  updatedByStaffId: text('updated_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  codeUidx: uniqueIndex('employee_profile_code_uidx').on(t.tenantId, t.clientId, t.employeeCode),
  statusIdx: index('employee_profile_status_idx').on(t.tenantId, t.clientId, t.employeeStatus),
  payrollIdx: index('employee_profile_payroll_idx').on(t.tenantId, t.clientId, t.payrollEligibility),
}))

// ---------------------------------------------------------------------------
// internal_reminder_rule  (JC-016 내부 리마인드)
// 회사 내부 staff에게 세무 일정과 확인 필요 상태를 알리는 규칙이다.
// GIWA 고객 요청 메일 테이블과 분리해 외부 고객 요청/자동 제출 흐름으로 번지지 않게 한다.
// ---------------------------------------------------------------------------
export const internalReminderRule = sqliteTable('internal_reminder_rule', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  domain: text('domain', {
    enum: ['source_collection', 'bookkeeping_review', 'vat', 'payroll', 'filing_support'],
  }).notNull(),
  triggerType: text('trigger_type', {
    enum: ['deadline_offset', 'daily_digest', 'manual'],
  }).notNull(),
  offsetDays: integer('offset_days'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  recipientSource: text('recipient_source', {
    enum: ['staff', 'employee_directory', 'mixed'],
  }).notNull().default('staff'),
  subjectTemplate: text('subject_template').notNull(),
  bodyTemplate: text('body_template').notNull(),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  updatedByStaffId: text('updated_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  scopeUidx: uniqueIndex('internal_reminder_rule_scope_uidx')
    .on(t.tenantId, t.clientId, t.domain, t.triggerType, t.offsetDays),
  domainIdx: index('internal_reminder_rule_domain_idx').on(t.tenantId, t.clientId, t.domain),
  enabledIdx: index('internal_reminder_rule_enabled_idx').on(t.tenantId, t.clientId, t.enabled),
}))

// ---------------------------------------------------------------------------
// internal_reminder_recipient_override
// v1 UI는 staff/본인 기본 수신만 사용한다. 이 테이블은 규칙별 예외 수신자를 위한
// 물리 모델로 두되, 직원 명부 기반 수신과 직접 이메일 override는 후속 정책 확정 전까지
// API에서 열지 않는다.
// ---------------------------------------------------------------------------
export const internalReminderRecipientOverride = sqliteTable('internal_reminder_recipient_override', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  ruleId: text('rule_id').notNull().references(() => internalReminderRule.id),
  recipientType: text('recipient_type', {
    enum: ['staff', 'employee', 'email'],
  }).notNull(),
  staffId: text('staff_id').references(() => staff.id),
  employeeId: text('employee_id').references(() => employeeProfile.id),
  emailHash: text('email_hash'),
  emailLabel: text('email_label'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  ruleIdx: index('internal_reminder_recipient_override_rule_idx').on(t.tenantId, t.clientId, t.ruleId),
  staffIdx: index('internal_reminder_recipient_override_staff_idx').on(t.tenantId, t.staffId),
  employeeIdx: index('internal_reminder_recipient_override_employee_idx').on(t.tenantId, t.employeeId),
}))

// ---------------------------------------------------------------------------
// internal_reminder_send_log
// 발송 성공/실패와 중복 방지 결과를 저장한다. 본문 원문과 private storage key는
// 저장하지 않고, 수신자 표시 라벨과 provider 메시지 id 정도만 보관한다.
// ---------------------------------------------------------------------------
export const internalReminderSendLog = sqliteTable('internal_reminder_send_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull().references(() => client.id),
  ruleId: text('rule_id').references(() => internalReminderRule.id),
  domain: text('domain', {
    enum: ['source_collection', 'bookkeeping_review', 'vat', 'payroll', 'filing_support'],
  }).notNull(),
  contextKey: text('context_key').notNull(),
  recipientType: text('recipient_type', { enum: ['staff', 'employee', 'email'] }).notNull().default('staff'),
  recipientRefId: text('recipient_ref_id'),
  recipientLabel: text('recipient_label').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  status: text('status', { enum: ['queued', 'sent', 'failed', 'skipped'] }).notNull(),
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  queuedAt: text('queued_at').notNull(),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  idempotencyUidx: uniqueIndex('internal_reminder_send_log_idempotency_uidx')
    .on(t.tenantId, t.clientId, t.idempotencyKey),
  statusIdx: index('internal_reminder_send_log_status_idx').on(t.tenantId, t.clientId, t.status),
  domainIdx: index('internal_reminder_send_log_domain_idx').on(t.tenantId, t.clientId, t.domain),
  ruleIdx: index('internal_reminder_send_log_rule_idx').on(t.tenantId, t.clientId, t.ruleId),
}))


// ---------------------------------------------------------------------------
// sample_dataset / sample_entity_ref
// 첫 가입 사용자가 빈 화면 대신 승인 Preview와 같은 학습용 업무 상태를 볼 수
// 있게 만드는 샘플 데이터 묶음과 삭제 레지스트리.
// ---------------------------------------------------------------------------
export const sampleDataset = sqliteTable('sample_dataset', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull(),
  source: text('source', { enum: ['first_run_onboarding', 'manual_retry'] }).notNull(),
  status: text('status', {
    enum: ['creating', 'active', 'delete_pending', 'deleted', 'failed'],
  }).notNull().default('creating'),
  seedVersion: text('seed_version').notNull(),
  periodKey: text('period_key').notNull().default('2026-H1'),
  payrollPeriodKey: text('payroll_period_key').notNull().default('2026-06'),
  createdByUserId: text('created_by_user_id'),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  scopeStatusIdx: index('sample_dataset_scope_status_idx').on(t.tenantId, t.clientId, t.status),
  tenantStatusIdx: index('sample_dataset_tenant_status_idx').on(t.tenantId, t.status),
}))

export const sampleEntityRef = sqliteTable('sample_entity_ref', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  clientId: text('client_id').notNull(),
  sampleDatasetId: text('sample_dataset_id').notNull().references(() => sampleDataset.id),
  entityTable: text('entity_table').notNull(),
  entityId: text('entity_id').notNull(),
  deleteOrder: integer('delete_order').notNull().default(100),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  entityUidx: uniqueIndex('sample_entity_ref_entity_uidx')
    .on(t.tenantId, t.clientId, t.sampleDatasetId, t.entityTable, t.entityId),
  datasetDeleteIdx: index('sample_entity_ref_dataset_delete_idx')
    .on(t.sampleDatasetId, t.deleteOrder),
  scopeIdx: index('sample_entity_ref_scope_idx').on(t.tenantId, t.clientId, t.sampleDatasetId),
}))

// ---------------------------------------------------------------------------
// consultation_source_cache
//   AI 전문 상담 Slice 1 — 공식 출처(law.go.kr) 응답 캐시.
//   law.go.kr 법령 데이터는 공개·비고객 기준자료라 모든 테넌트가 동일하게
//   참조한다. 따라서 tenant_id 격리 없이 query_hash 단위 전역 캐시로 둔다.
//   (참고: 69_AI_CONSULTATION_SLICE1_TECHNICAL_DESIGN.md §7-2)
// ---------------------------------------------------------------------------
export const consultationSourceCache = sqliteTable('consultation_source_cache', {
  id: text('id').primaryKey(),
  // SHA-256(`${source}:${normalizedQuery}`)
  queryHash: text('query_hash').notNull(),
  source: text('source', { enum: ['law'] }).notNull(),
  // 원본 검색어(question)는 사용자 자유입력이라 고객사·직원명 등 민감정보가
  // 섞일 수 있어 전역 캐시에 저장하지 않는다. 조회 키는 비가역 query_hash뿐.
  responseJson: text('response_json').notNull(), // JSON.stringify(NormalizedSource[])
  totalCount: integer('total_count').notNull(),
  cachedAt: text('cached_at').notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  uniqueIndex('consultation_source_cache_query_hash_uidx').on(table.queryHash),
  index('consultation_source_cache_expires_idx').on(table.expiresAt),
])

// ---------------------------------------------------------------------------
// 업무 메일함 Slice 2 — 정식 데이터 모델
//   주소 단위는 담당직원별 메일함(staff_mailbox). inbound_email은 메일함에 귀속하고
//   고객사는 담당직원이 붙이는 수동 라벨(client_label_id, nullable)로만 연결한다.
//   자동 매칭·세션 연결 없음. 첨부 바이너리 저장은 Slice 5(여기선 메타데이터만).
//   (참고: docs/03_Technical_Specs/25_WORK_EMAIL_INBOUND_SPEC.md §4)
// ---------------------------------------------------------------------------
// 2026-06-18 모델 변경: 메일주소는 사무소 소유 자산이고 currentStaffId는 "현재
// 배정된 담당자"일 뿐이다. 담당자가 비활성화되면 state만 handoff_required로
// 바뀌고 currentStaffId는 그대로 남아(이전 담당자 표시용) tenant admin이 새
// 담당자에게 인계(transfer)한다. (참고: docs/03_Technical_Specs/25_WORK_EMAIL_INBOUND_SPEC.md §3)
// ---------------------------------------------------------------------------
export const staffMailbox = sqliteTable('staff_mailbox', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  currentStaffId: text('current_staff_id').references(() => staff.id),
  alias: text('alias').notNull(), // local-part (예: 'kim')
  address: text('address').notNull(), // 전체 주소 (예: 'kim@jaaryo.online')
  state: text('state', { enum: ['reserved', 'active', 'paused', 'handoff_required', 'retired'] })
    .notNull()
    .default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('staff_mailbox_address_uidx').on(table.address),
  index('staff_mailbox_tenant_idx').on(table.tenantId),
])

export const staffMailboxAssignmentHistory = sqliteTable('staff_mailbox_assignment_history', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  staffMailboxId: text('staff_mailbox_id').notNull().references(() => staffMailbox.id),
  fromStaffId: text('from_staff_id'),
  toStaffId: text('to_staff_id'),
  action: text('action', {
    enum: ['created', 'assigned', 'transferred', 'paused', 'resumed', 'handoff_required', 'retired'],
  }).notNull(),
  reason: text('reason'),
  actorStaffId: text('actor_staff_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('staff_mailbox_assignment_history_mailbox_idx').on(table.staffMailboxId),
  index('staff_mailbox_assignment_history_tenant_idx').on(table.tenantId),
])

export const inboundEmail = sqliteTable('inbound_email', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  staffMailboxId: text('staff_mailbox_id').notNull().references(() => staffMailbox.id),
  provider: text('provider').notNull(), // 'resend'
  providerMessageId: text('provider_message_id').notNull(), // idempotency key (email_id)
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull().default('inbound'),
  fromEmail: text('from_email'),
  toEmail: text('to_email').notNull(), // 수신 메일함 주소
  ccEmail: text('cc_email'),
  subject: text('subject'),
  textBody: text('text_body'), // sanitized, 본문 조회 후 저장 (Slice 2+)
  htmlBody: text('html_body'),
  receivedAt: text('received_at'),
  // 담당직원이 수동으로 붙인 고객사 라벨 — 자동 매칭 없음.
  clientLabelId: text('client_label_id').references(() => client.id),
  processingStatus: text('processing_status', {
    enum: ['received', 'stored', 'held', 'ignored', 'failed'],
  }).notNull().default('stored'),
  rawPayloadHash: text('raw_payload_hash').notNull(), // raw payload 미저장, 감사용 hash만
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('inbound_email_provider_message_uidx').on(table.provider, table.providerMessageId),
  index('inbound_email_mailbox_idx').on(table.staffMailboxId),
  index('inbound_email_tenant_idx').on(table.tenantId),
  index('inbound_email_client_label_idx').on(table.clientLabelId),
])

export const inboundEmailAttachment = sqliteTable('inbound_email_attachment', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  inboundEmailId: text('inbound_email_id').notNull().references(() => inboundEmail.id),
  providerAttachmentId: text('provider_attachment_id'), // 다운로드용 식별자
  originalFilename: text('original_filename'),
  contentType: text('content_type'),
  fileSize: integer('file_size'),
  storageKey: text('storage_key'), // private storage key — 바이너리 다운로드는 Slice 5
  contentHash: text('content_hash'),
  status: text('status', { enum: ['stored', 'ignored', 'failed'] }).notNull().default('stored'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('inbound_email_attachment_email_idx').on(table.inboundEmailId),
  index('inbound_email_attachment_tenant_idx').on(table.tenantId),
])

// ---------------------------------------------------------------------------
// adaptive_structure_model  (Adaptive Data Structuring 공통 registry)
// 지금은 급여(target_workflow='payroll')만 이 단계까지 왔지만, 자료검토/기장도
// 같은 구조를 쓸 예정이라 워크플로우별 테이블로 나누지 않고 generic하게 둔다.
// model_json은 워크플로우별 contract(예: PayrollAdaptiveModelContract)를 그대로
// JSON.stringify한 것 — 워크플로우마다 shape이 다르므로 DB 레벨 스키마를 강제하지 않고
// 저장 직전 Zod 검증을 애플리케이션 레이어에서 보장한다.
// ---------------------------------------------------------------------------
export const adaptiveStructureModel = sqliteTable('adaptive_structure_model', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  name: text('name').notNull(),
  targetWorkflow: text('target_workflow').notNull(), // 'payroll' (추후 'bookkeeping' 등 확장)
  sourceClassification: text('source_classification').notNull().default('business_data'),
  status: text('status', {
    enum: ['draft', 'proposed', 'approved', 'rejected', 'retired'],
  }).notNull().default('proposed'),
  engineVersion: text('engine_version').notNull(),
  modelVersion: integer('model_version').notNull().default(1),
  modelJson: text('model_json').notNull(),
  sampleRowsPreviewJson: text('sample_rows_preview_json').notNull(), // 이미 redact·bound된 값만
  validationSummaryJson: text('validation_summary_json').notNull(), // {matched, blockedRowCount, blockers, warnings, evidence}
  promptVersion: text('prompt_version').notNull(),
  sourceUploadSessionId: text('source_upload_session_id').notNull().references(() => uploadSession.id),
  sourceUploadFileIds: text('source_upload_file_ids').notNull(), // JSON array of upload_file.id
  createdByStaffId: text('created_by_staff_id').notNull().references(() => staff.id),
  approvedByStaffId: text('approved_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  approvedAt: text('approved_at'),
  rejectedAt: text('rejected_at'),
  retiredAt: text('retired_at'),
}, (table) => [
  index('adaptive_structure_model_tenant_workflow_status_idx')
    .on(table.tenantId, table.targetWorkflow, table.status),
  index('adaptive_structure_model_source_session_idx').on(table.sourceUploadSessionId),
])

// ---------------------------------------------------------------------------
// adaptive_structure_model_run  (승인된 모델을 실제 세션에 적용해본 기록)
// 직원 row 원본은 저장하지 않는다 — 실제 데이터는 payroll_extraction_row에만 있고,
// 여기는 어떤 모델이 어떤 세션에 언제 어떤 결과로 적용됐는지 요약만 남긴다.
// model_id가 null인 경우는 승인된 모델이 2개 이상 동시에 매칭된 ambiguous case.
// ---------------------------------------------------------------------------
export const adaptiveStructureModelRun = sqliteTable('adaptive_structure_model_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  modelId: text('model_id').references(() => adaptiveStructureModel.id),
  uploadSessionId: text('upload_session_id').notNull().references(() => uploadSession.id),
  status: text('status', {
    enum: ['needs_review', 'extraction_blocked', 'failed'],
  }).notNull(),
  engineVersion: text('engine_version'),
  matchedRowCount: integer('matched_row_count').notNull().default(0),
  blockedRowCount: integer('blocked_row_count').notNull().default(0),
  warningsJson: text('warnings_json').notNull().default('[]'),
  blockersJson: text('blockers_json').notNull().default('[]'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('adaptive_structure_model_run_tenant_idx').on(table.tenantId),
  index('adaptive_structure_model_run_model_idx').on(table.modelId),
  index('adaptive_structure_model_run_session_idx').on(table.uploadSessionId),
])

export const reviewAttributionSavedPrompt = sqliteTable('review_attribution_saved_prompt', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenant.id),
  name: text('name').notNull(),
  description: text('description'),
  promptText: text('prompt_text').notNull(),
  compiledFilterJson: text('compiled_filter_json').notNull(),
  filterVersion: integer('filter_version').notNull().default(1),
  scope: text('scope', { enum: ['tenant'] }).notNull().default('tenant'),
  workType: text('work_type', { enum: ['bookkeeping'] }).notNull().default('bookkeeping'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdByStaffId: text('created_by_staff_id').references(() => staff.id),
  updatedByStaffId: text('updated_by_staff_id').references(() => staff.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('review_attr_saved_prompt_tenant_active_sort_idx').on(table.tenantId, table.isActive, table.sortOrder),
  index('review_attr_saved_prompt_tenant_name_idx').on(table.tenantId, table.name),
])

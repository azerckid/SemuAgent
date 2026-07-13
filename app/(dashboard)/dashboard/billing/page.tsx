import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, count, desc, eq } from 'drizzle-orm'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,
  Headphones,
  MailCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  BILLING_PLANS as BILLING_PLAN_DEFINITIONS,
  annualPriceLabel,
  billingPlanCodeSchema,
  formatKRW,
  getSuggestedBillingPlan,
  planLimitLabel,
  usagePercent,
  type BillingPlanDefinition,
} from '@/lib/billing/plans'
import { getBillingProfileStatus, getTenantBillingProfile } from '@/lib/billing/profile'
import { db } from '@/lib/db'
import {
  billingCustomer,
  billingInvoiceEvent,
  client,
  staff,
  tenant,
  tenantSubscription,
} from '@/lib/db/schema'
import { getTossBillingEnvOrNull } from '@/lib/env'
import { cn } from '@/lib/utils'
import { BillingProfileSection } from './_components/billing-profile-section'
import { TossBillingAuthButton } from './_components/toss-billing-auth-button'

type BillingPlan = Omit<BillingPlanDefinition, 'features'> & {
  features: Array<{ icon: LucideIcon; label: string }>
}

type BillingPageProps = {
  searchParams?: Promise<{
    plan?: string | string[]
  }>
}

const FEATURE_ICON_BY_LABEL: Record<string, LucideIcon> = {
  '관리 고객사 15개까지': Building2,
  '관리 고객사 60개까지': Building2,
  '관리 고객사 90개까지': Building2,
  '고객사 90개 초과': Building2,
  '월 33,000원 정액제(VAT 포함)': ReceiptText,
  '월 99,000원 정액제(VAT 포함)': ReceiptText,
  '월 148,500원 정액제(VAT 포함)': ReceiptText,
  '보안 업로드 포털': UploadCloud,
  'AI 누락 자료 판단': Sparkles,
  '담당자 승인 후 보충 요청': MailCheck,
  '기본 사용량 모니터링': Gauge,
  '정기/비정기 요청 운영': MailCheck,
  '고객사별 수신/참조 설정': Users,
  'AI 분석과 후속 메일 초안': Sparkles,
  'AI·메일 사용량 가드레일': Gauge,
  '유료 파일럿 전환 우선 기준': BadgeCheck,
  '다수 담당자 운영 규모': Users,
  '자료 요청·업로드량 확대': UploadCloud,
  'AI 분석 비용 가드레일 확대': Sparkles,
  '권한/보안 설계 우선 적용': ShieldCheck,
  '운영 지원 우선순위': Headphones,
  '맞춤 권한·보안 요구사항': ShieldCheck,
  '사무장/관리자 운영 구조 협의': Users,
  '세금계산서·계약 조건 협의': ReceiptText,
  '전담 온보딩과 운영 지원': Headphones,
}

const BILLING_PLANS: BillingPlan[] = BILLING_PLAN_DEFINITIONS.map((plan) => ({
  ...plan,
  features: plan.features.map((label) => ({
    label,
    icon: FEATURE_ICON_BY_LABEL[label] ?? CheckCircle2,
  })),
}))

const STORED_PLAN_LABEL: Record<string, string> = {
  free: '파일럿/미설정',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  manual_pilot: '수동 파일럿',
  pending_payment: '카드 등록/결제 대기',
  active: '활성',
  past_due: '결제 확인 필요',
  canceled: '해지',
}

function countValue(rows: Array<{ value: number }>) {
  return rows[0]?.value ?? 0
}

function planCardClasses(plan: BillingPlan, isSuggested: boolean, isSelected: boolean) {
  if (isSelected) return 'border-blue-500 bg-blue-50/40 shadow-sm ring-2 ring-blue-100'
  if (isSuggested) return 'border-blue-300 bg-blue-50/20 shadow-sm'
  return 'border-border bg-card'
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toManualSubscriptionSummary(
  record: Pick<
    typeof tenantSubscription.$inferSelect,
    'planCode' | 'status' | 'contractType' | 'provider'
  > | undefined,
) {
  if (!record || record.contractType !== 'manual_invoice') {
    return null
  }

  return {
    planCode: record.planCode,
    status: record.status,
    contractType: record.contractType,
    provider: record.provider,
  }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  let tenantId: string
  let currentUserId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    currentUserId = session.user.id
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      redirect('/sign-in')
    }
    redirect('/dashboard/clients')
  }

  const tenantRows = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
    })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  const tenantRecord = tenantRows[0]
  if (!tenantRecord) redirect('/dashboard/clients')

  const [clientCountRows, currentStaffRows, subscriptionRows, billingCustomerRows, latestEventRows, billingProfile] = await Promise.all([
    db.select({ value: count() }).from(client).where(eq(client.tenantId, tenantId)),
    db
      .select({ role: staff.role })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, currentUserId)))
      .limit(1),
    db
      .select({
        planCode: tenantSubscription.planCode,
        status: tenantSubscription.status,
        contractType: tenantSubscription.contractType,
        provider: tenantSubscription.provider,
      })
      .from(tenantSubscription)
      .where(eq(tenantSubscription.tenantId, tenantId))
      .limit(1),
    db
      .select({
        billingKeyIssuedAt: billingCustomer.billingKeyIssuedAt,
      })
      .from(billingCustomer)
      .where(and(eq(billingCustomer.tenantId, tenantId), eq(billingCustomer.provider, 'toss_payments')))
      .limit(1),
    db
      .select({
        eventType: billingInvoiceEvent.eventType,
        status: billingInvoiceEvent.status,
        occurredAt: billingInvoiceEvent.occurredAt,
      })
      .from(billingInvoiceEvent)
      .where(eq(billingInvoiceEvent.tenantId, tenantId))
      .orderBy(desc(billingInvoiceEvent.occurredAt))
      .limit(1),
    getTenantBillingProfile(tenantId),
  ])

  const managedClientCount = countValue(clientCountRows)
  const suggestedPlan = getSuggestedBillingPlan(managedClientCount)
  const planCards = BILLING_PLANS.filter((plan) => plan.code !== 'enterprise')
  const enterprisePlan = BILLING_PLANS.find((plan) => plan.code === 'enterprise')
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const planParam = firstSearchParam(resolvedSearchParams.plan)
  const parsedPlanCode = billingPlanCodeSchema.safeParse(planParam)
  const selectedPlan =
    planCards.find((plan) => parsedPlanCode.success && plan.code === parsedPlanCode.data) ??
    planCards.find((plan) => plan.code === suggestedPlan.code) ??
    planCards[planCards.length - 1]
  const currentRole = currentStaffRows[0]?.role ?? 'STAFF'
  const currentPlanLabel = STORED_PLAN_LABEL[tenantRecord.plan] ?? tenantRecord.plan
  const subscriptionRecord = subscriptionRows[0]
  const billingCustomerRecord = billingCustomerRows[0]
  const latestEvent = latestEventRows[0]
  const canManageBilling = currentRole === 'TENANT_ADMIN'
  const billingProfileStatus = getBillingProfileStatus(billingProfile)
  const billingProfileForClient = billingProfile
    ? {
        ...billingProfile,
        businessRegistrationNumber: canManageBilling
          ? billingProfile.businessRegistrationNumber
          : billingProfile.maskedBusinessRegistrationNumber,
      }
    : null
  let tossEnv = null
  try {
    tossEnv = getTossBillingEnvOrNull()
  } catch {
    tossEnv = null
  }
  const tossConfigured = tossEnv !== null
  const isTossTestMode = tossEnv?.TOSS_CLIENT_KEY.startsWith('test_') === true
  const tossAutoChargeEnabled = tossEnv?.TOSS_BILLING_AUTO_CHARGE_ENABLED === true
  const billingButtonDisabledReason = !canManageBilling
    ? 'TENANT_ADMIN 권한에서만 카드 등록을 시작할 수 있습니다.'
    : !tossConfigured
      ? 'TOSS_BILLING_ENABLED와 Toss test key 설정 후 사용할 수 있습니다.'
      : undefined

  return (
    <div className="min-w-[980px] space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">요금제</h1>
            <Badge variant={tossConfigured ? 'success' : 'warning'}>
              {tossConfigured ? 'Toss 준비됨' : 'Toss env 필요'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {tenantRecord.name}의 가격 정책, 사용량 기준, Toss 정기결제 준비 상태를 확인합니다.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            현재 플랜 {currentPlanLabel} · 결제 관리는 관리자 권한에서만 가능합니다.
          </p>
        </div>
        <Link
          href="/dashboard/clients"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
        >
          고객사 관리
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="space-y-6">
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-foreground">요금제 선택 기준</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              고객사 관리 규모에 따른 월 정액제입니다. Starter 33,000원(15개), Growth 99,000원(60개), Pro 148,500원(90개)이며, 금액은 VAT 포함입니다.
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              월 정액 기준 · 15개 / 60개 / 90개 단위 선택
            </p>
          </div>

          <div className="grid items-stretch gap-5 xl:grid-cols-3">
            {planCards.map((plan) => {
              const isSuggested = plan.code === suggestedPlan.code
              const isSelected = plan.code === selectedPlan.code
              return (
                <Link
                  key={plan.code}
                  href={`/dashboard/billing?plan=${plan.code}`}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'block h-full rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                    isSelected ? 'cursor-default' : 'hover:-translate-y-0.5 hover:shadow-md',
                  )}
                >
                  <Card
                    className={cn(
                      'flex h-full min-h-[560px] flex-col gap-6 rounded-lg px-5 py-7',
                      planCardClasses(plan, isSuggested, isSelected),
                    )}
                  >
                    <CardHeader className="gap-5 px-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-3xl font-semibold">{plan.name}</CardTitle>
                          <CardDescription className="mt-4 min-h-10 text-base font-medium text-foreground">
                            {plan.description}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isSuggested && <Badge variant="info">추천</Badge>}
                          {isSelected && <Badge variant="success">선택됨</Badge>}
                        </div>
                      </div>
                      <div>
                        <p className="flex min-h-14 flex-wrap items-baseline gap-x-2 gap-y-1 text-4xl font-semibold leading-none text-foreground 2xl:text-5xl">
                          {plan.monthlyPriceKrw === null ? (
                            <span className="text-3xl">별도 견적</span>
                          ) : (
                            <>
                              <span className="text-lg text-muted-foreground">₩</span>
                              {formatKRW(plan.monthlyPriceKrw).replace('원', '')}
                            </>
                          )}
                          {plan.monthlyPriceKrw !== null && (
                            <span className="text-sm font-normal leading-5 text-muted-foreground">
                              원 / 월
                            </span>
                          )}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          연간 결제: {annualPriceLabel(plan.monthlyPriceKrw)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'flex h-11 items-center justify-center rounded-full border text-sm font-semibold',
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : isSuggested
                              ? 'border-transparent bg-foreground text-background'
                              : 'border-border bg-background text-foreground',
                        )}
                      >
                        {isSelected ? '선택됨' : `${plan.actionLabel} 선택`}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col space-y-5 px-0">
                      <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">현재 사용량</span>
                          <span className="font-medium text-foreground">
                            {managedClientCount}개 / {planLimitLabel(plan)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              isSelected || isSuggested ? 'bg-blue-600' : 'bg-muted-foreground/30',
                            )}
                            style={{ width: `${usagePercent(managedClientCount, plan)}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-auto space-y-4">
                        {plan.featureHeading && (
                          <p className="text-sm font-semibold text-foreground">{plan.featureHeading}</p>
                        )}
                        <ul className="space-y-4">
                          {plan.features.map((feature) => {
                            const Icon = feature.icon
                            return (
                              <li key={feature.label} className="flex items-start gap-3 text-sm text-foreground">
                                <Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                                <span>{feature.label}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {enterprisePlan && (
            <section className="rounded-lg border border-border bg-muted/30 px-6 py-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">{enterprisePlan.name}</h3>
                    <Badge variant="secondary">별도 협의</Badge>
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {enterprisePlan.description}. 고객사 90개를 초과하거나 보안·권한·운영 지원을 별도로
                    설계해야 하는 사무소는 카드형 요금제가 아니라 계약 조건을 따로 정합니다.
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-foreground sm:grid-cols-2 xl:min-w-[520px]">
                  {enterprisePlan.features.map((feature) => {
                    const Icon = feature.icon
                    return (
                      <div key={feature.label} className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span>{feature.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}
        </section>

        <div className="grid gap-4">
          <BillingProfileSection
            canManageBilling={canManageBilling}
            initialProfile={billingProfileForClient}
            initialStatus={billingProfileStatus}
            selectedPlanCode={selectedPlan.code}
            selectedPlanName={selectedPlan.name}
            selectedPlanMonthlyPriceKrw={selectedPlan.monthlyPriceKrw}
            manualSubscription={toManualSubscriptionSummary(subscriptionRecord)}
          />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-amber-600" />
                <CardTitle>Toss 정기결제 준비</CardTitle>
              </div>
              <CardDescription>국내용 카드 자동결제 기준</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs">Provider</p>
                  <p className="font-medium text-foreground">
                    Toss Payments{isTossTestMode ? ' · 테스트 모드' : ''}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs">자동 과금</p>
                  <p className="font-medium text-foreground">
                    {tossAutoChargeEnabled ? '활성' : '비활성'}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs">구독 상태</p>
                  <p className="font-medium text-foreground">
                    {subscriptionRecord
                      ? SUBSCRIPTION_STATUS_LABEL[subscriptionRecord.status] ?? subscriptionRecord.status
                      : '미등록'}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs">카드 등록</p>
                  <p className="font-medium text-foreground">
                    {billingCustomerRecord?.billingKeyIssuedAt ? '완료' : '미등록'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p>
                  {isTossTestMode
                    ? '테스트 키 환경에서는 실제 발급 카드로 빌링키 등록을 검증할 수 있으며 실제 과금은 발생하지 않습니다.'
                    : '카드 등록과 빌링키 저장을 검증할 수 있습니다. 자동 과금은 운영 승인 env로만 실행됩니다.'}
                </p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p>카카오페이·네이버페이는 일반 간편결제 영역이며, 월 정기결제는 Toss 카드 빌링키를 기준으로 준비합니다.</p>
              </div>
              {latestEvent && (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  최근 이벤트: {latestEvent.eventType} · {latestEvent.status} · {latestEvent.occurredAt}
                </div>
              )}
              <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                선택 플랜: {selectedPlan.name} · {formatKRW(selectedPlan.monthlyPriceKrw)}/월
              </div>
              <TossBillingAuthButton
                planCode={selectedPlan.code}
                disabled={!tossConfigured || !canManageBilling}
                disabledReason={billingButtonDisabledReason}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

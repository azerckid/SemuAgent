import { asc, eq } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import { client, tenant } from '@/lib/db/schema'
import {
  loadInternalReminderAttentionItems,
  type InternalReminderAttention,
  type InternalReminderDomain,
} from '@/lib/internal-reminders/summary'
import { loadPaymentStatementAttentionCount } from '@/lib/payment-statements/summary'
import { expandTaxSchedulesForMonth } from '@/lib/tax-calendar'
import { now } from '@/lib/time'
import type { TaxEntityType } from '@/lib/validations/business-entity'
import { loadVatSummary } from '@/lib/vat/summary'

const DEFAULT_TZ = 'Asia/Seoul'

// ---------------------------------------------------------------------------
// JC-029 신고 준비 허브 read model — read-only 집계. 신규 테이블/엔진/세액계산 없음.
// 기존 도메인 요약(자료수집·기장·부가세·급여·신고지원)을 집계·재프레임한다.
// ---------------------------------------------------------------------------

export type FilingPrepTone = 'ok' | 'warn' | 'danger' | 'plan' | 'muted'
// 사업장 taxEntityType(개인/법인/면세) + 미지정(unknown → 흐림 없음).
export type FilingPrepBusinessType = TaxEntityType | 'unknown'
export type FilingPrepTrackId = 'withholding' | 'vat' | 'payment_statement' | 'local_income'
export type FilingPrepTrackStatus = 'live' | 'roadmap'

export type FilingPrepBlocker = {
  domain: InternalReminderDomain
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}

export type FilingPrepFoundationCard = {
  id: 'source_collection' | 'bookkeeping_review'
  title: string
  description: string
  chipLabel: string
  chipTone: FilingPrepTone
  output: string
  href: string
}

export type FilingPrepTrackCard = {
  id: FilingPrepTrackId
  title: string
  cycle: string
  chipLabel: string
  chipTone: FilingPrepTone
  status: FilingPrepTrackStatus
  applicable: boolean
  inapplicableReason: string | null
  input: string
  output: string
  handoffLabel: string
  href: string | null
}

export type FilingPrepScheduleItem = {
  id: string
  dDay: number
  dateLabel: string
  title: string
  category: string
  soon: boolean
}

export type FilingPrepSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string; businessType: FilingPrepBusinessType } | null
  period: CompanyHomePeriod
  hero: {
    readinessPercent: number
    attentionCount: number
    handoffReadyCount: number
  }
  blockers: FilingPrepBlocker[]
  foundation: FilingPrepFoundationCard[]
  tracks: FilingPrepTrackCard[]
  schedule: FilingPrepScheduleItem[]
}

// 공통 기반 + 라이브 트랙으로 준비율을 계산할 때 고려하는 도메인.
const READINESS_DOMAINS: InternalReminderDomain[] = [
  'source_collection',
  'bookkeeping_review',
  'vat',
  'payroll',
]

const BLOCKER_META: Record<InternalReminderDomain, { href: string; ctaLabel: string } | null> = {
  source_collection: { href: '/dashboard/direct-upload', ctaLabel: '자료수집 열기' },
  bookkeeping_review: { href: '/dashboard/bookkeeping', ctaLabel: '기장검토 열기' },
  vat: { href: '/dashboard/vat', ctaLabel: '부가세 열기' },
  payroll: { href: '/dashboard/payroll', ctaLabel: '급여 열기' },
  filing_support: { href: '/dashboard/filing-support', ctaLabel: '신고지원 열기' },
}

// ---------------------------------------------------------------------------
// 순수 함수 (단위 테스트 대상)
// ---------------------------------------------------------------------------

export function businessTypeLabel(type: FilingPrepBusinessType): string {
  if (type === 'corporation') return '법인'
  if (type === 'tax_exempt') return '면세 개인'
  if (type === 'individual') return '개인'
  return '미지정'
}

// v1: 면세 개인사업자는 부가세 트랙이 해당 없음(사업장현황신고로 대체·JC-028).
// 그 외 트랙과 unknown 유형은 전부 해당(흐림 없음).
export function isTrackApplicable(trackId: FilingPrepTrackId, type: FilingPrepBusinessType): boolean {
  if (trackId === 'vat' && type === 'tax_exempt') return false
  return true
}

export function inapplicableReasonFor(trackId: FilingPrepTrackId, type: FilingPrepBusinessType): string | null {
  if (isTrackApplicable(trackId, type)) return null
  if (trackId === 'vat' && type === 'tax_exempt') return '면세 사업자 · 사업장현황신고로 대체'
  return '해당 없음'
}

// 준비율 = 공통 기반+라이브 트랙(자료수집·기장·부가세·급여) 중 확인 필요가 없는 비율(파생, 저장 없음).
export function buildFilingPreparationReadiness(attentions: InternalReminderAttention[]): number {
  const considered = attentions.filter((item) => READINESS_DOMAINS.includes(item.domain))
  if (considered.length === 0) return 0
  const prepared = considered.filter((item) => item.count === 0).length
  return Math.round((prepared / considered.length) * 100)
}

export function buildFilingPreparationBlockers(attentions: InternalReminderAttention[]): FilingPrepBlocker[] {
  return attentions
    .filter((item) => item.count > 0 && BLOCKER_META[item.domain])
    .map((item) => {
      const meta = BLOCKER_META[item.domain]!
      return {
        domain: item.domain,
        title: item.label,
        description: `${meta.ctaLabel.replace(' 열기', '')}에서 확인 필요 항목을 처리하세요.`,
        tone: item.domain === 'vat' ? 'danger' : 'warn',
        href: meta.href,
        ctaLabel: meta.ctaLabel,
      } satisfies FilingPrepBlocker
    })
}

function attentionByDomain(attentions: InternalReminderAttention[], domain: InternalReminderDomain) {
  return attentions.find((item) => item.domain === domain)
}

// ---------------------------------------------------------------------------
// Read model 로더
// ---------------------------------------------------------------------------

type LoadFilingPrepParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

export async function loadFilingPreparationSummary({
  tenantId,
  periodKey,
  today,
}: LoadFilingPrepParams): Promise<FilingPrepSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const period = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })

  // 사업자 유형은 사업장(client.taxEntityType, JC-032) 필드에서 직접 읽는다.
  // 미지정(null)이면 unknown → 어떤 트랙도 흐림 처리하지 않는다(과잉 숨김 방지).
  const businessEntityRows = await db
    .select({ id: client.id, name: client.name, taxEntityType: client.taxEntityType })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const entityRow = businessEntityRows[0] ?? null
  const businessType: FilingPrepBusinessType = entityRow?.taxEntityType ?? 'unknown'

  const base = {
    tenant: tenantRow,
    businessEntity: entityRow
      ? { id: entityRow.id, name: entityRow.name, businessType }
      : null,
    period,
  }

  if (!entityRow) {
    return {
      ...base,
      hero: { readinessPercent: 0, attentionCount: 0, handoffReadyCount: 0 },
      blockers: [],
      foundation: [],
      tracks: [],
      schedule: buildUpcomingSchedule(today ?? now(tenantRow.timezone)),
    }
  }

  const [attentions, vat, paymentStatement] = await Promise.all([
    loadInternalReminderAttentionItems({ tenantId, periodKey, today }),
    loadVatSummary({ tenantId, periodKey, today }),
    loadPaymentStatementAttentionCount(tenantId),
  ])

  const blockers = buildFilingPreparationBlockers(attentions)
  const readinessPercent = buildFilingPreparationReadiness(attentions)
  const tracks = buildTracks(attentions, vat.taxSummary, businessType, paymentStatement)
  const handoffReadyCount = tracks.filter(
    (track) => track.status === 'live' && track.applicable && track.chipTone === 'ok',
  ).length

  return {
    ...base,
    hero: {
      readinessPercent,
      attentionCount: blockers.length,
      handoffReadyCount,
    },
    blockers,
    foundation: buildFoundation(attentions),
    tracks,
    schedule: buildUpcomingSchedule(today ?? now(tenantRow.timezone)),
  }
}

// 사이드바 badge용 경량 카운트(확인 필요 blocker 수).
export async function loadFilingPreparationAttentionCount(tenantId: string): Promise<number> {
  const attentions = await loadInternalReminderAttentionItems({ tenantId })
  return buildFilingPreparationBlockers(attentions).length
}

function buildFoundation(attentions: InternalReminderAttention[]): FilingPrepFoundationCard[] {
  const source = attentionByDomain(attentions, 'source_collection')
  const bookkeeping = attentionByDomain(attentions, 'bookkeeping_review')
  return [
    {
      id: 'source_collection',
      title: '자료수집',
      description: '회사 자료 업로드·파싱·정규화·누락 확인',
      chipLabel: source && source.count > 0 ? source.label : '수집 완료',
      chipTone: source && source.count > 0 ? 'warn' : 'ok',
      output: '수집 현황과 누락 목록은 자료수집 화면에서 확인합니다.',
      href: '/dashboard/direct-upload',
    },
    {
      id: 'bookkeeping_review',
      title: '기장검토',
      description: '귀속월 확정·중복제거·계정분류 후보 검토',
      chipLabel: bookkeeping && bookkeeping.count > 0 ? bookkeeping.label : '원장 준비',
      chipTone: bookkeeping && bookkeeping.count > 0 ? 'warn' : 'ok',
      output: '확정 거래원장은 모든 신고 트랙의 소스가 됩니다.',
      href: '/dashboard/bookkeeping',
    },
  ]
}

export function buildTracks(
  attentions: InternalReminderAttention[],
  vatTax: { outputTaxKrw: number; inputTaxKrw: number; pendingDeductionCount: number },
  type: FilingPrepBusinessType,
  paymentStatement?: { total: number; attention: number },
): FilingPrepTrackCard[] {
  const payroll = attentionByDomain(attentions, 'payroll')

  const withholdingApplicable = isTrackApplicable('withholding', type)
  const vatApplicable = isTrackApplicable('vat', type)

  return [
    {
      id: 'withholding',
      title: '원천세',
      cycle: '매월 10일 · 급여/지급내역 기반',
      chipLabel: !withholdingApplicable ? '해당 없음' : payroll && payroll.count > 0 ? payroll.label : '수치 준비',
      chipTone: !withholdingApplicable ? 'muted' : payroll && payroll.count > 0 ? 'warn' : 'ok',
      status: 'live',
      applicable: withholdingApplicable,
      inapplicableReason: inapplicableReasonFor('withholding', type),
      input: '급여대장 · 지급내역 · 4대보험 고지액',
      output: '간이세액표 집계 · 원천세 신고서 초안 수치',
      handoffLabel: 'handoff: 신고지원 원천세 항목',
      href: withholdingApplicable ? '/dashboard/filing-support' : null,
    },
    {
      id: 'vat',
      title: '부가세',
      cycle: '분기 · 매출/매입 세금계산서 기반',
      chipLabel: !vatApplicable
        ? '해당 없음'
        : vatTax.pendingDeductionCount > 0
          ? `검토 ${vatTax.pendingDeductionCount}건`
          : '초안 준비',
      chipTone: !vatApplicable ? 'muted' : vatTax.pendingDeductionCount > 0 ? 'danger' : 'ok',
      status: 'live',
      applicable: vatApplicable,
      inapplicableReason: inapplicableReasonFor('vat', type),
      input: '매출·매입 세금계산서 · 확정 거래원장',
      output: vatApplicable
        ? `매출세액 ${formatKrw(vatTax.outputTaxKrw)} · 매입세액 ${formatKrw(vatTax.inputTaxKrw)}`
        : '면세 사업자는 부가세 신고 대상이 아닙니다.',
      handoffLabel: 'handoff: 부가세 초안값 + 공제 검토 결과',
      href: vatApplicable ? '/dashboard/vat' : null,
    },
    {
      id: 'payment_statement',
      title: '지급명세서 · 연말정산',
      cycle: '월/반기/연 · 급여/직원 명부 기반',
      chipLabel: !paymentStatement
        ? 'JC-024'
        : paymentStatement.attention > 0
          ? `확인 ${paymentStatement.attention}명`
          : paymentStatement.total > 0 ? '데이터 준비' : '대상 없음',
      chipTone: !paymentStatement ? 'plan' : paymentStatement.attention > 0 ? 'warn' : 'ok',
      status: paymentStatement ? 'live' : 'roadmap',
      applicable: isTrackApplicable('payment_statement', type),
      inapplicableReason: inapplicableReasonFor('payment_statement', type),
      input: '연간 급여·지급내역 · 직원 명부',
      output: '간이지급명세서 반기 집계 · 연말정산 준비 데이터 · 누락/검토 상태',
      handoffLabel: 'handoff: 신고 준비 데이터 확인 후 JC-030 파일 생성으로 연결',
      href: paymentStatement && isTrackApplicable('payment_statement', type)
        ? '/dashboard/filing-preparation/payment-statements'
        : null,
    },
    {
      id: 'local_income',
      title: '지방소득세',
      cycle: '본세 종속 · 원천세/소득세/법인세 연동',
      chipLabel: 'JC-027',
      chipTone: 'plan',
      status: 'roadmap',
      applicable: isTrackApplicable('local_income', type),
      inapplicableReason: inapplicableReasonFor('local_income', type),
      input: '확정 본세 · 원천세 · 사업장/지자체 정보',
      output: '안분 · 세액 · 지방세 신고 수치',
      handoffLabel: 'handoff: 위택스/지방세 직접 신고 수치',
      href: null,
    },
  ]
}

// 다가오는 세무 일정(보조 섹션): tax-calendar에서 이번 달·다음 달 마감 중 미래 3건.
export function buildUpcomingSchedule(today: DateTime, limit = 3): FilingPrepScheduleItem[] {
  const start = today.startOf('day')
  const nextMonth = today.plus({ months: 1 })
  const occurrences = [
    ...expandTaxSchedulesForMonth(today.year, today.month),
    ...expandTaxSchedulesForMonth(nextMonth.year, nextMonth.month),
  ]

  return occurrences
    .filter((occ) => occ.date.startOf('day') >= start)
    .slice(0, limit)
    .map((occ) => {
      const dDay = Math.ceil(occ.date.startOf('day').diff(start, 'days').days)
      return {
        id: `${occ.id}-${occ.dateISO}`,
        dDay,
        dateLabel: `${occ.date.month}/${occ.date.day}`,
        title: occ.title,
        category: occ.category,
        soon: dDay <= 7,
      } satisfies FilingPrepScheduleItem
    })
}

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value)
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { fromISO } from '@/lib/time'
import { getJaryoAdminTenantDetail } from '@/lib/jaryo-admin/tenant-queries'
import {
  contractTypeLabel,
  invoiceEventStatusBadgeVariant,
  subscriptionStatusBadgeVariant,
  subscriptionStatusLabel,
  webhookEventStatusBadgeVariant,
} from '../../_components/tenant-status-labels'

const paramsSchema = z.object({
  id: z.string().min(1),
})

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('yyyy-MM-dd') : value.slice(0, 10)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('yyyy-MM-dd HH:mm') : value
}

function formatAmount(value: number | null) {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`
}

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="min-h-24 border-r border-slate-200 p-5 last:border-r-0">
      <div className="text-xs font-extrabold text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-extrabold text-slate-950">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</div> : null}
    </div>
  )
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default async function JaryoAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) notFound()

  const detail = await getJaryoAdminTenantDetail(parsed.data.id)
  if (!detail) notFound()

  const activeStaffCount = detail.staff.filter((member) => member.active).length
  const inactiveStaffCount = detail.staff.length - activeStaffCount

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Link href="/jaryo-admin/tenants" className="text-blue-600 hover:underline">
          회원사 관리
        </Link>
        <span>/</span>
        <span>{detail.name}</span>
      </div>

      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-normal text-slate-950">{detail.name}</h1>
            <Badge variant="info">tenant detail</Badge>
            <Badge variant={subscriptionStatusBadgeVariant(detail.subscriptionStatus)}>
              {subscriptionStatusLabel(detail.subscriptionStatus)}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            운영자가 보는 회원사 상세입니다. 고객 원본 파일, 급여 row, 기장 거래 row, 사업자번호 전체값은 표시하지 않습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/jaryo-admin/tenants"
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            목록으로
          </Link>
          <button
            type="button"
            disabled
            className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-400"
          >
            운영 메모 추가
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-bold text-slate-400"
          >
            결제 액션 없음 V1
          </button>
        </div>
      </div>

      <section className="mb-5 grid overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-5">
        <InfoCard label="상업 플랜" value={detail.plan} hint="tenant_subscription.plan_code 우선" />
        <InfoCard label="구독 상태" value={subscriptionStatusLabel(detail.subscriptionStatus)} hint={contractTypeLabel(detail.contractType)} />
        <InfoCard label="청구정보" value={detail.hasBillingProfile ? '완료' : '미완성'} hint="PII 필드 미조회" />
        <InfoCard label="회원 / Staff" value={`${detail.staff.length}명`} hint={`${activeStaffCount} active · ${inactiveStaffCount} inactive`} />
        <InfoCard label="다음 작업" value={detail.nextAction} hint="목록과 같은 기준" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <Section
            title="운영 판단"
            description="목록으로 돌아가지 않아도 이 회원사의 다음 확인 지점을 바로 볼 수 있게 둡니다."
            action={<Badge variant="outline">read-only v1</Badge>}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-extrabold text-slate-950">{detail.nextAction}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  운영자가 다음으로 확인해야 하는 항목입니다. 실제 변경 액션은 감사 로그가 준비된 뒤 추가합니다.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-extrabold text-slate-950">보안 경계 정상</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  원본 파일명, 고객 식별번호, provider payload는 이 화면에서 노출하지 않습니다.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-950">사용량 관찰</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  업로드 세션, AI run, 메일 사용량은 후속 슬라이스에서 실제 지표로 연결합니다.
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="구독 / Billing"
            description="계약 타입, 결제 상태, 최근 invoice·webhook 이벤트만 표시합니다."
            action={<Badge variant="warning">payment action disabled</Badge>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-extrabold text-slate-500">계약 타입</div>
                <div className="mt-2 text-base font-extrabold text-slate-950">{contractTypeLabel(detail.contractType)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-extrabold text-slate-500">다음 결제일</div>
                <div className="mt-2 text-base font-extrabold text-slate-950">{formatDate(detail.billing.nextBillingAt)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-extrabold text-slate-500">현재 결제 주기 종료</div>
                <div className="mt-2 text-base font-extrabold text-slate-950">{formatDate(detail.billing.currentPeriodEnd)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-extrabold text-slate-500">최근 webhook</div>
                <div className="mt-2 text-base font-extrabold text-slate-950">
                  {detail.billing.recentWebhookEvents[0]?.status ?? '최근 이벤트 없음'}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-extrabold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">일시</th>
                    <th className="px-4 py-3">이벤트</th>
                    <th className="px-4 py-3">금액</th>
                    <th className="px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.billing.recentInvoiceEvents.map((event, index) => (
                    <tr key={`invoice-${index}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatDate(event.occurredAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-950">{event.eventType}</div>
                        <div className="text-xs text-slate-500">invoice event</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{formatAmount(event.amountKrw)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={invoiceEventStatusBadgeVariant(event.status)}>{event.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {detail.billing.recentWebhookEvents.map((event, index) => (
                    <tr key={`webhook-${index}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatDate(event.receivedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-950">{event.eventType}</div>
                        <div className="text-xs text-slate-500">webhook event</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3">
                        <Badge variant={webhookEventStatusBadgeVariant(event.status)}>{event.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {detail.billing.recentInvoiceEvents.length === 0 && detail.billing.recentWebhookEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                        최근 invoice/webhook 이벤트가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="회원 / Staff"
            description="운영자가 연락·권한 상태를 판단하는 데 필요한 계정 단위 정보만 표시합니다."
            action={<Badge variant="outline">{detail.staff.length} total</Badge>}
          >
            <div className="-m-5 overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-extrabold text-slate-500">
                  <tr>
                    <th className="px-5 py-3">이름</th>
                    <th className="px-5 py-3">이메일</th>
                    <th className="px-5 py-3">역할</th>
                    <th className="px-5 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.staff.map((member) => (
                    <tr key={member.id} className="border-t border-slate-200">
                      <td className="px-5 py-4 font-extrabold text-slate-950">{member.name}</td>
                      <td className="px-5 py-4 text-slate-600">{member.email}</td>
                      <td className="px-5 py-4">
                        <Badge variant={member.role === 'TENANT_ADMIN' ? 'info' : 'outline'}>{member.role}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={member.active ? 'success' : 'outline'}>{member.active ? 'active' : 'inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                  {detail.staff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                        등록된 staff가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="grid gap-5 self-start xl:sticky xl:top-6">
          <Section title="사용량 요약" description="청구/지원 판단에 필요한 상위 지표만 둡니다.">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-500">관리 고객사</dt>
                <dd className="font-extrabold text-slate-950">{detail.clientCount}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-500">활성 직원</dt>
                <dd className="font-extrabold text-slate-950">{activeStaffCount}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-500">가입일</dt>
                <dd className="font-extrabold text-slate-950">{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">일반업무메일</dt>
                <dd className="font-extrabold text-slate-950">도메인 설정 대기</dd>
              </div>
            </dl>
          </Section>

          <Section title="운영 제한 / 주의" description="액션 가능한 것과 아직 막아둔 것을 분리합니다.">
            <div className="grid gap-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-extrabold text-slate-950">고위험 작업 비활성</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  charge/refund/cancel/change-plan은 아직 제공하지 않습니다.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-extrabold text-slate-950">파일 원문 미노출</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  고객 파일명·급여 row·기장 거래 row는 요약에도 포함하지 않습니다.
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="운영 메모"
            description="Slice 4에서 편집·감사 로그로 연결합니다."
            action={<Badge variant="outline">later slice</Badge>}
          >
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
              운영 메모와 Audit trail은 다음 슬라이스에서 연결합니다. 지금은 읽기 전용 상세 확인만 제공합니다.
            </div>
          </Section>
        </aside>
      </div>
    </div>
  )
}

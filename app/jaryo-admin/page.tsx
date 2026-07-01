import Link from 'next/link'
import { countJaryoAdminTenantsByView, countJaryoAdminWebhookFailures } from '@/lib/jaryo-admin/tenant-queries'

export default async function JaryoAdminPage() {
  const [paymentIssueCount, billingProfileMissingCount, renewalUpcomingCount, webhookFailureCount] = await Promise.all([
    countJaryoAdminTenantsByView('payment_issue'),
    countJaryoAdminTenantsByView('billing_profile_missing'),
    countJaryoAdminTenantsByView('renewal_upcoming'),
    countJaryoAdminWebhookFailures(),
  ])

  const liveQueueItems = [
    {
      title: '결제 실패 / 연체',
      count: paymentIssueCount,
      description: 'subscription.status = past_due',
      href: '/jaryo-admin/tenants?view=payment_issue',
    },
    {
      title: '청구정보 미완성',
      count: billingProfileMissingCount,
      description: '세금계산서 이메일·사업자 정보가 등록되지 않은 tenant',
      href: '/jaryo-admin/tenants?view=billing_profile_missing',
    },
    {
      title: '갱신 임박',
      count: renewalUpcomingCount,
      description: '자동 결제 tenant 중 다음 결제일이 7일 이내',
      href: '/jaryo-admin/tenants?view=renewal_upcoming',
    },
    {
      title: '웹훅 처리 실패',
      count: webhookFailureCount,
      description: '최근 30일 내 실패한 결제 webhook',
      href: null,
    },
  ] as const

  const laterQueueItems = [
    ['온보딩 중단', '정지 판단 기준(기간/조건)이 정해진 뒤 표시합니다.'],
  ] as const

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-blue-600">
            Service Operator Console
          </div>
          <h1 className="text-2xl font-extrabold tracking-normal text-slate-950">JARYO Admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            회원사 관리, 회원/계정, 매출 현황까지 연결되었습니다. 청구/구독 전용 화면과 메모/Audit는 이후 슬라이스에서 연결됩니다.
          </p>
        </div>
        <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          이 화면은 JARYO 운영자 전용입니다. 회계사무소의 TENANT_ADMIN 권한으로는 접근할 수
          없고, 고객 원본 파일·급여 row·기장 거래 row는 v1에서 노출하지 않습니다.
        </div>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {liveQueueItems.map((item) =>
          item.href ? (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm"
            >
              <div className="text-sm font-extrabold text-slate-900">{item.title}</div>
              <div className="mt-3 text-3xl font-extrabold text-slate-950">{item.count}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">{item.description}</div>
            </Link>
          ) : (
            <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-extrabold text-slate-900">{item.title}</div>
              <div className="mt-3 text-3xl font-extrabold text-slate-950">{item.count}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">{item.description}</div>
            </div>
          ),
        )}
        {laterQueueItems.map(([title, description]) => (
          <div key={title} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-500">{title}</div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                later slice
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-300">—</div>
            <div className="mt-2 text-xs leading-relaxed text-slate-400">{description}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-extrabold text-slate-950">회원사 관리</h2>
        <p className="mt-1 text-sm text-slate-600">
          검색, 저장된 보기, 서버 페이지네이션, 회원사 상세 화면은 회원사 관리에서 확인합니다.
        </p>
        <Link
          href="/jaryo-admin/tenants"
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
        >
          회원사 관리 열기
        </Link>
      </section>
    </div>
  )
}

import { requireJaryoAdminSession } from '@/lib/jaryo-admin/auth'
import { JaryoAdminNavLink } from './_components/jaryo-admin-nav-link'

const implementedNavItems = [
  ['운영 요약', '오늘 처리할 큐와 핵심 지표', '/jaryo-admin'],
  ['회원사 관리', '검색, 필터, 회원사 상세 화면', '/jaryo-admin/tenants'],
  ['회원 / 계정', '이메일 검색, 소속 회원사, 최근 로그인', '/jaryo-admin/members'],
  ['매출 현황', '결제 완료/실패 금액, 플랜·결제방식별 분포', '/jaryo-admin/revenue'],
] as const

const plannedNavItems = [
  ['청구 / 구독', '청구정보, invoice, webhook'],
  ['이벤트 / 웰컴', '할인 이벤트, 웰컴 모달 게시'],
  ['메모 / Audit', '지원 메모와 운영자 작업 기록'],
  ['권한 / 보안', 'operator allowlist, 접근 경계'],
] as const

export default async function JaryoAdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireJaryoAdminSession()

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-950">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 px-5 py-6 text-slate-200 lg:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
            JA
          </div>
          <div>
            <div className="text-base font-extrabold leading-tight text-white">JARYO Admin</div>
            <div className="mt-0.5 text-xs text-slate-400">Service operator</div>
          </div>
        </div>

        <nav className="grid gap-1">
          <div className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            JARYO 운영
          </div>
          {implementedNavItems.map(([label, description, href]) => (
            <JaryoAdminNavLink key={label} href={href}>
              <span>
                <span className="block font-bold leading-tight">{label}</span>
                <span className="mt-1 block text-xs leading-snug text-slate-400">{description}</span>
              </span>
            </JaryoAdminNavLink>
          ))}
          {plannedNavItems.map(([label, description]) => (
            <div
              key={label}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500"
            >
              <span>
                <span className="block font-bold leading-tight">{label}</span>
                <span className="mt-1 block text-xs leading-snug text-slate-500">{description}</span>
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-400">later slice</span>
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-slate-900/70 p-3">
          <div className="text-sm font-bold text-white">JARYO 운영자</div>
          <div className="mt-1 break-all text-xs text-slate-400">{user.email}</div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}

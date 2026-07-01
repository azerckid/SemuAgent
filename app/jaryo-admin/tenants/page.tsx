import Link from 'next/link'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  JARYO_ADMIN_TENANT_PAGE_SIZE,
  listJaryoAdminTenants,
} from '@/lib/jaryo-admin/tenant-queries'
import { TENANT_SAVED_VIEWS, tenantSavedViewSchema } from '@/lib/jaryo-admin/tenant-saved-views'
import { contractTypeLabel, subscriptionStatusBadgeVariant, subscriptionStatusLabel } from '../_components/tenant-status-labels'

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  plan: z.enum(['free', 'starter', 'growth', 'pro', 'enterprise', 'pilot']).optional(),
  view: tenantSavedViewSchema,
  page: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

function buildHref(base: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `/jaryo-admin/tenants?${query}` : '/jaryo-admin/tenants'
}

export default async function JaryoAdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawParams = await searchParams
  const parsed = searchParamsSchema.safeParse({
    q: rawParams.q,
    plan: rawParams.plan,
    view: rawParams.view,
    page: rawParams.page,
  })
  const filters = parsed.success ? parsed.data : { view: 'all' as const, page: 1 }

  const result = await listJaryoAdminTenants({
    q: filters.q,
    plan: filters.plan,
    view: filters.view,
    page: filters.page,
  })

  const lastPage = Math.max(1, Math.ceil(result.total / JARYO_ADMIN_TENANT_PAGE_SIZE))
  const rangeStart = result.total === 0 ? 0 : (result.page - 1) * JARYO_ADMIN_TENANT_PAGE_SIZE + 1
  const rangeEnd = Math.min(result.total, result.page * JARYO_ADMIN_TENANT_PAGE_SIZE)

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-950">회원사 관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          1,000개 이상을 전제로 검색·저장된 보기·페이지네이션 중심으로 관리합니다. 상세는 행마다 별도 화면으로 확인합니다.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" aria-label="saved views">
        {TENANT_SAVED_VIEWS.map((view) => {
          if (!view.enabled) {
            return (
              <span
                key={view.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-400"
              >
                {view.label}
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px]">later slice</span>
              </span>
            )
          }
          const active = filters.view === view.id
          return (
            <Link
              key={view.id}
              href={buildHref({ q: filters.q, plan: filters.plan, view: view.id })}
              className={[
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold',
                active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {view.label}
            </Link>
          )
        })}
      </div>

      <form className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]" method="get">
        <input type="hidden" name="view" value={filters.view} />
        <input
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="테넌트 이름 검색"
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500"
        />
        <Select name="plan" defaultValue={filters.plan ?? ''}>
          <option value="">전체 플랜</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
          <option value="pilot">Pilot</option>
        </Select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
        >
          검색
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>테넌트</TableHead>
              <TableHead>플랜</TableHead>
              <TableHead>결제 방식</TableHead>
              <TableHead>결제 상태</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>직원</TableHead>
              <TableHead>다음 작업</TableHead>
              <TableHead>상세</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-bold text-slate-900">{row.name}</div>
                  <div className="text-xs text-slate-500">created {row.createdAt.slice(0, 10)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.plan}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-700">{contractTypeLabel(row.contractType)}</TableCell>
                <TableCell>
                  <Badge variant={subscriptionStatusBadgeVariant(row.subscriptionStatus)}>
                    {subscriptionStatusLabel(row.subscriptionStatus)}
                  </Badge>
                </TableCell>
                <TableCell>{row.clientCount}</TableCell>
                <TableCell>{row.staffCount}</TableCell>
                <TableCell className="text-sm text-slate-700">{row.nextAction}</TableCell>
                <TableCell>
                  <Link
                    href={`/jaryo-admin/tenants/${row.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    열기
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  조건에 맞는 테넌트가 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex min-h-12 items-center justify-between border-t border-slate-200 px-5 py-2.5 text-xs text-slate-500">
          <div>
            {result.total === 0
              ? '테넌트 0개'
              : `총 ${result.total.toLocaleString('ko-KR')}개 tenant 중 ${rangeStart}-${rangeEnd} 표시`}
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={result.page <= 1}
              href={buildHref({ q: filters.q, plan: filters.plan, view: filters.view, page: Math.max(1, result.page - 1) })}
              className={[
                'inline-flex h-8 items-center rounded-md border border-slate-300 px-3 font-bold',
                result.page <= 1 ? 'pointer-events-none opacity-40' : 'bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              이전
            </Link>
            <Link
              aria-disabled={result.page >= lastPage}
              href={buildHref({ q: filters.q, plan: filters.plan, view: filters.view, page: Math.min(lastPage, result.page + 1) })}
              className={[
                'inline-flex h-8 items-center rounded-md border border-slate-300 px-3 font-bold',
                result.page >= lastPage ? 'pointer-events-none opacity-40' : 'bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              다음
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

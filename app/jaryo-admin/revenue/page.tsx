import Link from 'next/link'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE,
  getJaryoAdminDailyRevenue,
  getJaryoAdminRevenueByContractType,
  getJaryoAdminRevenueByPlan,
  listJaryoAdminTenantPayments,
} from '@/lib/jaryo-admin/revenue-queries'
import { rollupDailyRevenue, type RevenueGranularity } from '@/lib/jaryo-admin/revenue-rollup'
import { now } from '@/lib/time'
import { contractTypeLabel, invoiceEventStatusBadgeVariant } from '../_components/tenant-status-labels'

const granularitySchema = z.enum(['day', 'week', 'month', 'quarter', 'half_year', 'year']).default('month')

const searchParamsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  granularity: granularitySchema,
  contractType: z.enum(['manual_pilot', 'manual_invoice', 'provider_auto_billing']).optional(),
  planCode: z.enum(['starter', 'growth', 'pro', 'enterprise', 'pilot']).optional(),
  page: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

function formatAmount(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
}

function buildHref(base: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `/jaryo-admin/revenue?${query}` : '/jaryo-admin/revenue'
}

export default async function JaryoAdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawParams = await searchParams
  const parsed = searchParamsSchema.safeParse({
    from: rawParams.from,
    to: rawParams.to,
    granularity: rawParams.granularity,
    contractType: rawParams.contractType,
    planCode: rawParams.planCode,
    page: rawParams.page,
  })

  const defaultFrom = now().startOf('month').toISODate() ?? ''
  const defaultTo = now().endOf('month').toISODate() ?? ''

  const filters = parsed.success
    ? {
      from: parsed.data.from ?? defaultFrom,
      to: parsed.data.to ?? defaultTo,
      granularity: parsed.data.granularity,
      contractType: parsed.data.contractType,
      planCode: parsed.data.planCode,
      page: parsed.data.page,
    }
    : { from: defaultFrom, to: defaultTo, granularity: 'month' as RevenueGranularity, contractType: undefined, planCode: undefined, page: 1 }

  const [dailyRows, byPlan, byContractType, payments] = await Promise.all([
    getJaryoAdminDailyRevenue(filters),
    getJaryoAdminRevenueByPlan(filters),
    getJaryoAdminRevenueByContractType(filters),
    listJaryoAdminTenantPayments(filters),
  ])

  const buckets = rollupDailyRevenue(dailyRows, filters.granularity)
  const totalPaid = dailyRows.reduce((sum, row) => sum + row.paidAmountKrw, 0)
  const totalFailed = dailyRows.reduce((sum, row) => sum + row.failedAmountKrw, 0)

  const lastPage = Math.max(1, Math.ceil(payments.total / JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE))
  const rangeStart = payments.total === 0 ? 0 : (payments.page - 1) * JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE + 1
  const rangeEnd = Math.min(payments.total, payments.page * JARYO_ADMIN_PAYMENT_LIST_PAGE_SIZE)

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-950">매출 현황</h1>
        <p className="mt-2 text-sm text-slate-600">
          결제 완료/결제 실패 금액만 집계합니다. 취소·부분취소 이벤트는 아래 목록에서만 확인합니다.
        </p>
      </div>

      <form className="mb-5 grid gap-3 md:grid-cols-[160px_160px_140px_140px_140px_auto]" method="get">
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
        <input
          type="date"
          name="to"
          defaultValue={filters.to}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
        <Select name="granularity" defaultValue={filters.granularity}>
          <option value="day">일별</option>
          <option value="week">주별</option>
          <option value="month">월별</option>
          <option value="quarter">분기별</option>
          <option value="half_year">반기별</option>
          <option value="year">연도별</option>
        </Select>
        <Select name="contractType" defaultValue={filters.contractType ?? ''}>
          <option value="">전체 결제방식</option>
          <option value="provider_auto_billing">자동 결제</option>
          <option value="manual_invoice">수동 청구</option>
          <option value="manual_pilot">파일럿</option>
        </Select>
        <Select name="planCode" defaultValue={filters.planCode ?? ''}>
          <option value="">전체 플랜</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
          <option value="pilot">Pilot</option>
        </Select>
        <button type="submit" className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
          적용
        </button>
      </form>

      <section className="mb-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">결제 완료 금액</div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">{formatAmount(totalPaid)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">결제 실패 금액</div>
          <div className="mt-2 text-2xl font-extrabold text-red-600">{formatAmount(totalFailed)}</div>
        </div>
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-900">기간별 추이</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>기간</TableHead>
                <TableHead>결제 완료</TableHead>
                <TableHead>결제 실패</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((bucket) => (
                <TableRow key={bucket.bucketStart}>
                  <TableCell>{bucket.label}</TableCell>
                  <TableCell className="text-emerald-700">{formatAmount(bucket.paidAmountKrw)}</TableCell>
                  <TableCell className="text-red-700">{formatAmount(bucket.failedAmountKrw)}</TableCell>
                </TableRow>
              ))}
              {buckets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-400">기간 내 결제 이벤트가 없습니다.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-900">결제방식별 분포</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>결제방식</TableHead>
                <TableHead>결제 완료 금액</TableHead>
                <TableHead>결제 tenant 수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byContractType.map((row) => (
                <TableRow key={row.contractType ?? 'none'}>
                  <TableCell>{contractTypeLabel(row.contractType)}</TableCell>
                  <TableCell className="text-emerald-700">{formatAmount(row.paidAmountKrw)}</TableCell>
                  <TableCell>{row.tenantCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-900">플랜별 분포</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>플랜</TableHead>
                <TableHead>결제 완료 금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPlan.map((row) => (
                <TableRow key={row.planCode ?? 'none'}>
                  <TableCell>
                    <Badge variant="outline">{row.planCode ?? '미설정'}</Badge>
                  </TableCell>
                  <TableCell className="text-emerald-700">{formatAmount(row.paidAmountKrw)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="text-sm font-extrabold text-slate-900">tenant별 결제 이벤트</div>
          <p className="mt-1 text-xs text-slate-500">
            취소/부분취소 이벤트도 기록 확인용으로 표시되지만, 위 합계에는 포함되지 않습니다.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>일시</TableHead>
              <TableHead>tenant</TableHead>
              <TableHead>이벤트</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono text-xs text-slate-500">{row.occurredAt.slice(0, 10)}</TableCell>
                <TableCell className="font-bold text-slate-900">{row.tenantName}</TableCell>
                <TableCell>{row.eventType}</TableCell>
                <TableCell>{row.amountKrw === null ? '-' : formatAmount(row.amountKrw)}</TableCell>
                <TableCell>
                  <Badge variant={invoiceEventStatusBadgeVariant(row.status)}>{row.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {payments.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-400">기간 내 결제 이벤트가 없습니다.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex min-h-12 items-center justify-between border-t border-slate-200 px-5 py-2.5 text-xs text-slate-500">
          <div>
            {payments.total === 0
              ? '결제 이벤트 0건'
              : `총 ${payments.total.toLocaleString('ko-KR')}건 중 ${rangeStart}-${rangeEnd} 표시`}
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={payments.page <= 1}
              href={buildHref({ from: filters.from, to: filters.to, granularity: filters.granularity, contractType: filters.contractType, planCode: filters.planCode, page: Math.max(1, payments.page - 1) })}
              className={[
                'inline-flex h-8 items-center rounded-md border border-slate-300 px-3 font-bold',
                payments.page <= 1 ? 'pointer-events-none opacity-40' : 'bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              이전
            </Link>
            <Link
              aria-disabled={payments.page >= lastPage}
              href={buildHref({ from: filters.from, to: filters.to, granularity: filters.granularity, contractType: filters.contractType, planCode: filters.planCode, page: Math.min(lastPage, payments.page + 1) })}
              className={[
                'inline-flex h-8 items-center rounded-md border border-slate-300 px-3 font-bold',
                payments.page >= lastPage ? 'pointer-events-none opacity-40' : 'bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              다음
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

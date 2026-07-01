import Link from 'next/link'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { JARYO_ADMIN_MEMBER_PAGE_SIZE, listJaryoAdminMembers } from '@/lib/jaryo-admin/member-queries'
import { DateTime } from '@/lib/time'

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  page: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

function formatDateTime(value: Date | null) {
  if (!value) return '-'
  return DateTime.fromJSDate(value).setZone('Asia/Seoul').toFormat('yyyy-MM-dd HH:mm')
}

function buildHref(base: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `/jaryo-admin/members?${query}` : '/jaryo-admin/members'
}

export default async function JaryoAdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawParams = await searchParams
  const parsed = searchParamsSchema.safeParse({ q: rawParams.q, page: rawParams.page })
  const filters = parsed.success ? parsed.data : { page: 1 as number, q: undefined as string | undefined }

  const result = await listJaryoAdminMembers({ q: filters.q, page: filters.page })

  const lastPage = Math.max(1, Math.ceil(result.total / JARYO_ADMIN_MEMBER_PAGE_SIZE))
  const rangeStart = result.total === 0 ? 0 : (result.page - 1) * JARYO_ADMIN_MEMBER_PAGE_SIZE + 1
  const rangeEnd = Math.min(result.total, result.page * JARYO_ADMIN_MEMBER_PAGE_SIZE)

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-950">회원 / 계정</h1>
        <p className="mt-2 text-sm text-slate-600">
          이메일로 계정 상태와 소속 회원사를 빠르게 찾습니다. 계정 비활성화·역할 변경 같은 액션은 V1에 없습니다.
        </p>
      </div>

      <form className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
        <input
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="이메일로 검색"
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500"
        />
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
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>이메일 인증</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead>최근 로그인</TableHead>
              <TableHead>소속 회원사</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-bold text-slate-900">{row.name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>
                  <Badge variant={row.emailVerified ? 'success' : 'outline'}>{row.emailVerified ? '인증됨' : '미인증'}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-700">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell className="text-sm text-slate-700">{formatDateTime(row.lastLoginAt)}</TableCell>
                <TableCell>
                  {row.memberships.length === 0 ? (
                    <span className="text-xs text-slate-400">소속 없음</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {row.memberships.map((membership) => (
                        <span
                          key={membership.tenantId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                        >
                          <span className="font-bold text-slate-800">{membership.tenantName}</span>
                          <Badge variant={membership.role === 'TENANT_ADMIN' ? 'info' : 'outline'}>{membership.role}</Badge>
                          <Badge variant={membership.active ? 'success' : 'outline'}>{membership.active ? 'active' : 'inactive'}</Badge>
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                  조건에 맞는 사용자가 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex min-h-12 items-center justify-between border-t border-slate-200 px-5 py-2.5 text-xs text-slate-500">
          <div>
            {result.total === 0
              ? '사용자 0명'
              : `총 ${result.total.toLocaleString('ko-KR')}명 중 ${rangeStart}-${rangeEnd} 표시`}
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={result.page <= 1}
              href={buildHref({ q: filters.q, page: Math.max(1, result.page - 1) })}
              className={[
                'inline-flex h-8 items-center rounded-md border border-slate-300 px-3 font-bold',
                result.page <= 1 ? 'pointer-events-none opacity-40' : 'bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              이전
            </Link>
            <Link
              aria-disabled={result.page >= lastPage}
              href={buildHref({ q: filters.q, page: Math.min(lastPage, result.page + 1) })}
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

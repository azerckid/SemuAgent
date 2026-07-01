import Link from 'next/link'
import { Mail, Plus, SearchCheck } from 'lucide-react'

export function ClientDetailHeader({
  clientId,
  clientName,
  contactName,
  staffName,
}: {
  clientId: string
  clientName: string
  contactName: string | null
  staffName: string | null
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-gray-500 hover:text-gray-800">
          고객사 관리
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-950">{clientName}</h1>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            고객사 workspace
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
          <span>자료 제출 담당자 {contactName ?? '미등록'}</span>
          <span className="text-gray-300">/</span>
          <span>담당 회계사 {staffName ?? '미배정'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/clients/${clientId}/events/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          비정기 요청
        </Link>
        <Link
          href="/dashboard/reviews"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <SearchCheck className="h-4 w-4" />
          자료 검토
        </Link>
        <Link
          href="/dashboard/emails"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Mail className="h-4 w-4" />
          메일
        </Link>
      </div>
    </header>
  )
}

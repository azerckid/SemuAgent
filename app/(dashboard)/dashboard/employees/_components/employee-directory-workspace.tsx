import type { EmployeeDirectorySummary } from '@/lib/employee-directory/summary'
import { EmployeeEditorButton } from './employee-actions'
import { EmployeeTable } from './employee-table'

export interface EmployeeDirectoryWorkspaceProps {
  readonly summary: EmployeeDirectorySummary
}

export function EmployeeDirectoryWorkspace({ summary }: EmployeeDirectoryWorkspaceProps) {
  const { stats, employees } = summary

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div>
          <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 직원 명부</p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">직원 명부</h1>
        </div>
        <span className="text-[13px] font-medium text-company-fg-muted">{summary.tenant.name}</span>
        <div className="ml-auto">
          <EmployeeEditorButton label="직원 추가" variant="primary" />
        </div>
      </div>

      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="재직" value={stats.activeCount} dot="bg-[#16a34a]" />
          <StatCard label="급여 대상" value={stats.payrollEligibleCount} dot="bg-[#2563eb]" />
          <StatCard label="4대보험 확인 필요" value={stats.needsReviewCount} dot="bg-[#d97706]" attn={stats.needsReviewCount > 0} />
          <StatCard label="퇴사" value={stats.terminatedCount} dot="bg-[#a1a1aa]" />
        </div>

        {employees.length === 0 ? (
          <EmptyEmployeeState />
        ) : (
          <EmployeeTable employees={employees} />
        )}

        <div className="rounded-xl border border-company-border bg-company-nav-hover px-4 py-3 text-[12px] text-company-fg-subtle">
          직원 명부는 급여 실행 결과와 분리된 상시 마스터이며, 급여·4대보험 고지액 매칭·내부 리마인드 수신자의 기준 데이터입니다.
          <b className="text-company-fg-muted"> 주민등록번호·계좌번호·전화번호 원문은 저장하지 않습니다.</b>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, dot, attn = false }: {
  readonly label: string
  readonly value: number
  readonly dot: string
  readonly attn?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-company-surface p-4 shadow-company-card ${attn ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-company-border'}`}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-company-fg-muted">
        <span className={`inline-block size-[7px] rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${attn ? 'text-[#d97706]' : 'text-foreground'}`}>
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-[13px] font-semibold text-company-fg-subtle">명</span>
      </p>
    </div>
  )
}

function EmptyEmployeeState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-company-border-strong bg-company-surface px-6 py-16 text-center">
      <p className="text-[13px] font-semibold text-foreground">등록된 직원이 없습니다</p>
      <p className="text-[12.5px] text-company-fg-subtle">첫 직원을 추가하면 급여·4대보험 매칭·리마인드에서 참조됩니다.</p>
      <EmployeeEditorButton label="첫 직원 추가" variant="primary" />
    </div>
  )
}

export function EmployeeBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 직원 명부</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">직원 명부</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[760px] rounded-xl border border-company-border bg-company-surface p-6 text-center shadow-company-card">
          <p className="text-sm font-semibold text-foreground">사업장이 아직 없습니다</p>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">{tenantName}의 사업장을 먼저 등록하면 직원 명부를 관리할 수 있습니다.</p>
        </div>
      </div>
    </div>
  )
}

'use client'

export default function FilingSupportError({ reset }: { readonly reset: () => void }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 원천세</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">원천세</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[760px] rounded-xl border border-[#fecaca] bg-[#fef2f2] p-5 text-[#dc2626]">
          <p className="text-sm font-semibold">신고 항목을 불러오지 못했습니다</p>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-foreground"
            onClick={reset}
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  )
}

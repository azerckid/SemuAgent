export default function BusinessStatusReportLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="h-3 w-52 rounded-full bg-company-border" />
        <div className="mt-2 h-4 w-36 rounded-full bg-company-border" />
      </div>
      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        <div className="h-[180px] rounded-xl border border-company-border bg-company-surface" />
        <div className="h-[180px] rounded-xl border border-company-border bg-company-surface" />
        <div className="h-[240px] rounded-xl border border-company-border bg-company-surface" />
      </div>
    </div>
  )
}

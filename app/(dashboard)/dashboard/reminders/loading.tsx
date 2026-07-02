export default function RemindersLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="h-3 w-36 rounded-full bg-company-border" />
        <div className="mt-2 h-4 w-24 rounded-full bg-company-border" />
      </div>
      <div className="flex w-full max-w-[1240px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="h-[64px] rounded-xl border border-company-border bg-company-surface" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-[96px] rounded-xl border border-company-border bg-company-surface" />
          <div className="h-[96px] rounded-xl border border-company-border bg-company-surface" />
          <div className="h-[96px] rounded-xl border border-company-border bg-company-surface" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="h-[360px] rounded-xl border border-company-border bg-company-surface" />
          <div className="h-[300px] rounded-xl border border-company-border bg-company-surface" />
        </div>
      </div>
    </div>
  )
}

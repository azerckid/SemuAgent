export default function EmployeesLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="h-4 w-40 rounded bg-company-border" />
        <div className="mt-2 h-5 w-24 rounded bg-company-border" />
      </div>
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-20 rounded-xl border border-company-border bg-company-surface shadow-company-card" />
          <div className="h-20 rounded-xl border border-company-border bg-company-surface shadow-company-card" />
          <div className="h-20 rounded-xl border border-company-border bg-company-surface shadow-company-card" />
          <div className="h-20 rounded-xl border border-company-border bg-company-surface shadow-company-card" />
        </div>
        <div className="h-10 w-full rounded bg-company-border" />
        <div className="h-96 rounded-xl border border-company-border bg-company-surface shadow-company-card" />
      </div>
    </div>
  )
}

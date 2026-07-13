export default function YearEndSettlementLoading() {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-4 py-3.5 sm:px-7">
        <div className="h-3 w-40 rounded-full bg-company-border" />
        <div className="mt-2 h-4 w-24 rounded-full bg-company-border" />
      </div>
      <div className="flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-6 pb-12 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-48 rounded-full bg-company-border" />
            <div className="h-7 w-full max-w-[520px] rounded-md bg-company-border" />
            <div className="h-3 w-full max-w-[620px] rounded-full bg-company-border" />
          </div>
          <div className="h-[66px] w-full rounded-lg border border-company-border bg-company-surface lg:w-[420px]" />
        </div>
        <div className="h-11 border-y border-company-border" />
        <div className="overflow-hidden rounded-lg border border-company-border bg-company-surface">
          <div className="h-[62px] border-b border-company-border" />
          <div className="space-y-px bg-company-border">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-[58px] bg-company-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

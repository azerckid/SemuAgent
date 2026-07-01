function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={`h-3 rounded-full bg-muted ${className}`} />
}

export default function SourceCollectionLoading() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-company-border bg-company-surface px-7 py-3.5">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="mt-2 h-5 w-32" />
      </div>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <div className="grid gap-5 rounded-xl border border-company-border bg-company-surface p-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3">
            <SkeletonLine className="w-28" />
            <SkeletonLine className="h-7 w-56" />
            <SkeletonLine className="h-2 w-full max-w-xl" />
            <SkeletonLine className="w-72" />
          </div>
          <SkeletonLine className="h-10 w-20" />
        </div>

        <div className="rounded-xl border border-dashed border-company-border-strong bg-company-surface p-8">
          <SkeletonLine className="mx-auto h-8 w-8 rounded-full" />
          <SkeletonLine className="mx-auto mt-3 w-48" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['tax_invoice', 'bank_statement', 'card_purchase', 'receipt_other'].map((key) => (
            <div key={key} className="rounded-xl border border-company-border bg-company-surface p-4">
              <SkeletonLine className="h-8 w-8 rounded-lg" />
              <SkeletonLine className="mt-3 w-24" />
              <SkeletonLine className="mt-2 h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

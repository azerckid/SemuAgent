import { Card, CardContent, CardHeader } from '@/components/ui/card'

function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={`h-3 rounded-full bg-muted ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid w-full max-w-md gap-2">
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="w-72" />
        </div>
        <SkeletonLine className="h-8 w-44" />
      </div>

      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="grid gap-3">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="h-7 w-80" />
            <SkeletonLine className="h-2 w-full max-w-xl" />
            <SkeletonLine className="w-96" />
          </div>
          <div className="grid gap-2">
            <SkeletonLine className="w-20" />
            <SkeletonLine className="h-6 w-32" />
            <SkeletonLine className="w-16" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {['source', 'bookkeeping', 'vat', 'payroll', 'filing', 'receipt'].map((key) => (
          <Card key={key}>
            <CardHeader className="gap-3">
              <SkeletonLine className="h-8 w-8 rounded-lg" />
              <SkeletonLine className="w-32" />
              <SkeletonLine className="h-6 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

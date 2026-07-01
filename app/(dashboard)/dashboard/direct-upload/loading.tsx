import { Card, CardContent, CardHeader } from '@/components/ui/card'

function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={`h-3 rounded-full bg-muted ${className}`} />
}

export default function SourceCollectionLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="grid gap-3">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="h-7 w-56" />
            <SkeletonLine className="h-2 w-full max-w-xl" />
            <SkeletonLine className="w-72" />
          </div>
          <div className="grid gap-2">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="h-6 w-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8">
          <SkeletonLine className="mx-auto h-8 w-8 rounded-full" />
          <SkeletonLine className="mx-auto mt-3 w-48" />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['tax_invoice', 'bank_statement', 'card_purchase', 'receipt_other'].map((key) => (
          <Card key={key}>
            <CardHeader className="gap-3">
              <SkeletonLine className="h-8 w-8 rounded-lg" />
              <SkeletonLine className="w-24" />
              <SkeletonLine className="h-6 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

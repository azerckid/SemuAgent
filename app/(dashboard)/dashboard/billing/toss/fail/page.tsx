import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type PageProps = {
  searchParams: Promise<{
    code?: string
    message?: string
  }>
}

export default async function TossBillingFailPage({ searchParams }: PageProps) {
  const { code, message } = await searchParams

  return (
    <div className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <XCircle className="size-5 text-red-600" />
            <CardTitle>Toss 정기결제 등록 실패</CardTitle>
          </div>
          <CardDescription>
            카드 등록이 완료되지 않았습니다. 필요하면 요금제 화면에서 다시 시도할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message ?? 'Toss 결제창에서 등록이 취소되었거나 실패했습니다.'}
            {code && <span className="mt-1 block text-xs text-red-600">code: {code}</span>}
          </div>
          <Link
            href="/dashboard/billing"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          >
            요금제로 돌아가기
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

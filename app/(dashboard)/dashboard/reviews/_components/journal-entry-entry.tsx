import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function JournalEntryEntry({ session }: { session: ReviewSession | null }) {
  if (!session) return null
  if (session.workType === 'vat') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>전표 분개표</CardTitle>
        <CardDescription>계정항목 정리 결과로 전표 분개표를 확인합니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          계정항목 정리가 완료되지 않았으면 전표 분개표 화면에서 안내를 확인할 수 있습니다.
        </p>
        <Link
          href={`/dashboard/sessions/${session.id}/journal-entry`}
          className={buttonVariants({ variant: 'outline' })}
        >
          전표 분개표 보기
        </Link>
      </CardContent>
    </Card>
  )
}

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

const READY_SESSION_STATUSES = ['ready_for_accountant', 'completed'] as const

export function AccountClassificationEntry({ session }: { session: ReviewSession | null }) {
  if (!session) return null

  const workType = session.workType
  const ready = (READY_SESSION_STATUSES as readonly string[]).includes(session.status)
  const partial = session.status === 'needs_resubmission'
  const hasAttribution = (session.materialAttributionSummary?.total ?? 0) > 0
  const hasIncludedMaterial = (session.materialAttributionSummary?.include ?? 0) > 0
  const eligible = workType === 'bookkeeping' && session.files.length > 0 && ((ready && !hasAttribution) || hasIncludedMaterial)

  if (workType === 'vat') return null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>기장 계정항목 정리</CardTitle>
            <CardDescription>
              포함된 자료의 거래별 계정항목 추천을 생성하고 담당자가 확정합니다.
            </CardDescription>
          </div>
          <Badge variant={eligible ? 'success' : 'secondary'}>
            {eligible ? '시작 가능' : '대기'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {eligible
            ? hasIncludedMaterial && !ready
              ? '귀속기간 검토에서 포함된 자료가 있어 계정항목 정리를 시작할 수 있습니다.'
              : '업로드 파일에서 거래 행을 추출해 계정항목 정리를 시작할 수 있습니다.'
            : partial
              ? '보충 필요 세션은 먼저 귀속기간 검토에서 포함할 자료를 확정해야 합니다.'
              : hasAttribution
                ? '귀속기간 검토에서 계정항목 정리에 포함할 자료를 먼저 확정해야 합니다.'
                : '먼저 자료 검토에서 귀속기간 검토를 실행하고, 포함할 자료를 확정해 주세요.'}
        </p>
        <Link
          href={`/dashboard/sessions/${session.id}/account-classification`}
          className={buttonVariants({ variant: eligible ? 'default' : 'outline' })}
        >
          계정항목 보기
        </Link>
      </CardContent>
    </Card>
  )
}

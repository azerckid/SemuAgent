import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ReviewWorkspaceDeferredErrorProps = {
  section: 'previews' | 'approval'
  refreshHref: string
}

const SECTION_LABEL: Record<ReviewWorkspaceDeferredErrorProps['section'], string> = {
  previews: '계정항목·전표분개 미리보기',
  approval: '보충 요청 메일',
}

export function ReviewWorkspaceDeferredError({ section, refreshHref }: ReviewWorkspaceDeferredErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-foreground">
      <p className="font-medium">{SECTION_LABEL[section]}을(를) 불러오지 못했습니다.</p>
      <p className="mt-1 text-muted-foreground">자료 검토 요청 목록은 계속 사용할 수 있습니다. 페이지를 새로고침해 주세요.</p>
      <Link href={refreshHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 inline-flex')}>
        새로고침
      </Link>
    </div>
  )
}

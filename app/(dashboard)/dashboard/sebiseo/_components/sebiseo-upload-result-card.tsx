import Link from 'next/link'
import type { SebiseoUploadResultCard } from '@/lib/sebiseo/upload-result-schema'

export function SebiseoUploadResultCardView({
  card,
}: {
  readonly card: SebiseoUploadResultCard
}) {
  const metaParts: string[] = []
  if (card.okCount > 0) metaParts.push(`정상 ${card.okCount}건`)
  if (card.needsReviewCount > 0) metaParts.push(`확인 필요 ${card.needsReviewCount}건`)
  if (card.inProgressCount > 0) metaParts.push(`진행 중 ${card.inProgressCount}건`)
  if (card.failedCount > 0) metaParts.push(`오류 ${card.failedCount}건`)
  if (card.excludedCount > 0) metaParts.push(`제외 ${card.excludedCount}건`)

  return (
    <article
      className="rounded-xl border border-company-border bg-company-surface p-3.5"
      aria-label="업로드 결과 카드"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-company-fg-subtle">
            {card.periodLabel}
            {' · '}
            직접 업로드
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">
            자료 {card.totalCount}건을 정리했습니다
          </p>
          {metaParts.length > 0 ? (
            <p className="mt-1 text-xs text-company-fg-muted">{metaParts.join(' · ')}</p>
          ) : null}
        </div>
        {card.needsReviewCount > 0 ? (
          <span className="inline-flex shrink-0 self-start rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800 dark:text-amber-300">
            확인 필요 {card.needsReviewCount}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          href={card.ctaHref}
          className="inline-flex w-full items-center justify-center rounded-lg border border-company-border-strong bg-muted px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-company-nav-hover sm:w-auto"
        >
          {card.ctaLabel}
        </Link>
      </div>
    </article>
  )
}

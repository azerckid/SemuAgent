type ReviewWorkspaceDeferredFallbackProps = {
  section: 'previews' | 'approval'
}

const FALLBACK_COPY: Record<ReviewWorkspaceDeferredFallbackProps['section'], { title: string; description: string }> = {
  previews: {
    title: '전표분개 미리보기를 불러오는 중입니다.',
    description: '목록은 먼저 사용할 수 있습니다. 선택한 요청의 누적 전표 자료를 확인하고 있습니다.',
  },
  approval: {
    title: '보충 요청 메일을 불러오는 중입니다.',
    description: '목록은 먼저 사용할 수 있습니다. 발송 대기 중인 보충 요청 초안과 발송 상태를 확인하고 있습니다.',
  },
}

export function ReviewWorkspaceDeferredFallback({ section }: ReviewWorkspaceDeferredFallbackProps) {
  const copy = FALLBACK_COPY[section]

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{copy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">불러오는 중</div>
      </div>
      <div className="mt-4 space-y-2 motion-safe:animate-pulse">
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
      </div>
    </div>
  )
}

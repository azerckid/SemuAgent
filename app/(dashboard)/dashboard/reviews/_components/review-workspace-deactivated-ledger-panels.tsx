import { Badge } from '@/components/ui/badge'

export function ReviewWorkspaceDeactivatedLedgerPanel({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 opacity-60">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        <Badge variant="secondary">옵션</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {title}는 추가 옵션 기능입니다. 현재 버전에서는 데이터 로딩과 펼치기를 제공하지 않습니다.
      </p>
    </section>
  )
}

import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  SourceCollectionCompleteness,
  SourceCollectionImportRow,
  SourceCollectionMissingItem,
  SourceCollectionSourceTypeTile,
  SourceCollectionTone,
} from '@/lib/source-collection/summary'
import { cn } from '@/lib/utils'

const toneBadgeVariant: Record<SourceCollectionTone, 'success' | 'warning' | 'secondary' | 'info'> = {
  ok: 'success',
  warn: 'warning',
  muted: 'secondary',
  info: 'info',
}

const sourceTypeIcon: Record<SourceCollectionSourceTypeTile['id'], ComponentType<{ className?: string }>> = {
  tax_invoice: FileText,
  bank_statement: Landmark,
  card_purchase: CreditCard,
  receipt_other: ReceiptText,
}

const fileStatusBadgeVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  matched: 'success',
  needs_review: 'warning',
  analyzing: 'info',
  uploaded: 'secondary',
  failed: 'destructive',
  rejected: 'destructive',
}

function SectionHeader({ title, description }: { readonly title: string; readonly description: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function CompletenessHeader({ completeness }: { readonly completeness: SourceCollectionCompleteness }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">수집 완결성</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            자료 {completeness.collectedCount} / {completeness.requiredCount}건
          </h2>
          <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${completeness.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completeness.missingCount > 0
              ? `필수 자료 ${completeness.missingCount}건이 아직 충족되지 않았습니다.`
              : '필수 자료 수집 기준을 충족했습니다.'}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-5 py-4 text-left md:text-right">
          <p className="text-xs font-semibold text-muted-foreground">미수집</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{completeness.missingCount}건</p>
          <Badge variant={completeness.missingCount > 0 ? 'warning' : 'success'} className="mt-2">
            {completeness.missingCount > 0 ? '확인 필요' : '충족'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export function SourceTypeTilesSection({ tiles }: { readonly tiles: SourceCollectionSourceTypeTile[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader title="자료유형" description="업로드된 파일을 표준 자료유형으로 집계합니다" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = sourceTypeIcon[tile.id]
          return (
            <Card key={tile.id}>
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{tile.title}</p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {tile.collectedCount}
                  <span className="text-sm font-normal text-muted-foreground"> / {tile.requiredCount}건</span>
                </p>
                <Badge variant={toneBadgeVariant[tile.tone]} className="w-fit">
                  {tile.statusLabel}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export function ImportStatusTableSection({ rows }: { readonly rows: SourceCollectionImportRow[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader title="수집(가져오기) 상태" description="업로드 → 파싱 → 정규화 진행 상황" />
      <Card>
        <CardContent className="p-0">
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>자료</TableHead>
                  <TableHead>진행</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>업로드</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{row.safeTitle}</p>
                      {row.rowCountLabel && (
                        <p className="text-xs text-muted-foreground">{row.rowCountLabel}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', row.status === 'failed' ? 'bg-red-500' : 'bg-blue-600')}
                          style={{ width: `${row.progressPercent}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={fileStatusBadgeVariant[row.status] ?? 'secondary'}>
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.uploadedAt}</TableCell>
                    <TableCell className="text-right">
                      {row.canRetry && (
                        <Link href={row.href} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                          <RefreshCw className="size-3" />
                          다시 시도
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center p-8 text-center">
              <div>
                <UploadCloud className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 font-medium text-foreground">아직 업로드된 자료가 없습니다</p>
                <p className="mt-1 text-sm text-muted-foreground">위에서 첫 자료를 업로드해 주세요.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function MissingChecklistSection({ items }: { readonly items: SourceCollectionMissingItem[] }) {
  if (items.length === 0) {
    return (
      <section className="grid gap-3">
        <SectionHeader title="미수집·확인 필요" description="신고 전 확보해야 할 자료" />
        <Card>
          <CardContent className="grid place-items-center p-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 font-medium text-foreground">확인이 필요한 항목이 없습니다</p>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="grid gap-3">
      <SectionHeader title="미수집·확인 필요" description="신고 전 확보해야 할 자료" />
      <Card>
        <CardContent className="grid gap-0 p-0">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                index !== items.length - 1 && 'border-b border-border',
              )}
            >
              <AlertTriangle className={cn('size-4 shrink-0', item.tone === 'danger' ? 'text-red-600' : 'text-amber-600')} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Link href={item.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {item.ctaLabel}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

interface BusinessEntityEmptyStateProps {
  readonly tenantName: string
}

export function SourceCollectionBusinessEntityEmptyState({ tenantName }: BusinessEntityEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardContent className="grid gap-3 p-6">
          <Badge variant="warning" className="w-fit">사업장 필요</Badge>
          <h2 className="text-lg font-semibold text-foreground">아직 등록된 사업장이 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            {tenantName}에서 자료수집을 시작하려면 사업장 정보를 먼저 등록해야 합니다.
          </p>
          <Link href="/dashboard/clients" className={cn(buttonVariants(), 'w-fit')}>
            <Building2 className="size-4" />
            사업장 등록으로 이동
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

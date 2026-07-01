'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { JournalEntryVoucherLine } from '@/lib/bookkeeping/journal-entry-voucher-lines'
import { cn } from '@/lib/utils'
import { JournalEntryVoucherTableCard } from '@/app/(dashboard)/dashboard/_components/journal-entry-voucher-table-card'

type Run = {
  id: string
  status: 'draft' | 'completed' | 'failed' | 'superseded'
  rowCount: number
  unresolvedRowCount: number
  errorMessage: string | null
}

type InitialData = {
  run: Run | null
  voucherLines: JournalEntryVoucherLine[]
  staleReason: string | null
}

export function JournalEntryWorkspace({
  sessionId,
  clientName,
  accountingPeriod,
  initialData,
}: {
  sessionId: string
  clientName: string
  accountingPeriod: string
  initialData: InitialData
}) {
  const [data, setData] = useState(initialData)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function refresh() {
    const res = await fetch(`/api/sessions/${sessionId}/journal-entry`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '새로고침에 실패했습니다.')
    setData(json)
  }

  function startJournalEntry() {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/journal-entry/start`, { method: 'POST' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '전표 분개표 생성에 실패했습니다.')
        await refresh()
        setMessage(`${json.rowCount ?? 0}개 전표를 생성했습니다.`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '전표 분개표 생성에 실패했습니다.')
      }
    })
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">전표 분개표</h1>
            <Badge variant={data.run?.status === 'draft' || data.run?.status === 'completed' ? 'success' : data.run?.status === 'failed' ? 'destructive' : 'secondary'}>
              {data.run ? data.run.status : '미생성'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {clientName} · {accountingPeriod} · 계정항목 정리 결과를 전표 분개표 형식으로 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/reviews?sessionId=${sessionId}`} className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" />
            자료 검토
          </Link>
          <Link href={`/dashboard/sessions/${sessionId}/account-classification`} className={buttonVariants({ variant: 'outline' })}>
            계정항목 정리
          </Link>
          <Button onClick={startJournalEntry} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            {data.run ? '전표 다시 생성' : '전표 분개표 생성'}
          </Button>
        </div>
      </div>

      {(message || data.staleReason) && (
        <Card>
          <CardContent className={cn('p-4 text-sm', data.staleReason ? 'text-amber-700' : 'text-muted-foreground')}>
            {message ?? data.staleReason}
          </CardContent>
        </Card>
      )}

      <JournalEntryVoucherTableCard
        voucherLines={data.voucherLines}
        exportHref={`/api/sessions/${sessionId}/journal-entry/export?scope=all`}
      />
    </div>
  )
}

'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface VatErrorProps {
  readonly reset: () => void
}

export default function VatError({ reset }: VatErrorProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 bg-company-bg p-6">
      <Card>
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
            <AlertCircle className="size-5" />
          </div>
          <CardTitle>세액 집계를 불러오지 못했습니다</CardTitle>
          <CardDescription>
            일시적인 오류일 수 있습니다. 다시 시도해도 반복되면 잠시 후 접속해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={reset}>
            다시 시도
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

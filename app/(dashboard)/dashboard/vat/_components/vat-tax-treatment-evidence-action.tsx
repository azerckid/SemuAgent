'use client'

import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type {
  VatTaxTreatmentDisplayRow,
  VatTaxTreatmentRequiredEvidence,
} from '@/lib/validations/vat-tax-treatment'
import { vatTaxTreatmentEvidenceMutationSuccessSchema } from '@/lib/validations/vat-tax-treatment'
import { cn } from '@/lib/utils'

const attestableEvidenceCodes = new Set([
  'export_or_zero_rate_documents',
  'exemption_qualification',
])

interface VatTaxTreatmentEvidenceActionProps {
  readonly row: VatTaxTreatmentDisplayRow
  readonly evidence: VatTaxTreatmentRequiredEvidence
}

export function VatTaxTreatmentEvidenceAction({
  row,
  evidence,
}: VatTaxTreatmentEvidenceActionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const canAttest = row.direction === 'sale' && attestableEvidenceCodes.has(evidence.code)
  const isUserAttested = evidence.status === 'present' && Boolean(evidence.attestedAt)

  function mutate(action: 'confirm' | 'revoke') {
    startTransition(async () => {
      const response = await fetch(`/api/vat/tax-treatments/${row.rowId}/evidence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodKey: row.periodKey,
          recommendationFingerprint: row.recommendationFingerprint,
          evidenceCode: evidence.code,
          action,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : '증빙 확인 상태를 저장하지 못했습니다.')
        return
      }
      const parsed = vatTaxTreatmentEvidenceMutationSuccessSchema.safeParse(body)
      if (!parsed.success) {
        toast.error('증빙 확인 저장 결과를 확인할 수 없습니다.')
        return
      }
      toast.success(action === 'confirm'
        ? '필수 증빙을 확인 완료로 저장했습니다.'
        : '필수 증빙 확인을 취소했습니다.')
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          'rounded-md border px-2 py-0.5 text-[11px] font-medium',
          evidenceClass(evidence.status),
        )}
        title={evidence.attestedAt ? `사용자 확인: ${evidence.attestedAt}` : undefined}
      >
        {evidence.label}{isUserAttested ? ' · 확인 완료' : ''}
      </span>
      {canAttest && evidence.status !== 'present' ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isPending}
          title="필수 증빙을 실제로 준비했는지 확인한 경우에만 저장합니다."
          onClick={() => mutate('confirm')}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          확인 완료
        </Button>
      ) : null}
      {canAttest && isUserAttested ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={isPending}
          onClick={() => mutate('revoke')}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          확인 취소
        </Button>
      ) : null}
    </span>
  )
}

function evidenceClass(status: VatTaxTreatmentRequiredEvidence['status']) {
  if (status === 'present') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
  if (status === 'missing') return 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]'
  return 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
}

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { adaptiveStructureModel } from '@/lib/db/schema'
import { payrollAdaptiveModelContractSchema } from '@/lib/payroll/adaptive-structuring-model-contract'
import type { PayrollAdaptivePreviewRow } from '@/lib/payroll/adaptive-structuring-common-engine'
import { fromISO } from '@/lib/time'
import { AdaptiveModelActions } from './adaptive-model-actions'

type ModelRow = typeof adaptiveStructureModel.$inferSelect

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  proposed: '제안됨 (승인 대기)',
  approved: '승인됨',
  rejected: '거부됨',
  retired: '폐기됨',
}

const STATUS_BADGE_VARIANT: Record<string, 'outline' | 'success' | 'warning' | 'destructive'> = {
  draft: 'outline',
  proposed: 'warning',
  approved: 'success',
  rejected: 'destructive',
  retired: 'outline',
}

const IGNORED_REGION_REASON_LABEL: Record<string, string> = {
  metadata: '메타정보',
  company_policy: '사내 규칙',
  result_only: '결과성 자료',
  footer_or_total: '합계/꼬리말',
  sample_or_instruction: '안내/예시',
  unsupported: '미지원',
  uncertain: '불확실',
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('yyyy.MM.dd HH:mm') : value
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function AdaptiveModelCard({
  model,
  createdByName,
  approvedByName,
  isTenantAdmin,
}: {
  model: ModelRow
  createdByName: string
  approvedByName: string | null
  isTenantAdmin: boolean
}) {
  const parsedContract = payrollAdaptiveModelContractSchema.safeParse(safeParseJson(model.modelJson))
  const sampleRows = safeParseJson<PayrollAdaptivePreviewRow[]>(model.sampleRowsPreviewJson) ?? []
  const validationSummary = safeParseJson<{
    matched: boolean
    blockedRowCount: number
    blockers: string[]
    warnings: string[]
  }>(model.validationSummaryJson)

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{model.name}</CardTitle>
          <Badge variant={STATUS_BADGE_VARIANT[model.status] ?? 'outline'}>
            {STATUS_LABEL[model.status] ?? model.status}
          </Badge>
        </div>
        <CardDescription>
          v{model.modelVersion} · 등록: {createdByName} ({formatDateTime(model.createdAt)})
          {approvedByName && ` · 승인: ${approvedByName} (${formatDateTime(model.approvedAt)})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsedContract.success ? (
          <p className="text-sm text-destructive">저장된 모델 정의를 읽을 수 없습니다.</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">컬럼 매핑</p>
              <ul className="space-y-1">
                {parsedContract.data.fieldMappings.map((mapping, index) => (
                  <li
                    key={`${mapping.sheetName}-${mapping.sourceColumn}-${index}`}
                    className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    [{mapping.sheetName}] {mapping.sourceColumn} → {mapping.targetField}
                    {mapping.required ? ' (필수)' : ''}
                  </li>
                ))}
              </ul>
            </div>

            {parsedContract.data.ignoredRegions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">제외된 영역</p>
                <ul className="space-y-1">
                  {parsedContract.data.ignoredRegions.map((region, index) => (
                    <li
                      key={`${region.sheetName}-${region.sourceColumnOrRegion}-${index}`}
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                    >
                      [{region.sheetName}] {region.sourceColumnOrRegion} — {IGNORED_REGION_REASON_LABEL[region.reason] ?? region.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {sampleRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">샘플 row (마스킹됨)</p>
            <ul className="space-y-1">
              {sampleRows.map((row, index) => (
                <li
                  key={`${row.sheetName}-${row.sourceRowRef}-${index}`}
                  className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
                >
                  <p className="mb-1 font-medium text-foreground">[{row.sheetName}] {row.sourceRowRef}</p>
                  {Object.entries(row.values).map(([key, value]) => (
                    <span key={key} className="mr-3 inline-block">
                      {key}: {value ?? '-'}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        {validationSummary && validationSummary.blockers.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">검증 시점 경고</p>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {validationSummary.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}
            </ul>
          </div>
        )}

        <AdaptiveModelActions
          modelId={model.id}
          modelName={model.name}
          status={model.status}
          isTenantAdmin={isTenantAdmin}
          mappingSummary={parsedContract.success
            ? parsedContract.data.fieldMappings.map((m) => `${m.sourceColumn} → ${m.targetField}`)
            : []}
          sampleRowCount={sampleRows.length}
          warnings={validationSummary?.warnings ?? []}
        />
      </CardContent>
    </Card>
  )
}

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { appendDefaultCriteriaSection } from '@/lib/mail-console/default-criteria-section'
import {
  consoleBadgeClass,
  consoleCardDescriptionClass,
  consoleCardTitleClass,
  consoleFieldLabelClass,
} from './mail-console-styles'
import { applyTokenReplacements, countUnresolvedTokens } from './mail-preview-utils'
import { type MailConsoleClient, type MailConsoleTemplateDraft } from './mail-console-types'

interface MailPreviewPanelProps {
  clients: MailConsoleClient[]
  client?: MailConsoleClient
  templateDraft: MailConsoleTemplateDraft
  onPreviewClientChange: (clientId: string) => void
}

// Props-driven only: desktop and Sheet render paths intentionally mount separate instances.
export function MailPreviewPanel({
  clients,
  client,
  templateDraft,
  onPreviewClientChange,
}: MailPreviewPanelProps) {
  const previewClient = client ?? clients[0]
  const previewSubject = applyTokenReplacements(templateDraft.subject, templateDraft, previewClient)
  const previewBody = appendDefaultCriteriaSection(
    applyTokenReplacements(templateDraft.body, templateDraft, previewClient),
    templateDraft.workType,
  )
  const unresolvedTokenCount = countUnresolvedTokens(templateDraft, previewClient)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className={consoleCardTitleClass}>3. 고객사별 미리보기</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            선택한 고객사의 실제 치환 결과를 발송 전 확인합니다.
          </CardDescription>
        </div>
        <Badge
          variant={unresolvedTokenCount > 0 ? 'warning' : 'success'}
          className={consoleBadgeClass}
        >
          {unresolvedTokenCount > 0 ? `미치환 ${unresolvedTokenCount}개` : '치환 정상'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1.5">
          <span className={consoleFieldLabelClass}>미리보기 고객사</span>
          <Select
            value={previewClient?.id ?? ''}
            onChange={(event) => onPreviewClientChange(event.target.value)}
          >
            {clients.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {clients.length === 0 && <option value="">고객사 없음</option>}
          </Select>
        </label>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid gap-1 border-b bg-muted/30 p-3 text-xs text-muted-foreground">
            <Line label="From" value="JARYO 회계법인 <noreply@web3people.online>" />
            <Line label="To" value={previewClient?.toEmail ?? '수신자 미등록'} />
            <Line label="CC" value={previewClient?.ccEmails ?? previewClient?.ccGroup ?? 'CC 그룹 없음'} />
            <Line label="Subject" value={previewSubject || '제목 없음'} />
          </div>
          <div className="whitespace-pre-line p-3 text-sm leading-6">{previewBody || '본문 없음'}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-foreground">{label}</span>{' '}
      <span>{value}</span>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { consoleBadgeClass } from './mail-console-styles'
import { type MailConsoleClient } from './mail-console-types'

interface ClientSelectionTableProps {
  clients: MailConsoleClient[]
  selectedIds: string[]
  previewClientId: string
  ccSelections: Record<string, string | null>
  onToggleClient: (clientId: string) => void
  onPreviewClient: (clientId: string) => void
  onCcGroupChange: (clientId: string, ccGroupId: string | null) => void
}

export function ClientSelectionTable({
  clients,
  selectedIds,
  previewClientId,
  ccSelections,
  onToggleClient,
  onPreviewClient,
  onCcGroupChange,
}: ClientSelectionTableProps) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">선택</span>
          </TableHead>
          <TableHead>고객사</TableHead>
          <TableHead>담당자</TableHead>
          <TableHead>받는 사람</TableHead>
          <TableHead>CC 그룹</TableHead>
          <TableHead>이번 발송 상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
              등록된 고객사가 없습니다.
            </TableCell>
          </TableRow>
        )}
        {clients.map((client) => {
          const selected = selectedIds.includes(client.id)
          const previewed = previewClientId === client.id
          const availableCcGroups = client.ccGroups
          const selectedCcGroupId = ccSelections[client.id] ?? null

          return (
            <TableRow
              key={client.id}
              data-state={previewed ? 'selected' : undefined}
              className={cn(client.sendReady === 'blocked' && 'bg-destructive/5')}
            >
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={client.sendReady === 'blocked'}
                  onChange={() => onToggleClient(client.id)}
                  aria-label={`${client.name} 선택`}
                  className="size-4 rounded border-border"
                />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onPreviewClient(client.id)}
                  className="text-left"
                >
                  <span className="block font-bold text-foreground">{client.name}</span>
                </button>
              </TableCell>
              <TableCell className="whitespace-nowrap">{client.managerName}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {client.toEmail ?? '미등록'}
              </TableCell>
              <TableCell className="min-w-40">
                {availableCcGroups.length > 0 ? (
                  <Select
                    value={selectedCcGroupId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      onCcGroupChange(client.id, value === '' ? null : value)
                    }}
                    aria-label={`${client.name} CC 그룹`}
                    className="h-8 text-xs"
                  >
                    <option value="">CC 없음</option>
                    {availableCcGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge variant="warning" className={consoleBadgeClass}>
                    CC 없음
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <SendReadyBadge state={client.sendReady} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function SendReadyBadge({ state }: { state: MailConsoleClient['sendReady'] }) {
  if (state === 'ready') return <Badge variant="success" className={consoleBadgeClass}>발송 가능</Badge>
  return <Badge variant="destructive" className={consoleBadgeClass}>수신자 없음</Badge>
}

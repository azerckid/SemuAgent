'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { STAFF_MAILBOX_DOMAIN } from '@/lib/email/inbound/mailbox-domain'
import { consoleBadgeClass, consoleCardDescriptionClass, consoleCardTitleClass } from './mail-console-styles'
import type { WorkEmailAddressRow, WorkEmailStaffOption } from './mail-console-types'

const STATE_LABEL: Record<string, string> = {
  reserved: '예약',
  active: '사용 중',
  paused: '일시정지',
  handoff_required: '인계 필요',
  retired: '폐기',
}

function stateBadge(state: string) {
  if (state === 'active') return <Badge variant="success" className={consoleBadgeClass}>{STATE_LABEL[state]}</Badge>
  if (state === 'handoff_required') return <Badge variant="secondary" className={consoleBadgeClass}>{STATE_LABEL[state]}</Badge>
  return <Badge variant="info" className={consoleBadgeClass}>{STATE_LABEL[state] ?? state}</Badge>
}

function errorMessageFromResponse(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const error = (data as { error?: unknown }).error
  if (typeof error === 'string') return error
  return fallback
}

interface WorkEmailAddressesPanelProps {
  addresses: WorkEmailAddressRow[]
  staffOptions: WorkEmailStaffOption[]
  isAdmin: boolean
}

type MailboxAction = { action: 'pause' | 'resume' | 'retire' } | { action: 'transfer'; staffId: string }

export function WorkEmailAddressesPanel({ addresses, staffOptions, isAdmin }: WorkEmailAddressesPanelProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [createStaffId, setCreateStaffId] = useState('')
  const [createAlias, setCreateAlias] = useState('')
  const [transferOpenId, setTransferOpenId] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const assignedStaffIds = useMemo(() => (
    new Set(addresses.filter((row) => row.state !== 'retired' && row.staffId).map((row) => row.staffId!))
  ), [addresses])

  const createCandidates = useMemo(() => (
    staffOptions.filter((staff) => staff.active && !assignedStaffIds.has(staff.id))
  ), [assignedStaffIds, staffOptions])

  const transferCandidatesFor = (address: WorkEmailAddressRow) => (
    staffOptions.filter((staff) => staff.active && staff.id !== address.staffId && !assignedStaffIds.has(staff.id))
  )

  const refresh = () => {
    startTransition(() => router.refresh())
  }

  const handleCreate = async () => {
    const staffId = createStaffId.trim()
    const alias = createAlias.trim()
    setError(null)
    setSuccess(null)
    if (!staffId || !alias) return

    setLoadingKey('create')
    const res = await fetch('/api/settings/staff-mailboxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, alias }),
    })
    setLoadingKey(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(errorMessageFromResponse(data, '업무 메일주소 생성에 실패했습니다'))
      return
    }
    setCreateStaffId('')
    setCreateAlias('')
    setSuccess('업무 메일주소를 만들었습니다.')
    refresh()
  }

  const handleAction = async (mailboxId: string, body: MailboxAction) => {
    setError(null)
    setSuccess(null)
    setLoadingKey(`${mailboxId}:${body.action}`)
    const res = await fetch(`/api/settings/staff-mailboxes/${mailboxId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoadingKey(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(errorMessageFromResponse(data, '처리에 실패했습니다'))
      return
    }
    setTransferOpenId(null)
    setSuccess(body.action === 'transfer' ? '담당자를 인계했습니다.' : '상태를 변경했습니다.')
    refresh()
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className={consoleCardTitleClass}>업무 메일주소 만들기</CardTitle>
            <CardDescription className={consoleCardDescriptionClass}>
              담당자에게 사무소 소유 업무 메일주소를 배정합니다. 주소는 담당자가 바뀌어도 인계할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Select value={createStaffId} onChange={(e) => setCreateStaffId(e.target.value)}>
              <option value="">담당자 선택</option>
              {createCandidates.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name} · {staff.email}</option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <Input
                value={createAlias}
                onChange={(e) => setCreateAlias(e.target.value)}
                placeholder="alias"
              />
              <span className="shrink-0 text-xs text-muted-foreground">@{STAFF_MAILBOX_DOMAIN}</span>
            </div>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={loadingKey === 'create' || !createStaffId.trim() || !createAlias.trim()}
            >
              {loadingKey === 'create' ? '생성 중...' : '생성'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className={consoleCardTitleClass}>메일주소</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            업무 메일주소 생성, 일시정지, 인계, 폐기를 여기에서 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
          {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

          {addresses.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <p className="text-sm font-semibold text-foreground">
                {isAdmin ? '아직 만들어진 업무 메일주소가 없습니다' : '아직 배정된 업무 메일주소가 없습니다'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isAdmin ? '위에서 담당자를 선택해 업무 메일주소를 만들어 주세요.' : '관리자가 업무 메일주소를 배정하면 여기에 표시됩니다.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주소</TableHead>
                  <TableHead>현재 담당자</TableHead>
                  <TableHead>상태</TableHead>
                  {isAdmin && <TableHead className="text-right">관리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.map((row) => {
                  const transferCandidates = transferCandidatesFor(row)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-foreground">{row.address}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.staffName ?? '미배정'}
                      </TableCell>
                      <TableCell>{stateBadge(row.state)}</TableCell>
                      {isAdmin && (
                        <TableCell className="space-y-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {row.state === 'active' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(row.id, { action: 'pause' })}
                                disabled={Boolean(loadingKey)}
                              >
                                일시정지
                              </Button>
                            )}
                            {row.state === 'paused' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(row.id, { action: 'resume' })}
                                disabled={Boolean(loadingKey)}
                              >
                                재개
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setTransferOpenId((current) => (current === row.id ? null : row.id))}
                              disabled={Boolean(loadingKey)}
                            >
                              담당자 인계
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(row.id, { action: 'retire' })}
                              disabled={Boolean(loadingKey)}
                            >
                              폐기
                            </Button>
                          </div>
                          {row.state === 'handoff_required' && (
                            <p className="text-xs text-amber-600">새 담당자 배정이 필요합니다.</p>
                          )}
                          {transferOpenId === row.id && (
                            <div className="ml-auto flex max-w-md flex-wrap justify-end gap-1.5">
                              <Select
                                value={transferTarget[row.id] ?? ''}
                                onChange={(e) => setTransferTarget((current) => ({ ...current, [row.id]: e.target.value }))}
                              >
                                <option value="">새 담당자 선택</option>
                                {transferCandidates.map((staff) => (
                                  <option key={staff.id} value={staff.id}>{staff.name} · {staff.email}</option>
                                ))}
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(row.id, {
                                  action: 'transfer',
                                  staffId: transferTarget[row.id] ?? '',
                                })}
                                disabled={Boolean(loadingKey) || !(transferTarget[row.id] ?? '').trim()}
                              >
                                인계하기
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

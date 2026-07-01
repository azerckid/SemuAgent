'use client'

import { useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { consoleCardDescriptionClass, consoleCardTitleClass } from './mail-console-styles'
import type { MailConsoleClient, WorkEmailAddressRow, WorkEmailInternalCcGroupOption } from './mail-console-types'

interface WorkEmailComposePanelProps {
  addresses: WorkEmailAddressRow[]
  currentStaffId: string | null
  clients: MailConsoleClient[]
  internalCcGroups: WorkEmailInternalCcGroupOption[]
}

function countCcEmails(value: string) {
  return value.split(/[,;\n]+/).map((email) => email.trim()).filter(Boolean).length
}

export function WorkEmailComposePanel({
  addresses,
  currentStaffId,
  clients,
  internalCcGroups,
}: WorkEmailComposePanelProps) {
  const defaultAddressId = useMemo(() => {
    const mine = addresses.find((row) => row.staffId === currentStaffId)
    return mine?.id ?? addresses[0]?.id ?? ''
  }, [addresses, currentStaffId])

  const [staffMailboxId, setStaffMailboxId] = useState(defaultAddressId)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [clientLabelId, setClientLabelId] = useState('')
  const [selectedCcGroupId, setSelectedCcGroupId] = useState('')
  const [selectedInternalCcGroupId, setSelectedInternalCcGroupId] = useState('')
  const [showCcGroupEmails, setShowCcGroupEmails] = useState(false)
  const [showInternalCcGroupEmails, setShowInternalCcGroupEmails] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedMailboxId = staffMailboxId || defaultAddressId
  const canSend = Boolean(selectedMailboxId) && to.trim() && subject.trim() && body.trim() && !sending

  const selectedClient = clients.find((c) => c.id === clientLabelId) ?? null
  const clientCcGroups = selectedClient?.ccGroups ?? []
  const selectedCcGroup = clientCcGroups.find((g) => g.id === selectedCcGroupId) ?? null
  const selectedInternalCcGroup = internalCcGroups.find((g) => g.id === selectedInternalCcGroupId) ?? null

  const handleClientLabelChange = (value: string) => {
    setClientLabelId(value)
    const nextClient = clients.find((c) => c.id === value) ?? null
    const defaultGroup = nextClient?.ccGroups.find((g) => g.isDefault) ?? null
    setSelectedCcGroupId(defaultGroup?.id ?? '')
    setShowCcGroupEmails(false)
  }

  const resetForm = () => {
    setTo('')
    setCc('')
    setSubject('')
    setBody('')
    setClientLabelId('')
    setSelectedCcGroupId('')
    setSelectedInternalCcGroupId('')
    setShowCcGroupEmails(false)
    setShowInternalCcGroupEmails(false)
  }

  const handleSend = async () => {
    if (!selectedMailboxId) return
    setSending(true)
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/work-emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffMailboxId: selectedMailboxId,
        to: to.trim(),
        cc: cc.trim() || undefined,
        ccGroupId: selectedCcGroupId || undefined,
        ccInternalGroupId: selectedInternalCcGroupId || undefined,
        subject: subject.trim(),
        body: body.trim(),
        clientLabelId: clientLabelId || null,
      }),
    })
    setSending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === 'string' ? data.error : '메일 발송에 실패했습니다')
      return
    }
    setSuccess('메일을 보냈습니다. 메일함에서 발신 이력을 확인할 수 있습니다.')
    resetForm()
  }

  if (addresses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={consoleCardTitleClass}>메일쓰기</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            사용 가능한 업무 메일주소가 있어야 메일을 보낼 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-semibold text-foreground">사용 가능한 업무 메일주소가 없습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">설정 화면에서 업무 메일주소를 만들어 보세요.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={consoleCardTitleClass}>메일쓰기</CardTitle>
        <CardDescription className={consoleCardDescriptionClass}>
          자료 요청 자동화가 아닌 일반 업무메일을 업무 메일주소로 보냅니다. 보낸 메일도 같은 메일함 이력에 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">보내는 주소</label>
            {addresses.length > 1 ? (
              <Select value={selectedMailboxId} onChange={(e) => setStaffMailboxId(e.target.value)}>
                {addresses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.address}{row.staffId !== currentStaffId ? ` (${row.staffName ?? '미배정'})` : ''}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={addresses[0]?.address ?? ''} disabled readOnly />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">고객사 라벨 (선택)</label>
            <Select value={clientLabelId} onChange={(e) => handleClientLabelChange(e.target.value)}>
              <option value="">선택 안 함</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">받는 사람</label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">CC (선택)</label>
          {clientLabelId && clientCcGroups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              등록된 참조그룹이 없습니다. 고객사 설정에서 추가할 수 있습니다.
            </p>
          )}
          {clientCcGroups.length > 0 && (
            <Select
              value={selectedCcGroupId}
              onChange={(e) => {
                setSelectedCcGroupId(e.target.value)
                setShowCcGroupEmails(false)
              }}
            >
              <option value="">고객사 참조그룹 선택 안 함</option>
              {clientCcGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.isDefault ? ' · 기본' : ''}
                </option>
              ))}
            </Select>
          )}
          {selectedCcGroup && (
            <p className="text-xs text-muted-foreground">
              {selectedCcGroup.name} · {countCcEmails(selectedCcGroup.emails)}명{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setShowCcGroupEmails((v) => !v)}
              >
                {showCcGroupEmails ? '숨기기' : '보기'}
              </button>
              {showCcGroupEmails && <span className="mt-0.5 block break-all">{selectedCcGroup.emails}</span>}
            </p>
          )}
          {internalCcGroups.length > 0 && (
            <Select
              value={selectedInternalCcGroupId}
              onChange={(e) => {
                setSelectedInternalCcGroupId(e.target.value)
                setShowInternalCcGroupEmails(false)
              }}
            >
              <option value="">내부 참조그룹 추가 안 함</option>
              {internalCcGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.isDefault ? ' · 기본' : ''}
                </option>
              ))}
            </Select>
          )}
          {selectedInternalCcGroup && (
            <p className="text-xs text-muted-foreground">
              {selectedInternalCcGroup.name} · {countCcEmails(selectedInternalCcGroup.emails)}명{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setShowInternalCcGroupEmails((v) => !v)}
              >
                {showInternalCcGroupEmails ? '숨기기' : '보기'}
              </button>
              {showInternalCcGroupEmails && (
                <span className="mt-0.5 block break-all">{selectedInternalCcGroup.emails}</span>
              )}
            </p>
          )}
          <Input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="추가로 참조할 이메일 (예: partner@example.com)"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">제목</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">본문</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-emerald-600">{success}</p>}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSend} disabled={!canSend}>
            {sending ? '보내는 중…' : '보내기'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

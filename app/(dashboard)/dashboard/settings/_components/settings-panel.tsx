'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkEmailAddressesPanel } from '../../emails/_components/work-email-addresses-panel'
import type {
  WorkEmailAddressRow,
  WorkEmailStaffOption,
} from '../../emails/_components/mail-console-types'
import { TAX_ENTITY_TYPES, TAX_ENTITY_TYPE_LABEL, type TaxEntityType } from '@/lib/validations/business-entity'

const SETTINGS_TABS = ['tenant', 'staff', 'mail', 'clients'] as const

type Tab = (typeof SETTINGS_TABS)[number]

function resolveSettingsTab(value: string | null): Tab {
  return SETTINGS_TABS.includes(value as Tab) ? (value as Tab) : 'tenant'
}

interface TenantData {
  id: string
  name: string
  subdomain: string
  timezone: string
  reminderDaysBefore: number
  plan: string
}

interface StaffMailboxInfo {
  id: string
  address: string
  state: string
}

interface StaffRow {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  active: boolean
  clientCount: number
  mailbox: StaffMailboxInfo | null
}

const MAILBOX_STATE_LABEL: Record<string, string> = {
  reserved: '예약',
  active: '활성',
  paused: '일시정지',
  handoff_required: '인계 필요',
  retired: '폐기',
}

interface Props {
  tenant: TenantData
  staffList: StaffRow[]
  currentUserId: string
  currentStaffPhone: string
  workEmailAddresses: WorkEmailAddressRow[]
  workEmailStaffOptions: WorkEmailStaffOption[]
  businessEntityTaxType: TaxEntityType | null
}

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST, UTC+9)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
]

// API가 예상과 다른 형태의 에러(예: Zod flatten() 객체)를 반환해도 React child로
// 그대로 렌더링해 화면이 죽지 않도록 문자열만 통과시킨다.
function toErrorMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

const PLAN_LABEL: Record<string, string> = {
  free: '무료',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
}


export function SettingsPanel({
  tenant: initialTenant,
  staffList: initialStaff,
  currentUserId,
  currentStaffPhone,
  workEmailAddresses,
  workEmailStaffOptions,
  businessEntityTaxType,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const tab = resolveSettingsTab(searchParams.get('tab'))

  // ── 테넌트 설정 state
  const [tenantName, setTenantName] = useState(initialTenant.name)
  const [timezone, setTimezone] = useState(initialTenant.timezone)
  const [taxEntityType, setTaxEntityType] = useState<TaxEntityType | ''>(businessEntityTaxType ?? '')
  const [tenantSaving, setTenantSaving] = useState(false)
  const [tenantError, setTenantError] = useState('')

  // ── 내 프로필 state (전화번호는 담당자 목록의 본인 행에서 인라인 편집)
  // savedPhone: 마지막으로 저장된 기준값. 취소 시 초기 props가 아니라 이 값으로 되돌린다.
  const [myPhone, setMyPhone] = useState(currentStaffPhone)
  const [savedPhone, setSavedPhone] = useState(currentStaffPhone)
  const [editingMyPhone, setEditingMyPhone] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const handlePhoneSave = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setPhoneSaving(true)
    setPhoneError('')
    const res = await fetch('/api/settings/staff/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: myPhone }),
    })
    setPhoneSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setPhoneError(toErrorMessage(data.error, '저장에 실패했습니다'))
    } else {
      setSavedPhone(myPhone)
      setEditingMyPhone(false)
      toast.success('전화번호를 저장했습니다.')
    }
  }

  // ── 담당자 state
  const [staffList, setStaffList] = useState(initialStaff)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'STAFF' | 'TENANT_ADMIN'>('STAFF')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const currentStaff = initialStaff.find((staffMember) => staffMember.id === currentUserId)
  const canManageMailSettings = currentStaff?.role === 'TENANT_ADMIN'

  const saveTenantSettings = async (successMessage: string) => {
    setTenantSaving(true)
    setTenantError('')
    const res = await fetch('/api/settings/tenant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tenantName, timezone, reminderDaysBefore: initialTenant.reminderDaysBefore }),
    })
    if (!res.ok) {
      setTenantSaving(false)
      const data = await res.json().catch(() => ({}))
      setTenantError(toErrorMessage(data.error, '저장에 실패했습니다'))
      return
    }
    // 사업자 유형은 사업장(client) 필드라 별도 엔드포인트로 저장한다(빈 값 → 미지정 null).
    const bizRes = await fetch('/api/settings/business-entity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxEntityType: taxEntityType || null }),
    })
    setTenantSaving(false)
    if (!bizRes.ok) {
      const data = await bizRes.json().catch(() => ({}))
      setTenantError(toErrorMessage(data.error, '사업자 유형 저장에 실패했습니다'))
      return
    }
    toast.success(successMessage)
    startTransition(() => router.refresh())
  }

  const handleTenantSave = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    await saveTenantSettings('회사 설정을 저장했습니다.')
  }

  const handleAddStaff = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setAddLoading(true)
    setAddError('')
    const res = await fetch('/api/settings/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addEmail, role: addRole }),
    })
    setAddLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setAddError(toErrorMessage(data.error, '추가에 실패했습니다'))
    } else {
      setAddEmail('')
      startTransition(() => router.refresh())
    }
  }

  const handleRenameStart = (s: StaffRow) => {
    setRenamingId(s.id)
    setRenameValue(s.name)
  }

  const handleRenameSubmit = async (staffId: string) => {
    if (!renameValue.trim()) return
    setActionLoading(staffId + 'rename')
    const res = await fetch(`/api/settings/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', name: renameValue.trim() }),
    })
    setActionLoading(null)
    setRenamingId(null)
    if (res.ok) {
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, name: renameValue.trim() } : s)),
      )
    }
  }

  const handleStaffAction = async (
    staffId: string,
    action: 'role' | 'deactivate' | 'activate',
    role?: 'STAFF' | 'TENANT_ADMIN',
  ) => {
    setActionLoading(staffId + action)
    const body = action === 'role' ? { action, role } : { action }
    const res = await fetch(`/api/settings/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setActionLoading(null)
    if (res.ok) {
      startTransition(() => router.refresh())
    }
  }

  const handleTabChange = (nextTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false })
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'tenant', label: '회사 설정' },
    { key: 'staff', label: '담당자 관리' },
    { key: 'mail', label: '업무메일 설정' },
    { key: 'clients', label: '사업장 관리' },
  ]

  return (
    <div className="space-y-5">
      {/* 상단 탭 */}
      <TabsList>
        {TABS.map(({ key, label }) => (
          <TabsTrigger key={key} type="button" active={tab === key} onClick={() => handleTabChange(key)}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* 콘텐츠 */}
      <div>

        {/* ── 테넌트 설정 탭 */}
        {tab === 'tenant' && (
          <form onSubmit={handleTenantSave} className="space-y-4 max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">회사 정보</CardTitle>
                <CardDescription>표시 이름과 기간 계산 등에 쓰이는 회사 기본 설정입니다.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-1.5">
                  <label htmlFor="tenant-name" className="text-sm font-medium text-foreground">회사명</label>
                  <Input
                    id="tenant-name"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor="tenant-subdomain" className="text-sm font-medium text-foreground">서브도메인</label>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">변경 불가</Badge>
                  </div>
                  <Input
                    id="tenant-subdomain"
                    value={initialTenant.subdomain}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="tenant-timezone" className="text-sm font-medium text-foreground">기본 타임존</label>
                  <Select
                    id="tenant-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">토큰 만료일과 메일 자동화 기준 시각 계산에 사용합니다.</p>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="tenant-tax-entity" className="text-sm font-medium text-foreground">사업자 유형</label>
                  <Select
                    id="tenant-tax-entity"
                    value={taxEntityType}
                    onChange={(e) => setTaxEntityType(e.target.value as TaxEntityType | '')}
                  >
                    <option value="">미지정</option>
                    {TAX_ENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>{TAX_ENTITY_TYPE_LABEL[type]}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">사업자 유형에 따라 해당하지 않는 신고 항목(예: 면세 개인의 부가세)을 구분하는 데 사용합니다.</p>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-foreground">요금제</label>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>현재 요금제:</span>
                      <Badge variant="info" className="h-5 px-2 text-[11px]">
                        {PLAN_LABEL[initialTenant.plan] ?? initialTenant.plan}
                      </Badge>
                      <span className="text-muted-foreground">변경은 요금제 화면에서</span>
                    </span>
                    <Link href="/dashboard/billing" className="text-sm font-medium text-primary hover:underline">요금제 변경 →</Link>
                  </div>
                </div>

                {tenantError && <p className="text-xs text-destructive">{tenantError}</p>}
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={tenantSaving}>
                  {tenantSaving ? '저장 중…' : '저장'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {/* ── 담당자 관리 탭 */}
        {tab === 'staff' && (
          <div className="max-w-4xl space-y-4">
            {/* 담당자 목록 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">담당자</CardTitle>
                <CardDescription>회사 내부 담당자의 권한·활성 상태를 관리합니다. 내 전화번호는 본인 행의 수정 버튼으로 편집합니다.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
              {staffList.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">등록된 담당자가 없습니다</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">이름</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">이메일</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">전화번호</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">역할</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">사업장</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">업무 메일함</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">상태</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffList.map((s) => {
                      const isSelf = s.id === currentUserId
                      const isLoadingRole = actionLoading === s.id + 'role'
                      const isLoadingToggle = actionLoading === s.id + 'deactivate' || actionLoading === s.id + 'activate'
                      return (
                        <tr key={s.id} className={!s.active ? 'opacity-50' : ''}>
                          <td className="px-4 py-3">
                            {renamingId === s.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit(s.id)
                                    if (e.key === 'Escape') setRenamingId(null)
                                  }}
                                  className="text-sm border border-blue-400 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  onClick={() => handleRenameSubmit(s.id)}
                                  disabled={actionLoading === s.id + 'rename'}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => setRenamingId(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRenameStart(s)}
                                className="font-medium text-gray-900 hover:text-blue-600 text-sm text-left"
                                title="클릭해서 이름 변경"
                              >
                                {s.name}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{s.email}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {isSelf && editingMyPhone ? (
                              <form onSubmit={handlePhoneSave} className="flex flex-wrap items-center gap-1">
                                <Input
                                  autoFocus
                                  maxLength={100}
                                  value={myPhone}
                                  onChange={(e) => setMyPhone(e.target.value)}
                                  placeholder="예: 02-1234-5678"
                                  className="h-8 w-40"
                                />
                                <Button type="submit" size="sm" disabled={phoneSaving}>{phoneSaving ? '…' : '저장'}</Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingMyPhone(false); setMyPhone(savedPhone); setPhoneError('') }}
                                >
                                  취소
                                </Button>
                                {phoneError && <span className="w-full text-xs text-destructive">{phoneError}</span>}
                              </form>
                            ) : (
                              (isSelf ? myPhone : s.phone) || <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={s.role === 'TENANT_ADMIN' ? 'info' : 'secondary'}>
                              {s.role === 'TENANT_ADMIN' ? '관리자' : '담당자'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{s.clientCount}개</td>
                          <td className="px-4 py-3">
                            {s.mailbox ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-gray-700">{s.mailbox.address}</span>
                                <Badge variant={
                                  s.mailbox.state === 'active'
                                    ? 'success'
                                    : s.mailbox.state === 'paused' || s.mailbox.state === 'handoff_required'
                                      ? 'warning'
                                      : 'secondary'
                                }>
                                  {MAILBOX_STATE_LABEL[s.mailbox.state] ?? s.mailbox.state}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={s.active ? 'success' : 'secondary'}>
                              {s.active ? '활성' : '비활성'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isSelf ? (
                              editingMyPhone ? (
                                <span className="text-xs text-gray-300">본인</span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => { setEditingMyPhone(true); setPhoneError('') }}
                                >
                                  수정
                                </Button>
                              )
                            ) : (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() =>
                                    handleStaffAction(
                                      s.id,
                                      'role',
                                      s.role === 'TENANT_ADMIN' ? 'STAFF' : 'TENANT_ADMIN',
                                    )
                                  }
                                  disabled={!!actionLoading}
                                  className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {isLoadingRole ? '…' : s.role === 'TENANT_ADMIN' ? '담당자로' : '관리자로'}
                                </button>
                                <button
                                  onClick={() =>
                                    handleStaffAction(s.id, s.active ? 'deactivate' : 'activate')
                                  }
                                  disabled={!!actionLoading || (s.clientCount > 0 && s.active)}
                                  title={s.clientCount > 0 && s.active ? `사업장 ${s.clientCount}곳 배정됨 — 먼저 재배정 필요` : ''}
                                  className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {isLoadingToggle ? '…' : s.active ? '비활성화' : '활성화'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              </CardContent>
            </Card>

            {/* 담당자 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">담당자 추가</CardTitle>
                <CardDescription>SemuAgent에 가입된 계정만 추가할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddStaff} className="flex flex-wrap items-start gap-2">
                  <Input
                    type="email"
                    placeholder="가입된 이메일 주소"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    required
                    className="w-64"
                  />
                  <Select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as 'STAFF' | 'TENANT_ADMIN')}
                    className="w-32"
                  >
                    <option value="STAFF">담당자</option>
                    <option value="TENANT_ADMIN">관리자</option>
                  </Select>
                  <Button type="submit" disabled={addLoading}>{addLoading ? '추가 중…' : '추가'}</Button>
                  {addError && <p className="w-full text-xs text-destructive">{addError}</p>}
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 업무메일 설정 탭 */}
        {tab === 'mail' && (
          <div className="max-w-5xl space-y-5">
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">업무메일 설정</h2>
              <p className="text-sm text-muted-foreground">
                담당자별 업무전용 이메일주소를 관리합니다.
              </p>
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">업무전용 이메일</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  담당자가 바뀌어도 업무 메일주소와 회신 이력은 회사 업무 기록으로 남아 다음 담당자에게 인계됩니다.
                </p>
              </div>
              <WorkEmailAddressesPanel
                addresses={workEmailAddresses}
                staffOptions={workEmailStaffOptions}
                isAdmin={canManageMailSettings}
              />
            </section>
          </div>
        )}

        {/* ── 사업장 관리 탭 */}
        {tab === 'clients' && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">사업장 관리</CardTitle>
              <CardDescription>사업장 추가, 담당자 배정, 회사별 분석 기준 입력은 사업장 관리 화면에서 처리합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard/clients"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                사업장 관리 화면으로 이동 →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

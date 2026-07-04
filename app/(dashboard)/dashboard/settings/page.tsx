import { and, asc, eq, ne } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { tenant, staff, client, staffMailbox } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { SettingsPanel } from './_components/settings-panel'

export default async function SettingsPage() {
  let tenantId: string
  let currentUserId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    currentUserId = session.user.id
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      redirect('/sign-in')
    }
    redirect('/dashboard/clients')
  }

  const tenantRows = await db
    .select()
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  if (!tenantRows[0]) redirect('/dashboard/clients')

  const staffRows = await db
    .select({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      phone: staff.phone,
      active: staff.active,
    })
    .from(staff)
    .where(eq(staff.tenantId, tenantId))
    .orderBy(staff.createdAt)

  // 담당자별 배정 클라이언트 수
  const clientRows = await db
    .select({ staffId: client.staffId })
    .from(client)
    .where(eq(client.tenantId, tenantId))

  const clientCounts: Record<string, number> = {}
  for (const row of clientRows) {
    if (row.staffId) clientCounts[row.staffId] = (clientCounts[row.staffId] ?? 0) + 1
  }

  // 담당자별 업무 메일함 (폐기되지 않은 것만 — 1인 1개). handoff_required 상태는
  // currentStaffId가 이전(비활성) 담당자를 그대로 가리키므로 그 직원 행에 표시된다.
  const mailboxRows = await db
    .select({
      id: staffMailbox.id,
      currentStaffId: staffMailbox.currentStaffId,
      address: staffMailbox.address,
      state: staffMailbox.state,
    })
    .from(staffMailbox)
    .where(and(eq(staffMailbox.tenantId, tenantId), ne(staffMailbox.state, 'retired')))
    .orderBy(asc(staffMailbox.address))

  const mailboxByStaffId: Record<string, { id: string; address: string; state: string }> = {}
  for (const row of mailboxRows) {
    if (row.currentStaffId) {
      mailboxByStaffId[row.currentStaffId] = { id: row.id, address: row.address, state: row.state }
    }
  }

  // 현재 사용자의 staff 조회 (전화번호 포함)
  const currentStaffRows = await db
    .select({ id: staff.id, phone: staff.phone })
    .from(staff)
    .where(and(eq(staff.userId, currentUserId), eq(staff.tenantId, tenantId)))
    .limit(1)

  const currentStaffId = currentStaffRows[0]?.id ?? ''
  const currentStaffPhone = currentStaffRows[0]?.phone ?? ''

  const staffNameById = new Map(staffRows.map((row) => [row.id, row.name]))
  const workEmailAddresses = mailboxRows.map((row) => ({
    id: row.id,
    address: row.address,
    state: row.state,
    staffId: row.currentStaffId,
    staffName: row.currentStaffId ? (staffNameById.get(row.currentStaffId) ?? null) : null,
  }))
  const workEmailStaffOptions = staffRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active,
  }))

  const staffList = staffRows.map((s) => ({
    ...s,
    clientCount: clientCounts[s.id] ?? 0,
    mailbox: mailboxByStaffId[s.id] ?? null,
  }))

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-0.5">회사 정보 및 담당자를 관리합니다.</p>
      </div>
      <SettingsPanel
        tenant={tenantRows[0]}
        staffList={staffList}
        currentUserId={currentStaffId}
        currentStaffPhone={currentStaffPhone}
        workEmailAddresses={workEmailAddresses}
        workEmailStaffOptions={workEmailStaffOptions}
      />
    </div>
  )
}

import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { tenant, staff, client } from '@/lib/db/schema'
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
    redirect('/dashboard')
  }

  const tenantRows = await db
    .select()
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  if (!tenantRows[0]) redirect('/dashboard')

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

  // 담당자별 배정 클라이언트 수 + 기본 사업장 사업자 유형(JC-032)
  const clientRows = await db
    .select({ staffId: client.staffId, createdAt: client.createdAt, taxEntityType: client.taxEntityType })
    .from(client)
    .where(eq(client.tenantId, tenantId))

  // v1은 테넌트당 사업장 1개 — 최초 등록 사업장의 사업자 유형을 회사 설정에 노출한다.
  const primaryClient = [...clientRows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  const businessEntityTaxType = primaryClient?.taxEntityType ?? null

  const clientCounts: Record<string, number> = {}
  for (const row of clientRows) {
    if (row.staffId) clientCounts[row.staffId] = (clientCounts[row.staffId] ?? 0) + 1
  }

  // 현재 사용자의 staff 조회 (전화번호 포함)
  const currentStaffRows = await db
    .select({ id: staff.id, phone: staff.phone })
    .from(staff)
    .where(and(eq(staff.userId, currentUserId), eq(staff.tenantId, tenantId)))
    .limit(1)

  const currentStaffId = currentStaffRows[0]?.id ?? ''
  const currentStaffPhone = currentStaffRows[0]?.phone ?? ''

  const staffList = staffRows.map((s) => ({
    ...s,
    clientCount: clientCounts[s.id] ?? 0,
  }))

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-0.5">회사 정보와 사용자 권한을 관리합니다.</p>
      </div>
      <SettingsPanel
        tenant={tenantRows[0]}
        staffList={staffList}
        currentUserId={currentStaffId}
        currentStaffPhone={currentStaffPhone}
        businessEntityTaxType={businessEntityTaxType}
      />
    </div>
  )
}

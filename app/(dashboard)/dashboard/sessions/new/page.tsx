import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, staff } from '@/lib/db/schema'
import { SessionCreateForm } from './_components/session-create-form'

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { user, tenantId } = await requireTenantSession()
  const { clientId } = await searchParams

  const [clients, staffRows] = await Promise.all([
    db
      .select({ id: client.id, name: client.name, contactName: client.contactName, email: client.email })
      .from(client)
      .where(eq(client.tenantId, tenantId)),
    db
      .select({ phone: staff.phone })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1),
  ])

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">자료 요청 메일 생성</h1>
      <SessionCreateForm
        clients={clients}
        initialClientId={clientId}
        staffPhone={staffRows[0]?.phone ?? ''}
      />
    </div>
  )
}

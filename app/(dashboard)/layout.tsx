import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'
import { Sidebar } from './_components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId

  if (!tenantId) {
    return <>{children}</>
  }

  let tenantName = ''
  const tenantRows = await db
    .select({ name: tenant.name })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  tenantName = tenantRows[0]?.name ?? '회사'

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar userName={session.user.name} tenantName={tenantName} />
      <main className="flex-1 overflow-auto bg-muted/40">{children}</main>
    </div>
  )
}

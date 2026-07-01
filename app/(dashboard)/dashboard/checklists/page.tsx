import { eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { checklistTemplate, checklistItem } from '@/lib/db/schema'
import { ChecklistManager } from './_components/checklist-manager'

export default async function ChecklistsPage() {
  const { tenantId } = await requireTenantSession()

  const templates = await db
    .select()
    .from(checklistTemplate)
    .where(eq(checklistTemplate.tenantId, tenantId))

  const items = await db
    .select()
    .from(checklistItem)
    .where(eq(checklistItem.tenantId, tenantId))

  const data = templates.map((t) => ({
    ...t,
    items: items
      .filter((i) => i.templateId === t.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }))

  return <ChecklistManager initialTemplates={data} />
}

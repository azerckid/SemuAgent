import { createClient } from '@libsql/client'
import { asc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { config } from 'dotenv'
import * as appSchema from '../lib/db/schema'
import * as authSchema from '../lib/db/auth-schema'

config({ path: '.env.local' })

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local')
  process.exit(1)
}

const client = createClient({ url, authToken })
const db = drizzle(client, { schema: { ...appSchema, ...authSchema } })

async function main() {
  const { refreshFirstRunSampleBookkeepingData, ensureFirstRunSampleDataset } = await import('../lib/first-run-sample/seed')
  const { deleteFirstRunSampleDataset } = await import('../lib/first-run-sample/cleanup')
  const { staff, tenant, bookkeepingTransactionClassification, sampleDataset } = appSchema
  const { user } = authSchema

  const tenants = await db
    .select({ id: tenant.id, name: tenant.name })
    .from(tenant)
    .orderBy(asc(tenant.createdAt))
    .limit(3)
  console.log('tenants', tenants)

  if (tenants.length === 0) {
    console.error('No tenant found')
    process.exit(1)
  }

  const tenantId = tenants[0]!.id
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .orderBy(asc(user.createdAt))
    .limit(3)
  console.log('users', users)

  if (users.length === 0) {
    console.error('No user found')
    process.exit(1)
  }

  const userId = users[0]!.id
  const staffRows = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.tenantId, tenantId))
    .limit(1)
  console.log('staff', staffRows)

  const datasets = await db
    .select({ id: sampleDataset.id, status: sampleDataset.status, seedVersion: sampleDataset.seedVersion })
    .from(sampleDataset)
    .where(eq(sampleDataset.tenantId, tenantId))
  console.log('existing datasets', datasets)

  if (datasets.some((dataset) => dataset.status === 'active' || dataset.status === 'delete_pending')) {
    console.log('Refreshing bookkeeping rows on active sample...')
    const refreshed = await refreshFirstRunSampleBookkeepingData({ tenantId, userId })
    console.log('Refresh result:', refreshed)

    if (refreshed.refreshed) {
      const counts = await db
        .select({ sourceType: bookkeepingTransactionClassification.sourceType })
        .from(bookkeepingTransactionClassification)
        .where(eq(bookkeepingTransactionClassification.tenantId, tenantId))

      const summary = counts.reduce<Record<string, number>>((acc, row) => {
        acc[row.sourceType] = (acc[row.sourceType] ?? 0) + 1
        return acc
      }, {})
      console.log('bookkeeping counts', summary, 'total', counts.length)
      return
    }

    console.log('Refresh failed; trying full delete + recreate...')
    try {
      const deleted = await deleteFirstRunSampleDataset({ tenantId })
      console.log('Delete result:', deleted)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  console.log('Creating new sample...')
  const created = await ensureFirstRunSampleDataset({ tenantId, userId, source: 'manual_retry' })
  console.log('Create result:', created)

  if (!created.created && created.status === 'active') {
    console.log('Active sample already exists. Delete sample from dashboard UI, then rerun this script.')
  }

  const counts = await db
    .select({ sourceType: bookkeepingTransactionClassification.sourceType })
    .from(bookkeepingTransactionClassification)
    .where(eq(bookkeepingTransactionClassification.tenantId, tenantId))

  const summary = counts.reduce<Record<string, number>>((acc, row) => {
    acc[row.sourceType] = (acc[row.sourceType] ?? 0) + 1
    return acc
  }, {})
  console.log('bookkeeping counts', summary, 'total', counts.length)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

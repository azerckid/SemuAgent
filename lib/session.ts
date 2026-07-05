import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadSession } from '@/lib/db/schema'
import { hashToken } from '@/lib/token'
import { fromISO, now, toDBString } from '@/lib/time'

export async function verifyToken(rawToken: string) {
  const hash = hashToken(rawToken)

  const rows = await db
    .select()
    .from(uploadSession)
    .where(eq(uploadSession.tokenHash, hash))
    .limit(1)

  const session = rows[0]
  if (!session) return null

  if (session.status === 'expired' || session.status === 'revoked') return null

  if (fromISO(session.expiresAt) < now()) return null

  await db
    .update(uploadSession)
    .set({
      lastAccessedAt: toDBString(now()),
      ...(session.status === 'requested' ? { status: 'active' } : {}),
    })
    .where(eq(uploadSession.id, session.id))

  return session
}

import { redirect } from 'next/navigation'

// JC-031 Slice 2b-3e: legacy GIWA request-event detail is quarantined by
// app/(dashboard)/dashboard/clients/[id]/events/layout.tsx. Keep this leaf so
// direct legacy links still resolve to the explicit redirect instead of 404.
export default function BlockedClientRequestEventDetailPage() {
  redirect('/dashboard/clients')
}

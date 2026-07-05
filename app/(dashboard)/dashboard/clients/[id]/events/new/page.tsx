import { redirect } from 'next/navigation'

// JC-031 Slice 2b-3e: legacy GIWA ad-hoc request-event creation is outside v1.
// The parent events layout already redirects; this leaf preserves the route.
export default function BlockedNewClientRequestEventPage() {
  redirect('/dashboard/clients')
}

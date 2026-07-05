import { redirect } from 'next/navigation'

// Keep the leaf route alive so the quarantine redirect in this segment remains explicit.
// The legacy portal renderer and token-backed data loading were retired in JC-031 Slice 1b.
export default function LegacyUploadPortalPage() {
  redirect('/dashboard')
}

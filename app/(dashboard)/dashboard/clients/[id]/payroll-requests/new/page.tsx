import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PayrollRequestNewPage(_props: PageProps) {
  redirect('/dashboard/emails')
}

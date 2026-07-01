import { TossBillingSuccessClient } from '../../_components/toss-billing-success-client'

type PageProps = {
  searchParams: Promise<{
    authKey?: string
    customerKey?: string
  }>
}

export default async function TossBillingSuccessPage({ searchParams }: PageProps) {
  const { authKey, customerKey } = await searchParams

  return (
    <TossBillingSuccessClient
      authKey={authKey}
      customerKey={customerKey}
    />
  )
}

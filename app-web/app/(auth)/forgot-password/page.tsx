import ForgotPasswordClient from './ForgotPasswordClient'

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    error?: string | string[]
  }>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const rawError = resolvedSearchParams?.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  return <ForgotPasswordClient expiredError={error === 'link_expired'} />
}

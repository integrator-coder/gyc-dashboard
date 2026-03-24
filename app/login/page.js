import LoginPageClient from '@/components/LoginPageClient'

export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  return (
    <LoginPageClient
      message={params?.message || ''}
      nextUrl={params?.next || '/team/classify'}
    />
  )
}

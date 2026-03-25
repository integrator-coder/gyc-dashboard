import ClientIntelPage from '@/components/ClientIntelPage'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page({ params }) {
  const user = await requireUser(['ga', 'cx', 'admin'])
  const { acronym } = await params
  return <ClientIntelPage acronym={acronym} user={serializeUser(user)} />
}

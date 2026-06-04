import ClientCard from '@/components/ClientCard'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page({ params }) {
  const { acronym } = await params
  const user = await requireUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  return <ClientCard acronym={acronym} user={serializeUser(user)} />
}

import ActiveClientList from '@/components/ActiveClientList'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['ga', 'cx', 'admin', 'superadmin'])
  return <ActiveClientList user={serializeUser(user)} />
}

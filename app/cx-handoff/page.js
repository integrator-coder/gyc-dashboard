import CXHandoffPage from '@/components/CXHandoffPage'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['sales', 'ga', 'cx', 'admin', 'superadmin'])
  return <CXHandoffPage user={serializeUser(user)} />
}

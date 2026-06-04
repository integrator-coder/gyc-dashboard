import TeamClassifyPage from '@/components/TeamClassifyPage'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['sales', 'ga', 'admin', 'superadmin', 'manager'])
  return <TeamClassifyPage user={serializeUser(user)} />
}

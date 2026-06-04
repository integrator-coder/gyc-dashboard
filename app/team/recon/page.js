import TeamReconPage from '@/components/TeamReconPage'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['admin', 'recon', 'superadmin', 'sales', 'manager'])
  return <TeamReconPage user={serializeUser(user)} />
}

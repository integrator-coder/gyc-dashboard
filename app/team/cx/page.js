import TeamCXPage from '@/components/TeamCXPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['cx', 'admin', 'superadmin'])
  return <TeamCXPage />
}

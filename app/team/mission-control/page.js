import { requireUser } from '@/lib/auth'
import MissionControlPage from '@/components/MissionControlPage'

export const dynamic = 'force-dynamic'

export default async function MissionControlRoutePage() {
  await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  return <MissionControlPage />
}

import { requireUser, serializeUser } from '@/lib/auth'
import PresentationLibraryPage from '@/components/PresentationLibraryPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  return <PresentationLibraryPage user={serializeUser(user)} />
}
